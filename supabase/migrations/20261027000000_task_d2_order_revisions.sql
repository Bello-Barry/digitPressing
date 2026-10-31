-- =============================================================================
-- MIGRATION 20261027000000 : TÂCHE D2 - CONTRÔLE CLIENT ET CORRECTION DE FACTURE
-- Multi-tenant, révisions versionnées, code client calculé à la volée,
-- contrôle obligatoire à la collecte, gestion des essais sans exception.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. EXTENSION DE DELIVERY_MISSIONS (STATUT DU CONTRÔLE CLIENT)
ALTER TABLE public.delivery_missions
  ADD COLUMN IF NOT EXISTS pickup_check_status TEXT CHECK (pickup_check_status IN ('CONFORM', 'CORRECTED'));

-- 2. TABLE PRIVÉE DES SECRETS SERVEUR (RLS activé sans politique, aucun accès direct)
CREATE TABLE IF NOT EXISTS public.private_secrets (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

ALTER TABLE public.private_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.private_secrets FROM PUBLIC, anon, authenticated;

-- Initialisation du secret de calcul des codes OTP s'il n'existe pas
INSERT INTO public.private_secrets (key, value)
VALUES ('revision_otp_secret', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

-- 3. TABLE ORDER_REVISIONS (VERSIONS DE FACTURE)
CREATE TABLE IF NOT EXISTS public.order_revisions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  order_id            UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  mission_id          UUID NOT NULL REFERENCES public.delivery_missions(id) ON DELETE RESTRICT,
  version_number      INTEGER NOT NULL CHECK (version_number >= 1),
  status              TEXT NOT NULL CHECK (status IN (
                        'PENDING_AGREEMENT', 'CONFIRMED',
                        'UNVERIFIED_AGREEMENT', 'REJECTED', 'SUPERSEDED'
                      )) DEFAULT 'PENDING_AGREEMENT',
  verification_type   TEXT NULL CHECK (verification_type IN ('CLIENT_OTP', 'UNVERIFIED_DECLARATION')),
  nonce               INTEGER NOT NULL DEFAULT 1 CHECK (nonce >= 1),
  renew_count         INTEGER NOT NULL DEFAULT 0 CHECK (renew_count >= 0 AND renew_count <= 3),
  attempts            INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  subtotal_before     NUMERIC NOT NULL CHECK (subtotal_before >= 0),
  subtotal_after      NUMERIC NOT NULL CHECK (subtotal_after >= 0),
  total_before        NUMERIC NOT NULL CHECK (total_before >= 0),
  total_after         NUMERIC NOT NULL CHECK (total_after >= 0),
  created_by          UUID NULL, -- sans clé étrangère vers auth.users
  confirmed_by        UUID NULL, -- sans clé étrangère vers auth.users
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at        TIMESTAMPTZ NULL,
  notes               TEXT NULL,
  unverified_reason   TEXT NULL,

  CONSTRAINT unique_order_revision_version UNIQUE (order_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_order_revisions_org_order ON public.order_revisions(organization_id, order_id);
CREATE INDEX IF NOT EXISTS idx_order_revisions_mission ON public.order_revisions(mission_id);
CREATE INDEX IF NOT EXISTS idx_order_revisions_status ON public.order_revisions(order_id, status);

-- 4. TABLE ORDER_REVISION_LINES (DÉTAIL DES LIGNES AVANT / APRÈS)
CREATE TABLE IF NOT EXISTS public.order_revision_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id         UUID NOT NULL REFERENCES public.order_revisions(id) ON DELETE CASCADE,
  order_item_id       UUID NULL REFERENCES public.order_items(id) ON DELETE RESTRICT,
  service_id          UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  service_name        VARCHAR(255) NOT NULL,
  qty_before          INTEGER NOT NULL DEFAULT 0 CHECK (qty_before >= 0),
  qty_after           INTEGER NOT NULL CHECK (qty_after >= 0),
  unit_price          NUMERIC NOT NULL CHECK (unit_price >= 0),
  line_total_before   NUMERIC NOT NULL DEFAULT 0 CHECK (line_total_before >= 0),
  line_total_after    NUMERIC NOT NULL CHECK (line_total_after >= 0),
  item_type           VARCHAR(100) NULL,
  color               VARCHAR(50) NULL,
  pattern             VARCHAR(50) NULL,
  brand               VARCHAR(50) NULL,
  size                VARCHAR(30) NULL,
  item_notes          TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_revision_lines_rev ON public.order_revision_lines(revision_id);
CREATE INDEX IF NOT EXISTS idx_order_revision_lines_item ON public.order_revision_lines(order_item_id);

-- 5. RLS ET PROTECTION CONTRE LES MUTATIONS DIRECTES

ALTER TABLE public.order_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_revision_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_revisions_select" ON public.order_revisions;
DROP POLICY IF EXISTS "order_revision_lines_select" ON public.order_revision_lines;

-- Lecture : OWNER, MANAGER, CASHIER de l'organisation ; LIVREUR uniquement pour ses missions
CREATE POLICY "order_revisions_select"
  ON public.order_revisions FOR SELECT
  USING (
    public.catalog_has_role(organization_id, ARRAY['OWNER', 'MANAGER', 'CASHIER']::text[])
    OR EXISTS (
      SELECT 1 FROM public.delivery_missions m
      WHERE m.id = order_revisions.mission_id
        AND m.assigned_to = auth.uid()
    )
  );

CREATE POLICY "order_revision_lines_select"
  ON public.order_revision_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.order_revisions r
      WHERE r.id = order_revision_lines.revision_id
        AND (
          public.catalog_has_role(r.organization_id, ARRAY['OWNER', 'MANAGER', 'CASHIER']::text[])
          OR EXISTS (
            SELECT 1 FROM public.delivery_missions m
            WHERE m.id = r.mission_id
              AND m.assigned_to = auth.uid()
          )
        )
    )
  );

-- Révocation des écritures directes (INSERT, UPDATE, DELETE, TRUNCATE) pour tous les rôles
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.order_revisions FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.order_revision_lines FROM PUBLIC, anon, authenticated;

-- Déclencheur interdisant tout INSERT / UPDATE / DELETE direct depuis le client
CREATE OR REPLACE FUNCTION public.prevent_direct_order_revisions_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
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

DROP TRIGGER IF EXISTS trg_prevent_direct_order_revision_lines_mutation ON public.order_revision_lines;
CREATE TRIGGER trg_prevent_direct_order_revision_lines_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.order_revision_lines
  FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_order_revisions_mutation();

-- Déclencheur d'audit automatique AFTER sur order_revisions
DROP TRIGGER IF EXISTS trg_audit_order_revisions ON public.order_revisions;
CREATE TRIGGER trg_audit_order_revisions
  AFTER INSERT OR UPDATE OR DELETE ON public.order_revisions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generic_audit_log();

-- 6. FONCTIONS RPC SÉCURISÉES

-- 6a. Fonction interne de calcul du code OTP (6 chiffres calculés à partir du secret, id, nonce)
CREATE OR REPLACE FUNCTION public.compute_revision_otp_code(p_revision_id UUID, p_nonce INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_secret TEXT;
  v_hash TEXT;
  v_hex TEXT;
  v_num BIGINT;
BEGIN
  SELECT value INTO v_secret FROM public.private_secrets WHERE key = 'revision_otp_secret';
  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'Secret serveur introuvable.';
  END IF;

  v_hash := encode(digest(v_secret || p_revision_id::text || p_nonce::text, 'sha256'), 'hex');
  v_hex := substring(v_hash from 1 for 8);
  v_num := ('x' || v_hex)::bit(32)::bigint;
  RETURN lpad((v_num % 900000 + 100000)::text, 6, '0');
END;
$$;

-- 6b. Création d'un brouillon de révision de facture
-- Uniquement le livreur attribué, mission AT_CUSTOMER, commande VALIDATED
-- NE RENVOIE JAMAIS LE CODE CLIENT !
CREATE OR REPLACE FUNCTION public.create_order_revision_draft(
  p_mission_id UUID,
  p_lines_json JSONB,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_mission public.delivery_missions;
  v_order public.orders;
  v_org_id UUID;
  v_version INTEGER;
  v_rev_id UUID;
  v_subtotal_before NUMERIC := 0;
  v_subtotal_after NUMERIC := 0;
  v_total_before NUMERIC := 0;
  v_total_after NUMERIC := 0;
  v_elem JSONB;
  v_item_id UUID;
  v_svc_id UUID;
  v_svc_name TEXT;
  v_qty_after INTEGER;
  v_unit_price NUMERIC;
  v_line_before NUMERIC;
  v_line_after NUMERIC;
  v_item public.order_items;
  v_item_type TEXT;
  v_color TEXT;
  v_pattern TEXT;
  v_brand TEXT;
  v_size TEXT;
  v_item_notes TEXT;
  v_existing_item_ids UUID[] := ARRAY[]::UUID[];
  v_total_pieces_after INTEGER := 0;
  v_payments_sum NUMERIC := 0;
BEGIN
  PERFORM set_config('app.in_rpc', 'true', true);

  -- 1. Récupération de la mission
  SELECT * INTO v_mission FROM public.delivery_missions WHERE id = p_mission_id;
  IF v_mission.id IS NULL THEN
    RAISE EXCEPTION 'Mission introuvable.';
  END IF;

  v_org_id := v_mission.organization_id;

  -- 2. Vérification des conditions de rôle et d'état
  IF v_mission.assigned_to IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Seul le livreur attribué à la mission peut initier une révision de facture.' USING ERRCODE = '42501';
  END IF;

  IF v_mission.status <> 'AT_CUSTOMER' THEN
    RAISE EXCEPTION 'La correction de facture ne peut se faire que lorsque vous êtes chez le client (AT_CUSTOMER).';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_mission.order_id AND organization_id = v_org_id;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Commande introuvable.';
  END IF;

  IF v_order.status <> 'VALIDATED' THEN
    RAISE EXCEPTION 'La correction de facture n''est possible que pour une commande validée en attente de collecte.';
  END IF;

  -- 3. Supercéder toute révision précédente en attente pour cette commande
  UPDATE public.order_revisions
  SET status = 'SUPERSEDED'
  WHERE order_id = v_order.id AND status = 'PENDING_AGREEMENT';

  -- 4. Numéro de version suivant
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version
  FROM public.order_revisions WHERE order_id = v_order.id;

  v_subtotal_before := v_order.subtotal;
  v_total_before := v_order.total_amount;

  -- 5. Création du header de révision (PENDING_AGREEMENT)
  INSERT INTO public.order_revisions (
    organization_id, order_id, mission_id, version_number,
    status, nonce, renew_count, attempts,
    expires_at, subtotal_before, subtotal_after, total_before, total_after,
    created_by, notes, created_at
  ) VALUES (
    v_org_id, v_order.id, p_mission_id, v_version,
    'PENDING_AGREEMENT', 1, 0, 0,
    NOW() + INTERVAL '30 minutes', v_subtotal_before, 0, v_total_before, 0,
    auth.uid(), p_notes, NOW()
  )
  RETURNING id INTO v_rev_id;

  -- 6. Traitement des lignes transmises dans p_lines_json
  -- Format : [{ order_item_id: "...", service_id: "...", qty_after: 2, color: "...", ... }]
  IF p_lines_json IS NOT NULL AND jsonb_typeof(p_lines_json) = 'array' THEN
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_lines_json)
    LOOP
      v_item_id := NULLIF(v_elem->>'order_item_id', '')::UUID;
      v_svc_id := NULLIF(v_elem->>'service_id', '')::UUID;
      v_qty_after := COALESCE((v_elem->>'qty_after')::INTEGER, 0);

      IF v_qty_after < 0 THEN
        RAISE EXCEPTION 'La quantité ne peut pas être négative.';
      END IF;

      IF v_item_id IS NOT NULL THEN
        -- Ligne existante de la commande : conserver le prix unitaire d'origine
        SELECT * INTO v_item FROM public.order_items WHERE id = v_item_id AND order_id = v_order.id;
        IF v_item.id IS NULL THEN
          RAISE EXCEPTION 'Ligne d''article de commande introuvable (ID: %).', v_item_id;
        END IF;

        v_svc_id := v_item.service_id;
        v_svc_name := v_item.service_name;
        v_unit_price := v_item.unit_price; -- Le prix existant ne change jamais
        v_line_before := v_item.line_total;
        v_line_after := v_qty_after * v_unit_price;
        v_item_type := COALESCE(v_elem->>'item_type', v_item.item_type);
        v_color := COALESCE(v_elem->>'color', v_item.color);
        v_pattern := COALESCE(v_elem->>'pattern', v_item.pattern);
        v_brand := COALESCE(v_elem->>'brand', v_item.brand);
        v_size := COALESCE(v_elem->>'size', v_item.size);
        v_item_notes := COALESCE(v_elem->>'item_notes', v_item.item_notes);

        v_existing_item_ids := array_append(v_existing_item_ids, v_item.id);
      ELSE
        -- Nouvel article ajouté : doit exister et être actif dans le catalogue
        IF v_svc_id IS NULL THEN
          RAISE EXCEPTION 'Le service doit être spécifié pour tout ajout d''article.';
        END IF;

        SELECT name, price INTO v_svc_name, v_unit_price
        FROM public.services
        WHERE id = v_svc_id AND organization_id = v_org_id AND is_active = true;

        IF v_svc_name IS NULL THEN
          RAISE EXCEPTION 'Seuls les services actifs du catalogue peuvent être ajoutés.';
        END IF;

        v_line_before := 0;
        v_line_after := v_qty_after * v_unit_price;
        v_item_type := v_elem->>'item_type';
        v_color := v_elem->>'color';
        v_pattern := v_elem->>'pattern';
        v_brand := v_elem->>'brand';
        v_size := v_elem->>'size';
        v_item_notes := v_elem->>'item_notes';
      END IF;

      v_subtotal_after := v_subtotal_after + v_line_after;
      v_total_pieces_after := v_total_pieces_after + v_qty_after;

      INSERT INTO public.order_revision_lines (
        revision_id, order_item_id, service_id, service_name,
        qty_before, qty_after, unit_price, line_total_before, line_total_after,
        item_type, color, pattern, brand, size, item_notes
      ) VALUES (
        v_rev_id, v_item_id, v_svc_id, v_svc_name,
        COALESCE(v_item.quantity, 0), v_qty_after, v_unit_price,
        v_line_before, v_line_after,
        v_item_type, v_color, v_pattern, v_brand, v_size, v_item_notes
      );
    END LOOP;
  END IF;

  -- 7. Les lignes existantes de la commande non citées restent inchangées
  FOR v_item IN
    SELECT * FROM public.order_items
    WHERE order_id = v_order.id
      AND (v_existing_item_ids IS NULL OR NOT (id = ANY(v_existing_item_ids)))
  LOOP
    v_subtotal_after := v_subtotal_after + v_item.line_total;
    v_total_pieces_after := v_total_pieces_after + v_item.quantity;

    INSERT INTO public.order_revision_lines (
      revision_id, order_item_id, service_id, service_name,
      qty_before, qty_after, unit_price, line_total_before, line_total_after,
      item_type, color, pattern, brand, size, item_notes
    ) VALUES (
      v_rev_id, v_item.id, v_item.service_id, v_item.service_name,
      v_item.quantity, v_item.quantity, v_item.unit_price,
      v_item.line_total, v_item.line_total,
      v_item.item_type, v_item.color, v_item.pattern, v_item.brand, v_item.size, v_item.item_notes
    );
  END LOOP;

  -- 8. Règle : au moins une pièce doit rester au total dans la commande
  IF v_total_pieces_after < 1 THEN
    RAISE EXCEPTION 'Au moins un article doit être conservé dans la commande.';
  END IF;

  -- 9. Calcul du nouveau montant total (préserve frais de livraison et remise)
  v_total_after := GREATEST(0, v_subtotal_after + v_order.delivery_fee - v_order.discount_amount);

  -- 10. Refus si le nouveau total est inférieur aux paiements déjà enregistrés
  SELECT COALESCE(SUM(amount), 0) INTO v_payments_sum
  FROM public.payments
  WHERE order_id = v_order.id AND is_reversal = false;

  IF v_total_after < v_payments_sum THEN
    RAISE EXCEPTION 'Le nouveau total (% FCFA) ne peut pas être inférieur aux paiements déjà enregistrés (% FCFA).',
      v_total_after, v_payments_sum;
  END IF;

  -- Mise à jour des totaux recalculés sur le projet
  UPDATE public.order_revisions
  SET subtotal_after = v_subtotal_after,
      total_after = v_total_after
  WHERE id = v_rev_id;

  -- RÉSULTAT : NE RENVOIE JAMAIS LE CODE CLIENT !
  RETURN jsonb_build_object(
    'ok', true,
    'revision_id', v_rev_id,
    'version_number', v_version,
    'subtotal_before', v_subtotal_before,
    'subtotal_after', v_subtotal_after,
    'total_before', v_total_before,
    'total_after', v_total_after,
    'expires_at', (NOW() + INTERVAL '30 minutes')
  );
END;
$$;

-- 6c. Renouvellement du code OTP (3 renouvellements max, remet attempts à 0)
CREATE OR REPLACE FUNCTION public.renew_order_revision_code(p_mission_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_mission public.delivery_missions;
  v_rev public.order_revisions;
BEGIN
  PERFORM set_config('app.in_rpc', 'true', true);

  SELECT * INTO v_mission FROM public.delivery_missions WHERE id = p_mission_id;
  IF v_mission.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Mission introuvable.');
  END IF;

  IF v_mission.assigned_to IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Seul le livreur attribué peut renouveler le code.');
  END IF;

  SELECT * INTO v_rev
  FROM public.order_revisions
  WHERE mission_id = p_mission_id AND status = 'PENDING_AGREEMENT';

  IF v_rev.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Aucune révision en attente pour cette mission.');
  END IF;

  IF v_rev.renew_count >= 3 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'message', 'Nombre maximal de renouvellements atteint (3/3).',
      'renews_left', 0
    );
  END IF;

  UPDATE public.order_revisions
  SET nonce = nonce + 1,
      renew_count = renew_count + 1,
      attempts = 0,
      expires_at = NOW() + INTERVAL '30 minutes'
  WHERE id = v_rev.id;

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Code de validation renouvelé avec succès.',
    'attempts_left', 5,
    'renews_left', 3 - (v_rev.renew_count + 1)
  );
END;
$$;

-- 6d. Confirmation par code OTP client
-- IMPORTANT : Une erreur de code ne lève PAS d'exception (le rollback annulerait le compteur !)
CREATE OR REPLACE FUNCTION public.confirm_order_revision_otp(
  p_mission_id UUID,
  p_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_mission public.delivery_missions;
  v_order public.orders;
  v_rev public.order_revisions;
  v_expected_code TEXT;
  v_clean_code TEXT;
  v_line RECORD;
  v_payments_sum NUMERIC := 0;
BEGIN
  PERFORM set_config('app.in_rpc', 'true', true);

  SELECT * INTO v_mission FROM public.delivery_missions WHERE id = p_mission_id;
  IF v_mission.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Mission introuvable.');
  END IF;

  IF v_mission.assigned_to IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Seul le livreur attribué peut confirmer la révision.');
  END IF;

  IF v_mission.status <> 'AT_CUSTOMER' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Vous devez être chez le client (AT_CUSTOMER).');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_mission.order_id;
  IF v_order.id IS NULL OR v_order.status <> 'VALIDATED' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'La commande n''est plus au statut validé.');
  END IF;

  SELECT * INTO v_rev
  FROM public.order_revisions
  WHERE mission_id = p_mission_id AND status = 'PENDING_AGREEMENT';

  IF v_rev.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Aucune révision en attente de confirmation.');
  END IF;

  IF v_rev.expires_at < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Code de validation expiré. Veuillez le renouveler.');
  END IF;

  IF v_rev.attempts >= 5 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'message', 'Nombre maximal de tentatives dépassé (5/5). Renouvelez le code.',
      'attempts_left', 0
    );
  END IF;

  -- Calcul du code attendu
  v_expected_code := public.compute_revision_otp_code(v_rev.id, v_rev.nonce);
  v_clean_code := btrim(COALESCE(p_code, ''));

  IF v_clean_code <> v_expected_code THEN
    -- Incrémentation du compteur sans exception pour persister l'essai
    UPDATE public.order_revisions
    SET attempts = attempts + 1
    WHERE id = v_rev.id;

    RETURN jsonb_build_object(
      'ok', false,
      'message', 'Code de validation incorrect.',
      'attempts_left', GREATEST(0, 5 - (v_rev.attempts + 1))
    );
  END IF;

  -- Contrôle paiements existants
  SELECT COALESCE(SUM(amount), 0) INTO v_payments_sum
  FROM public.payments
  WHERE order_id = v_order.id AND is_reversal = false;

  IF v_rev.total_after < v_payments_sum THEN
    RETURN jsonb_build_object(
      'ok', false,
      'message', format('Le nouveau total (%s FCFA) est inférieur aux acomptes déjà versés (%s FCFA).', v_rev.total_after, v_payments_sum)
    );
  END IF;

  -- CODE VALIDE : APPLICATION DE LA RÉVISION
  -- 1. Marquer la révision CONFIRMED
  UPDATE public.order_revisions
  SET status = 'CONFIRMED',
      verification_type = 'CLIENT_OTP',
      confirmed_at = NOW(),
      confirmed_by = auth.uid()
  WHERE id = v_rev.id;

  -- 2. Appliquer les modifications sur order_items
  FOR v_line IN SELECT * FROM public.order_revision_lines WHERE revision_id = v_rev.id
  LOOP
    IF v_line.order_item_id IS NOT NULL THEN
      IF v_line.qty_after = 0 THEN
        DELETE FROM public.order_items WHERE id = v_line.order_item_id;
      ELSE
        UPDATE public.order_items
        SET quantity = v_line.qty_after,
            line_total = v_line.qty_after * unit_price,
            item_type = COALESCE(v_line.item_type, item_type),
            color = COALESCE(v_line.color, color),
            pattern = COALESCE(v_line.pattern, pattern),
            brand = COALESCE(v_line.brand, brand),
            size = COALESCE(v_line.size, size),
            item_notes = COALESCE(v_line.item_notes, item_notes)
        WHERE id = v_line.order_item_id;
      END IF;
    ELSIF v_line.qty_after > 0 THEN
      INSERT INTO public.order_items (
        organization_id, order_id, service_id, service_name,
        quantity, unit_price, line_total,
        item_type, color, pattern, brand, size, item_notes
      ) VALUES (
        v_rev.organization_id, v_rev.order_id, v_line.service_id, v_line.service_name,
        v_line.qty_after, v_line.unit_price, v_line.line_total_after,
        v_line.item_type, v_line.color, v_line.pattern, v_line.brand, v_line.size, v_line.item_notes
      );
    END IF;
  END LOOP;

  -- 3. Mise à jour des totaux de la commande (SANS toucher à items_count_in)
  UPDATE public.orders
  SET subtotal = v_rev.subtotal_after,
      total_amount = v_rev.total_after,
      updated_at = NOW()
  WHERE id = v_rev.order_id;

  -- 4. Enregistrement du contrôle chez le client comme CORRECTED
  UPDATE public.delivery_missions
  SET pickup_check_status = 'CORRECTED',
      updated_at = NOW()
  WHERE id = p_mission_id;

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Révision confirmée par code client avec succès.',
    'total_amount', v_rev.total_after
  );
END;
$$;

-- 6e. Déclaration d'accord non vérifié (client sans téléphone / réseau)
CREATE OR REPLACE FUNCTION public.confirm_order_revision_unverified(
  p_mission_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_mission public.delivery_missions;
  v_order public.orders;
  v_rev public.order_revisions;
  v_line RECORD;
  v_payments_sum NUMERIC := 0;
  v_clean_reason TEXT;
BEGIN
  PERFORM set_config('app.in_rpc', 'true', true);

  v_clean_reason := btrim(COALESCE(p_reason, ''));
  IF char_length(v_clean_reason) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Un motif détaillé d''au moins 5 caractères est obligatoire.');
  END IF;

  SELECT * INTO v_mission FROM public.delivery_missions WHERE id = p_mission_id;
  IF v_mission.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Mission introuvable.');
  END IF;

  IF v_mission.assigned_to IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Seul le livreur attribué peut valider cette opération.');
  END IF;

  IF v_mission.status <> 'AT_CUSTOMER' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Vous devez être chez le client (AT_CUSTOMER).');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_mission.order_id;
  IF v_order.id IS NULL OR v_order.status <> 'VALIDATED' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'La commande n''est plus au statut validé.');
  END IF;

  SELECT * INTO v_rev
  FROM public.order_revisions
  WHERE mission_id = p_mission_id AND status = 'PENDING_AGREEMENT';

  IF v_rev.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Aucune révision en attente.');
  END IF;

  -- Contrôle paiements existants
  SELECT COALESCE(SUM(amount), 0) INTO v_payments_sum
  FROM public.payments
  WHERE order_id = v_order.id AND is_reversal = false;

  IF v_rev.total_after < v_payments_sum THEN
    RETURN jsonb_build_object(
      'ok', false,
      'message', format('Le nouveau total (%s FCFA) est inférieur aux paiements déjà enregistrés (%s FCFA).', v_rev.total_after, v_payments_sum)
    );
  END IF;

  -- 1. Marquer UNVERIFIED_AGREEMENT
  UPDATE public.order_revisions
  SET status = 'UNVERIFIED_AGREEMENT',
      verification_type = 'UNVERIFIED_DECLARATION',
      unverified_reason = v_clean_reason,
      confirmed_at = NOW(),
      confirmed_by = auth.uid()
  WHERE id = v_rev.id;

  -- 2. Appliquer les modifications sur order_items
  FOR v_line IN SELECT * FROM public.order_revision_lines WHERE revision_id = v_rev.id
  LOOP
    IF v_line.order_item_id IS NOT NULL THEN
      IF v_line.qty_after = 0 THEN
        DELETE FROM public.order_items WHERE id = v_line.order_item_id;
      ELSE
        UPDATE public.order_items
        SET quantity = v_line.qty_after,
            line_total = v_line.qty_after * unit_price,
            item_type = COALESCE(v_line.item_type, item_type),
            color = COALESCE(v_line.color, color),
            pattern = COALESCE(v_line.pattern, pattern),
            brand = COALESCE(v_line.brand, brand),
            size = COALESCE(v_line.size, size),
            item_notes = COALESCE(v_line.item_notes, item_notes)
        WHERE id = v_line.order_item_id;
      END IF;
    ELSIF v_line.qty_after > 0 THEN
      INSERT INTO public.order_items (
        organization_id, order_id, service_id, service_name,
        quantity, unit_price, line_total,
        item_type, color, pattern, brand, size, item_notes
      ) VALUES (
        v_rev.organization_id, v_rev.order_id, v_line.service_id, v_line.service_name,
        v_line.qty_after, v_line.unit_price, v_line.line_total_after,
        v_line.item_type, v_line.color, v_line.pattern, v_line.brand, v_line.size, v_line.item_notes
      );
    END IF;
  END LOOP;

  -- 3. Mise à jour commande
  UPDATE public.orders
  SET subtotal = v_rev.subtotal_after,
      total_amount = v_rev.total_after,
      updated_at = NOW()
  WHERE id = v_rev.order_id;

  -- 4. Marquer le contrôle comme CORRECTED
  UPDATE public.delivery_missions
  SET pickup_check_status = 'CORRECTED',
      updated_at = NOW()
  WHERE id = p_mission_id;

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Accord non vérifié enregistré. Une alerte a été transmise au propriétaire.',
    'total_amount', v_rev.total_after
  );
END;
$$;

-- 6f. Refus de la révision par le client
CREATE OR REPLACE FUNCTION public.reject_order_revision(
  p_mission_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_mission public.delivery_missions;
  v_rev public.order_revisions;
BEGIN
  PERFORM set_config('app.in_rpc', 'true', true);

  SELECT * INTO v_mission FROM public.delivery_missions WHERE id = p_mission_id;
  IF v_mission.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Mission introuvable.');
  END IF;

  IF v_mission.assigned_to IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Seul le livreur attribué peut effectuer cette action.');
  END IF;

  SELECT * INTO v_rev
  FROM public.order_revisions
  WHERE mission_id = p_mission_id AND status = 'PENDING_AGREEMENT';

  IF v_rev.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Aucune révision en attente.');
  END IF;

  UPDATE public.order_revisions
  SET status = 'REJECTED',
      notes = COALESCE(notes, '') || CASE WHEN p_reason IS NOT NULL THEN ' [Refus : ' || p_reason || ']' ELSE '' END
  WHERE id = v_rev.id;

  RETURN jsonb_build_object('ok', true, 'message', 'Révision marquée comme refusée.');
END;
$$;

-- 6g. Contrôle chez le client CONFORME (aucun vêtement modifié)
CREATE OR REPLACE FUNCTION public.confirm_pickup_conform(p_mission_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_mission public.delivery_missions;
  v_order public.orders;
BEGIN
  PERFORM set_config('app.in_rpc', 'true', true);

  SELECT * INTO v_mission FROM public.delivery_missions WHERE id = p_mission_id;
  IF v_mission.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Mission introuvable.');
  END IF;

  IF v_mission.assigned_to IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Seul le livreur attribué peut confirmer la conformité.');
  END IF;

  IF v_mission.status <> 'AT_CUSTOMER' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Vous devez être chez le client (AT_CUSTOMER).');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_mission.order_id;
  IF v_order.id IS NULL OR v_order.status <> 'VALIDATED' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'La commande n''est plus au statut validé.');
  END IF;

  UPDATE public.delivery_missions
  SET pickup_check_status = 'CONFORM',
      updated_at = NOW()
  WHERE id = p_mission_id;

  RETURN jsonb_build_object('ok', true, 'message', 'Contrôle conforme enregistré avec succès.');
END;
$$;

-- 6h. Remplacement de advance_delivery_mission pour exiger pickup_check_status avant COLLECTED
CREATE OR REPLACE FUNCTION public.advance_delivery_mission(
  p_mission_id UUID,
  p_next_status TEXT,
  p_items_count INTEGER DEFAULT NULL
)
RETURNS public.delivery_missions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_mission public.delivery_missions;
  v_order public.orders;
  v_calculated_items INTEGER;
BEGIN
  PERFORM set_config('app.in_rpc', 'true', true);

  SELECT * INTO v_mission FROM public.delivery_missions WHERE id = p_mission_id;
  IF v_mission.id IS NULL THEN
    RAISE EXCEPTION 'Mission introuvable.';
  END IF;

  IF v_mission.assigned_to IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Seul le livreur attribué peut faire avancer cette mission.' USING ERRCODE = '42501';
  END IF;

  -- Transitions étape par étape
  IF v_mission.status = 'ACCEPTED' AND p_next_status = 'EN_ROUTE' THEN
    UPDATE public.delivery_missions
    SET status = 'EN_ROUTE', en_route_at = NOW(), updated_at = NOW()
    WHERE id = p_mission_id RETURNING * INTO v_mission;

  ELSIF v_mission.status = 'EN_ROUTE' AND p_next_status = 'AT_CUSTOMER' THEN
    UPDATE public.delivery_missions
    SET status = 'AT_CUSTOMER', at_customer_at = NOW(), updated_at = NOW()
    WHERE id = p_mission_id RETURNING * INTO v_mission;

  ELSIF v_mission.status = 'AT_CUSTOMER' AND p_next_status = 'COLLECTED' THEN
    -- CONTRÔLE CHEZ LE CLIENT OBLIGATOIRE (Règle 7)
    IF v_mission.pickup_check_status IS NULL THEN
      RAISE EXCEPTION 'Le contrôle chez le client doit être validé (conforme ou facture corrigée) avant d''enregistrer la collecte.';
    END IF;

    -- Calcul strict depuis les lignes de la commande
    SELECT COALESCE(SUM(quantity), 0) INTO v_calculated_items
    FROM public.order_items
    WHERE order_id = v_mission.order_id;

    -- Si un nombre a été saisi et qu'il diffère du total calculé, refuser
    IF p_items_count IS NOT NULL AND p_items_count <> v_calculated_items THEN
      RAISE EXCEPTION 'Le nombre de pièces saisi (%) ne correspond pas au total des articles de la commande (%). Corrigez la facture ou vérifiez le comptage.',
        p_items_count, v_calculated_items;
    END IF;

    UPDATE public.delivery_missions
    SET status = 'COLLECTED',
        items_count_collected = v_calculated_items,
        collected_at = NOW(),
        updated_at = NOW()
    WHERE id = p_mission_id RETURNING * INTO v_mission;

  ELSIF v_mission.status = 'COLLECTED' AND p_next_status = 'IN_TRANSIT' THEN
    UPDATE public.delivery_missions
    SET status = 'IN_TRANSIT', in_transit_at = NOW(), updated_at = NOW()
    WHERE id = p_mission_id RETURNING * INTO v_mission;

  ELSIF v_mission.status = 'IN_TRANSIT' AND p_next_status = 'AT_SHOP' THEN
    UPDATE public.delivery_missions
    SET status = 'AT_SHOP', at_shop_at = NOW(), updated_at = NOW()
    WHERE id = p_mission_id RETURNING * INTO v_mission;

  ELSE
    RAISE EXCEPTION 'Transition de statut non autorisée ou saut d''étape interdit (% -> %).', v_mission.status, p_next_status;
  END IF;

  RETURN v_mission;
END;
$$;

-- 6i. Consultation de la révision en attente par le client via son jeton de facture
-- ACCESSIBLE À anon ET authenticated
CREATE OR REPLACE FUNCTION public.get_pending_revision_for_customer(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_order public.orders;
  v_rev public.order_revisions;
  v_code TEXT;
  v_lines JSONB;
BEGIN
  -- 1. Récupération de la commande par jeton public de facture
  SELECT * INTO v_order FROM public.orders WHERE invoice_token = p_token;
  IF v_order.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Récupération de la révision en attente non expirée
  SELECT * INTO v_rev
  FROM public.order_revisions
  WHERE order_id = v_order.id
    AND status = 'PENDING_AGREEMENT'
    AND expires_at > NOW();

  IF v_rev.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 3. Calcul à la volée du code client de 6 chiffres
  v_code := public.compute_revision_otp_code(v_rev.id, v_rev.nonce);

  -- 4. Récupération des lignes avant / après
  SELECT jsonb_agg(
    jsonb_build_object(
      'service_name', l.service_name,
      'qty_before', l.qty_before,
      'qty_after', l.qty_after,
      'unit_price', l.unit_price,
      'line_total_before', l.line_total_before,
      'line_total_after', l.line_total_after,
      'color', l.color,
      'item_notes', l.item_notes
    )
  ) INTO v_lines
  FROM public.order_revision_lines l
  WHERE l.revision_id = v_rev.id;

  RETURN jsonb_build_object(
    'revision_id', v_rev.id,
    'version_number', v_rev.version_number,
    'code', v_code,
    'expires_at', v_rev.expires_at,
    'attempts_left', GREATEST(0, 5 - v_rev.attempts),
    'subtotal_before', v_rev.subtotal_before,
    'subtotal_after', v_rev.subtotal_after,
    'total_before', v_rev.total_before,
    'total_after', v_rev.total_after,
    'lines', COALESCE(v_lines, '[]'::jsonb)
  );
END;
$$;

-- 7. PERMISSIONS SUR LES FONCTIONS
REVOKE ALL ON FUNCTION public.compute_revision_otp_code FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_order_revision_draft FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.renew_order_revision_code FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_order_revision_otp FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_order_revision_unverified FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_order_revision FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_pickup_conform FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_pending_revision_for_customer FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_order_revision_draft TO authenticated;
GRANT EXECUTE ON FUNCTION public.renew_order_revision_code TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_order_revision_otp TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_order_revision_unverified TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_order_revision TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_pickup_conform TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_revision_for_customer TO PUBLIC, anon, authenticated;

-- Accès en lecture seule contrôlé par RLS
GRANT SELECT ON public.delivery_missions TO authenticated;
GRANT SELECT ON public.order_revisions TO authenticated;
GRANT SELECT ON public.order_revision_lines TO authenticated;
