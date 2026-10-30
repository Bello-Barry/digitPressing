-- =============================================================================
-- MIGRATION 20261027000000 : TÂCHE D2 - CONTRÔLE CLIENT ET CORRECTION DE FACTURE
-- Multi-tenant, révisions versionnées, validation client par OTP ou dérogation
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. TABLE ORDER_REVISIONS (VERSIONS DE FACTURE)
CREATE TABLE IF NOT EXISTS public.order_revisions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id            UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  mission_id          UUID NULL REFERENCES public.delivery_missions(id) ON DELETE SET NULL,
  version_number      INTEGER NOT NULL CHECK (version_number >= 1),
  status              TEXT NOT NULL CHECK (status IN (
                        'DRAFT', 'PENDING_AGREEMENT', 'CONFIRMED',
                        'UNVERIFIED_AGREEMENT', 'REJECTED'
                      )) DEFAULT 'DRAFT',
  verification_type   TEXT NULL CHECK (verification_type IN ('CLIENT_OTP', 'UNVERIFIED_DECLARATION')),
  otp_hash            TEXT NULL,
  otp_code_plain      TEXT NULL, -- stocké temporairement pour affichage page de suivi client
  otp_expires_at      TIMESTAMPTZ NULL,
  otp_attempts        INTEGER NOT NULL DEFAULT 0 CHECK (otp_attempts >= 0),
  subtotal_before     NUMERIC NOT NULL CHECK (subtotal_before >= 0),
  subtotal_after      NUMERIC NOT NULL CHECK (subtotal_after >= 0),
  total_before        NUMERIC NOT NULL CHECK (total_before >= 0),
  total_after         NUMERIC NOT NULL CHECK (total_after >= 0),
  created_by          UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at        TIMESTAMPTZ NULL,
  notes               TEXT NULL,

  CONSTRAINT unique_order_revision_version UNIQUE (order_id, version_number)
);

-- Index d'optimisation
CREATE INDEX IF NOT EXISTS idx_order_revisions_org_order ON public.order_revisions(organization_id, order_id);
CREATE INDEX IF NOT EXISTS idx_order_revisions_mission ON public.order_revisions(mission_id);

-- 2. TABLE ORDER_REVISION_LINES (LIGNES AVANT / APRÈS)
CREATE TABLE IF NOT EXISTS public.order_revision_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id         UUID NOT NULL REFERENCES public.order_revisions(id) ON DELETE CASCADE,
  service_id          UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  service_name        VARCHAR(255) NOT NULL,
  qty_before          INTEGER NOT NULL DEFAULT 0 CHECK (qty_before >= 0),
  qty_after           INTEGER NOT NULL CHECK (qty_after >= 0),
  unit_price          NUMERIC NOT NULL CHECK (unit_price >= 0),
  line_total_before   NUMERIC NOT NULL DEFAULT 0 CHECK (line_total_before >= 0),
  line_total_after    NUMERIC NOT NULL CHECK (line_total_after >= 0),
  color               VARCHAR(50) NULL,
  pattern             VARCHAR(50) NULL,
  brand               VARCHAR(50) NULL,
  size                VARCHAR(30) NULL,
  item_notes          TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_revision_lines_rev ON public.order_revision_lines(revision_id);

-- 3. SECURITÉ RLS ET SÉCURISATION CONTRE LES MUTATIONS DIRECTES

ALTER TABLE public.order_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_revision_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_revisions_select" ON public.order_revisions;
DROP POLICY IF EXISTS "order_revision_lines_select" ON public.order_revision_lines;

-- Lecture pour les membres de l'organisation
CREATE POLICY "order_revisions_select"
  ON public.order_revisions FOR SELECT
  USING (organization_id = auth.get_user_org_id());

CREATE POLICY "order_revision_lines_select"
  ON public.order_revision_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.order_revisions r
      WHERE r.id = order_revision_lines.revision_id
        AND r.organization_id = auth.get_user_org_id()
    )
  );

-- Révocation des écritures directes (INSERT, UPDATE, DELETE, TRUNCATE) pour tous les rôles
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.order_revisions FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.order_revision_lines FROM PUBLIC, anon, authenticated;

-- Déclencheur interdisant tout UPDATE/DELETE direct depuis le client
CREATE OR REPLACE FUNCTION public.prevent_direct_order_revisions_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.in_rpc', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Les modifications directes sur order_revisions sont interdites. Utilisez les fonctions RPC.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_direct_order_revisions_mutation ON public.order_revisions;
CREATE TRIGGER trg_prevent_direct_order_revisions_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.order_revisions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_order_revisions_mutation();

-- Déclencheur d'audit automatique AFTER
DROP TRIGGER IF EXISTS trg_audit_order_revisions ON public.order_revisions;
CREATE TRIGGER trg_audit_order_revisions
  AFTER INSERT OR UPDATE OR DELETE ON public.order_revisions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generic_audit_log();

-- 4. FONCTIONS RPC SÉCURISÉES POUR LA GESTION DES REVISIONS ET OTP

-- 4a. Création d'un projet de révision de facture avec génération du code OTP
CREATE OR REPLACE FUNCTION public.create_order_revision_draft(
  p_mission_id UUID,
  p_lines_json JSONB,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  revision_id UUID,
  version_number INTEGER,
  otp_code TEXT,
  subtotal_after NUMERIC,
  total_after NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_mission public.delivery_missions;
  v_order public.orders;
  v_version INTEGER;
  v_rev_id UUID;
  v_subtotal_before NUMERIC := 0;
  v_subtotal_after NUMERIC := 0;
  v_total_before NUMERIC := 0;
  v_total_after NUMERIC := 0;
  v_otp_code TEXT;
  v_otp_hash TEXT;
  v_elem JSONB;
  v_svc_id UUID;
  v_svc_name TEXT;
  v_qty_before INTEGER;
  v_qty_after INTEGER;
  v_unit_price NUMERIC;
  v_line_before NUMERIC;
  v_line_after NUMERIC;
BEGIN
  PERFORM set_config('app.in_rpc', 'true', true);

  v_user_id := auth.uid();
  v_org_id := auth.get_user_org_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié.' USING ERRCODE = '42501';
  END IF;

  -- Récupération de la mission
  SELECT * INTO v_mission FROM public.delivery_missions WHERE id = p_mission_id AND organization_id = v_org_id;
  IF v_mission.id IS NULL THEN
    RAISE EXCEPTION 'Mission introuvable.';
  END IF;

  IF v_mission.assigned_to IS DISTINCT FROM v_user_id AND NOT public.catalog_has_role('OWNER', 'MANAGER') THEN
    RAISE EXCEPTION 'Seul le livreur attribué ou un responsable peut réviser la facture.' USING ERRCODE = '42501';
  END IF;

  -- Récupération de la commande
  SELECT * INTO v_order FROM public.orders WHERE id = v_mission.order_id AND organization_id = v_org_id;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Commande introuvable.';
  END IF;

  v_subtotal_before := v_order.subtotal;
  v_total_before := v_order.total_amount;

  -- Numéro de version suivant
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version
  FROM public.order_revisions WHERE order_id = v_order.id;

  -- Génération d'un code OTP à 6 chiffres
  v_otp_code := lpad(floor(random() * 900000 + 100000)::text, 6, '0');
  v_otp_hash := encode(digest(v_otp_code, 'sha256'), 'hex');

  -- Insertion du header de révision en DRAFT / PENDING_AGREEMENT
  INSERT INTO public.order_revisions (
    organization_id, order_id, mission_id, version_number,
    status, otp_hash, otp_code_plain, otp_expires_at, otp_attempts,
    subtotal_before, subtotal_after, total_before, total_after,
    created_by, notes, created_at
  ) VALUES (
    v_org_id, v_order.id, p_mission_id, v_version,
    'PENDING_AGREEMENT', v_otp_hash, v_otp_code, NOW() + INTERVAL '30 minutes', 0,
    v_subtotal_before, 0, v_total_before, 0,
    v_user_id, p_notes, NOW()
  )
  RETURNING id INTO v_rev_id;

  -- Parcours des lignes du JSON p_lines_json
  -- Format : [{ service_id: "...", qty_after: 2, color: "...", pattern: "...", brand: "...", size: "...", item_notes: "..." }]
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_lines_json)
  LOOP
    v_svc_id := (v_elem->>'service_id')::UUID;
    v_qty_after := COALESCE((v_elem->>'qty_after')::INTEGER, 0);

    -- Prix du catalogue garanti côté serveur pour empêcher la modification de prix par le livreur
    SELECT name, price INTO v_svc_name, v_unit_price
    FROM public.services
    WHERE id = v_svc_id AND organization_id = v_org_id;

    IF v_svc_name IS NULL THEN
      RAISE EXCEPTION 'Service introuvable dans le catalogue.';
    END IF;

    -- Quantité et total avant
    SELECT COALESCE(quantity, 0), COALESCE(line_total, 0)
    INTO v_qty_before, v_line_before
    FROM public.order_items
    WHERE order_id = v_order.id AND service_id = v_svc_id;

    IF v_qty_before IS NULL THEN v_qty_before := 0; v_line_before := 0; END IF;

    v_line_after := v_qty_after * v_unit_price;
    v_subtotal_after := v_subtotal_after + v_line_after;

    INSERT INTO public.order_revision_lines (
      revision_id, service_id, service_name,
      qty_before, qty_after, unit_price,
      line_total_before, line_total_after,
      color, pattern, brand, size, item_notes
    ) VALUES (
      v_rev_id, v_svc_id, v_svc_name,
      v_qty_before, v_qty_after, v_unit_price,
      v_line_before, v_line_after,
      v_elem->>'color', v_elem->>'pattern', v_elem->>'brand', v_elem->>'size', v_elem->>'item_notes'
    );
  END LOOP;

  -- Calcul du total après avec frais de livraison et remise préservés
  v_total_after := GREATEST(0, v_subtotal_after + v_order.delivery_fee - v_order.discount_amount);

  -- Mise à jour des totaux recalculés dans la révision
  UPDATE public.order_revisions
  SET subtotal_after = v_subtotal_after,
      total_after = v_total_after
  WHERE id = v_rev_id;

  RETURN QUERY
  SELECT v_rev_id, v_version, v_otp_code, v_subtotal_after, v_total_after;
END;
$$;

-- 4b. Confirmation de la révision par code OTP client
CREATE OR REPLACE FUNCTION public.confirm_order_revision_otp(
  p_revision_id UUID,
  p_otp_code TEXT
)
RETURNS public.order_revisions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID;
  v_rev public.order_revisions;
  v_input_hash TEXT;
  v_line RECORD;
  v_total_items INTEGER := 0;
BEGIN
  PERFORM set_config('app.in_rpc', 'true', true);

  v_org_id := auth.get_user_org_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_rev FROM public.order_revisions WHERE id = p_revision_id AND organization_id = v_org_id;
  IF v_rev.id IS NULL THEN
    RAISE EXCEPTION 'Révision introuvable.';
  END IF;

  IF v_rev.status <> 'PENDING_AGREEMENT' THEN
    RAISE EXCEPTION 'Cette révision n''est pas en attente de confirmation.';
  END IF;

  IF v_rev.otp_attempts >= 5 THEN
    RAISE EXCEPTION 'Nombre maximal de tentatives de validation dépassé (5/5).';
  END IF;

  IF v_rev.otp_expires_at < NOW() THEN
    RAISE EXCEPTION 'Code de validation expiré. Veuillez régénérer un code.';
  END IF;

  v_input_hash := encode(digest(btrim(p_otp_code), 'sha256'), 'hex');

  IF v_input_hash <> v_rev.otp_hash THEN
    UPDATE public.order_revisions SET otp_attempts = otp_attempts + 1 WHERE id = p_revision_id;
    RAISE EXCEPTION 'Code de validation incorrect.';
  END IF;

  -- Code Valide -> Marquer CONFIRMED
  UPDATE public.order_revisions
  SET status = 'CONFIRMED',
      verification_type = 'CLIENT_OTP',
      confirmed_at = NOW(),
      otp_code_plain = NULL -- Effacer le code en clair après validation
  WHERE id = p_revision_id
  RETURNING * INTO v_rev;

  -- Application définitive de la révision aux articles de la commande
  DELETE FROM public.order_items WHERE order_id = v_rev.order_id;

  FOR v_line IN SELECT * FROM public.order_revision_lines WHERE revision_id = p_revision_id AND qty_after > 0
  LOOP
    INSERT INTO public.order_items (
      organization_id, order_id, service_id, service_name,
      quantity, unit_price, line_total,
      color, pattern, brand, size, item_notes
    ) VALUES (
      v_org_id, v_rev.order_id, v_line.service_id, v_line.service_name,
      v_line.qty_after, v_line.unit_price, v_line.line_total_after,
      v_line.color, v_line.pattern, v_line.brand, v_line.size, v_line.item_notes
    );
    v_total_items := v_total_items + v_line.qty_after;
  END LOOP;

  -- Mise à jour de la commande (totaux et comptage)
  UPDATE public.orders
  SET subtotal = v_rev.subtotal_after,
      total_amount = v_rev.total_after,
      items_count_in = v_total_items,
      updated_at = NOW()
  WHERE id = v_rev.order_id;

  RETURN v_rev;
END;
$$;

-- 4c. Confirmation sans vérification client (Déclaration non vérifiée avec alerte)
CREATE OR REPLACE FUNCTION public.confirm_order_revision_unverified(
  p_revision_id UUID,
  p_reason TEXT
)
RETURNS public.order_revisions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID;
  v_rev public.order_revisions;
  v_line RECORD;
  v_total_items INTEGER := 0;
BEGIN
  PERFORM set_config('app.in_rpc', 'true', true);

  v_org_id := auth.get_user_org_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié.' USING ERRCODE = '42501';
  END IF;

  IF btrim(COALESCE(p_reason, '')) = '' OR char_length(btrim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Un motif détaillé (au moins 5 caractères) est obligatoire pour valider sans vérification client.';
  END IF;

  SELECT * INTO v_rev FROM public.order_revisions WHERE id = p_revision_id AND organization_id = v_org_id;
  IF v_rev.id IS NULL THEN
    RAISE EXCEPTION 'Révision introuvable.';
  END IF;

  IF v_rev.status <> 'PENDING_AGREEMENT' THEN
    RAISE EXCEPTION 'Cette révision n''est pas en attente de confirmation.';
  END IF;

  -- Marquer UNVERIFIED_AGREEMENT
  UPDATE public.order_revisions
  SET status = 'UNVERIFIED_AGREEMENT',
      verification_type = 'UNVERIFIED_DECLARATION',
      confirmed_at = NOW(),
      notes = COALESCE(notes, '') || ' [Accord non vérifié : ' || btrim(p_reason) || ']',
      otp_code_plain = NULL
  WHERE id = p_revision_id
  RETURNING * INTO v_rev;

  -- Application de la révision
  DELETE FROM public.order_items WHERE order_id = v_rev.order_id;

  FOR v_line IN SELECT * FROM public.order_revision_lines WHERE revision_id = p_revision_id AND qty_after > 0
  LOOP
    INSERT INTO public.order_items (
      organization_id, order_id, service_id, service_name,
      quantity, unit_price, line_total,
      color, pattern, brand, size, item_notes
    ) VALUES (
      v_org_id, v_rev.order_id, v_line.service_id, v_line.service_name,
      v_line.qty_after, v_line.unit_price, v_line.line_total_after,
      v_line.color, v_line.pattern, v_line.brand, v_line.size, v_line.item_notes
    );
    v_total_items := v_total_items + v_line.qty_after;
  END LOOP;

  UPDATE public.orders
  SET subtotal = v_rev.subtotal_after,
      total_amount = v_rev.total_after,
      items_count_in = v_total_items,
      updated_at = NOW()
  WHERE id = v_rev.order_id;

  RETURN v_rev;
END;
$$;

-- 4d. Récupération du code OTP actif pour affichage sur la page de suivi client (/f/[token])
CREATE OR REPLACE FUNCTION public.get_active_revision_otp_for_tracking(p_order_id UUID)
RETURNS TABLE (
  revision_id UUID,
  version_number INTEGER,
  otp_code TEXT,
  expires_at TIMESTAMPTZ,
  total_after NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.version_number,
    r.otp_code_plain,
    r.otp_expires_at,
    r.total_after
  FROM public.order_revisions r
  WHERE r.order_id = p_order_id
    AND r.status = 'PENDING_AGREEMENT'
    AND r.otp_expires_at > NOW()
  ORDER BY r.version_number DESC
  LIMIT 1;
END;
$$;

-- 5. CONFIGURATION DES DROITS EXECUTE SUR LES RPC
REVOKE ALL ON FUNCTION public.create_order_revision_draft FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_order_revision_otp FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_order_revision_unverified FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_active_revision_otp_for_tracking FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_order_revision_draft TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_order_revision_otp TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_order_revision_unverified TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_revision_otp_for_tracking TO PUBLIC, anon, authenticated;
