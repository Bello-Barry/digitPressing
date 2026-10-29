-- =============================================================================
-- MIGRATION 20261026000000 : TÂCHE D1 - MISSIONS DE COLLECTE ET DE LIVRAISON
-- Multi-tenant, RLS strict, transitions d'états sécurisées, audit
-- =============================================================================

-- 1. EXTENSION DE ORGANIZATIONS (RÉMUNÉRATIONS LIVREURS)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS courier_pay_collection NUMERIC CHECK (courier_pay_collection >= 0),
  ADD COLUMN IF NOT EXISTS courier_pay_delivery NUMERIC CHECK (courier_pay_delivery >= 0);

-- 2. TABLE DELIVERY_MISSIONS
CREATE TABLE IF NOT EXISTS public.delivery_missions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id                UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  kind                    TEXT NOT NULL CHECK (kind IN ('COLLECTION', 'DELIVERY')),
  status                  TEXT NOT NULL CHECK (status IN (
                            'OPEN', 'ASSIGNED', 'ACCEPTED', 'EN_ROUTE',
                            'AT_CUSTOMER', 'COLLECTED', 'IN_TRANSIT',
                            'AT_SHOP', 'FAILED', 'CANCELLED'
                          )) DEFAULT 'OPEN',
  assigned_to             UUID NULL, -- livreur attribué (sans FK vers auth.users)
  pay_amount              NUMERIC NOT NULL CHECK (pay_amount >= 0),
  zone_label              VARCHAR(100) NOT NULL,
  instructions            VARCHAR(300) NULL,
  items_count_collected   INTEGER NULL CHECK (items_count_collected >= 0),
  created_by              UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Horodatages de chaque étape
  assigned_at             TIMESTAMPTZ NULL,
  accepted_at             TIMESTAMPTZ NULL,
  en_route_at             TIMESTAMPTZ NULL,
  at_customer_at          TIMESTAMPTZ NULL,
  collected_at            TIMESTAMPTZ NULL,
  in_transit_at           TIMESTAMPTZ NULL,
  at_shop_at              TIMESTAMPTZ NULL,

  -- Motifs d'annulation ou d'échec
  cancel_reason           TEXT NULL,
  fail_reason             TEXT NULL
);

-- Index d'optimisation
CREATE INDEX IF NOT EXISTS idx_delivery_missions_org_status ON public.delivery_missions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_delivery_missions_order ON public.delivery_missions(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_missions_assigned ON public.delivery_missions(organization_id, assigned_to);

-- Contrainte d'unicité partielle : une seule mission active par (order_id, kind)
CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_missions_active_unique
  ON public.delivery_missions(order_id, kind)
  WHERE status NOT IN ('CANCELLED', 'FAILED');

-- 3. SECURITÉ RLS ET DÉCLENCHEURS DE MUTATION DIRECTE

ALTER TABLE public.delivery_missions ENABLE ROW LEVEL SECURITY;

-- Suppression des anciennes politiques si réexécuté
DROP POLICY IF EXISTS "delivery_missions_owner_manager_read" ON public.delivery_missions;
DROP POLICY IF EXISTS "delivery_missions_cashier_read" ON public.delivery_missions;
DROP POLICY IF EXISTS "delivery_missions_courier_read" ON public.delivery_missions;

-- Lecture OWNER et MANAGER
CREATE POLICY "delivery_missions_owner_manager_read"
  ON public.delivery_missions FOR SELECT
  USING (
    organization_id = auth.get_user_org_id()
    AND public.catalog_has_role('OWNER', 'MANAGER')
  );

-- Lecture CASHIER (missions au pressing ou en transport vers le pressing)
CREATE POLICY "delivery_missions_cashier_read"
  ON public.delivery_missions FOR SELECT
  USING (
    organization_id = auth.get_user_org_id()
    AND public.catalog_has_role('CASHIER')
    AND status IN ('IN_TRANSIT', 'AT_SHOP')
  );

-- Lecture DELIVERY (uniquement les missions attribuées au livreur)
CREATE POLICY "delivery_missions_courier_read"
  ON public.delivery_missions FOR SELECT
  USING (
    organization_id = auth.get_user_org_id()
    AND assigned_to = auth.uid()
  );

-- Révocation des écritures directes (INSERT, UPDATE, DELETE, TRUNCATE) pour tous les rôles
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.delivery_missions FROM PUBLIC, anon, authenticated;

-- Déclencheur interdisant tout UPDATE/DELETE direct depuis le client (hors RPC autorisées)
CREATE OR REPLACE FUNCTION public.prevent_direct_delivery_missions_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.in_rpc', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Les modifications directes sur delivery_missions sont interdites. Utilisez les fonctions RPC.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_direct_delivery_missions_mutation ON public.delivery_missions;
CREATE TRIGGER trg_prevent_direct_delivery_missions_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.delivery_missions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_delivery_missions_mutation();

-- Déclencheur d'audit automatique AFTER
DROP TRIGGER IF EXISTS trg_audit_delivery_missions ON public.delivery_missions;
CREATE TRIGGER trg_audit_delivery_missions
  AFTER INSERT OR UPDATE OR DELETE ON public.delivery_missions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generic_audit_log();

-- 4. FONCTIONS RPC SÉCURISÉES (SECURITY DEFINER)

-- 4a. Création d'une mission (OWNER, MANAGER, CASHIER)
CREATE OR REPLACE FUNCTION public.create_delivery_mission(
  p_order_id UUID,
  p_kind TEXT,
  p_assigned_to UUID DEFAULT NULL,
  p_zone_label TEXT DEFAULT '',
  p_instructions TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID;
  v_order_status order_status;
  v_order_mode order_mode;
  v_pickup_addr TEXT;
  v_delivery_addr TEXT;
  v_pay_amount NUMERIC;
  v_assigned_valid BOOLEAN := FALSE;
  v_initial_status TEXT := 'OPEN';
  v_assigned_at TIMESTAMPTZ := NULL;
  v_zone TEXT;
  v_mission_id UUID;
BEGIN
  PERFORM set_config('app.in_rpc', 'true', true);

  v_org_id := auth.get_user_org_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié ou sans organisation.' USING ERRCODE = '42501';
  END IF;

  -- Vérification du rôle : OWNER, MANAGER, CASHIER
  IF NOT public.catalog_has_role('OWNER', 'MANAGER', 'CASHIER') THEN
    RAISE EXCEPTION 'Permission insuffisante pour créer une mission.' USING ERRCODE = '42501';
  END IF;

  -- Vérification du type de mission
  IF p_kind NOT IN ('COLLECTION', 'DELIVERY') THEN
    RAISE EXCEPTION 'Type de mission invalide (COLLECTION ou DELIVERY requis).';
  END IF;

  -- Validation des instructions
  IF p_instructions IS NOT NULL AND char_length(p_instructions) > 300 THEN
    RAISE EXCEPTION 'Les consignes ne peuvent pas dépasser 300 caractères.';
  END IF;

  -- Récupération de la commande
  SELECT status, mode, pickup_address, delivery_address
  INTO v_order_status, v_order_mode, v_pickup_addr, v_delivery_addr
  FROM public.orders
  WHERE id = p_order_id AND organization_id = v_org_id;

  IF v_order_status IS NULL THEN
    RAISE EXCEPTION 'Commande introuvable dans votre organisation.';
  END IF;

  IF v_order_status IN ('CANCELLED', 'REJECTED') THEN
    RAISE EXCEPTION 'Impossible de créer une mission pour une commande annulée ou rejetée.';
  END IF;

  -- Compatibilité kind vs order.mode
  IF p_kind = 'COLLECTION' AND v_order_mode NOT IN ('PICKUP', 'DELIVERY') THEN
    RAISE EXCEPTION 'Une collecte ne peut être créée que pour une commande à collecter (mode Enlèvement ou Collecte & Livraison).';
  END IF;

  IF p_kind = 'DELIVERY' AND v_order_mode NOT IN ('DELIVERY') THEN
    RAISE EXCEPTION 'Une livraison ne peut être créée que pour une commande avec livraison à domicile.';
  END IF;

  -- Récupération de la rémunération configurée dans l'organisation
  IF p_kind = 'COLLECTION' THEN
    SELECT courier_pay_collection INTO v_pay_amount FROM public.organizations WHERE id = v_org_id;
  ELSE
    SELECT courier_pay_delivery INTO v_pay_amount FROM public.organizations WHERE id = v_org_id;
  END IF;

  IF v_pay_amount IS NULL THEN
    RAISE EXCEPTION 'Définissez la rémunération dans Paramètres';
  END IF;

  -- Validation de l'attribution initiale si fournie
  IF p_assigned_to IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.memberships
      WHERE user_id = p_assigned_to
        AND organization_id = v_org_id
        AND role = 'DELIVERY'
        AND is_active = true
    ) INTO v_assigned_valid;

    IF v_assigned_valid THEN
      v_initial_status := 'ASSIGNED';
      v_assigned_at := NOW();
    ELSE
      p_assigned_to := NULL;
    END IF;
  END IF;

  -- Label de zone par défaut
  v_zone := btrim(COALESCE(p_zone_label, ''));
  IF char_length(v_zone) = 0 THEN
    IF p_kind = 'COLLECTION' THEN
      v_zone := COALESCE(v_pickup_addr, 'Zone générale');
    ELSE
      v_zone := COALESCE(v_delivery_addr, 'Zone générale');
    END IF;
  END IF;
  IF char_length(v_zone) > 100 THEN
    v_zone := substring(v_zone from 1 for 100);
  END IF;

  -- Insertion de la mission
  INSERT INTO public.delivery_missions (
    organization_id, order_id, kind, status, assigned_to,
    pay_amount, zone_label, instructions, created_by,
    assigned_at, created_at, updated_at
  ) VALUES (
    v_org_id, p_order_id, p_kind, v_initial_status, p_assigned_to,
    v_pay_amount, v_zone, p_instructions, auth.uid(),
    v_assigned_at, NOW(), NOW()
  )
  RETURNING id INTO v_mission_id;

  RETURN v_mission_id;
END;
$$;

-- 4b. Acceptation atomique et idempotente (DELIVERY)
CREATE OR REPLACE FUNCTION public.accept_delivery_mission(p_mission_id UUID)
RETURNS public.delivery_missions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_mission public.delivery_missions;
BEGIN
  PERFORM set_config('app.in_rpc', 'true', true);

  v_user_id := auth.uid();
  v_org_id := auth.get_user_org_id();

  IF v_org_id IS NULL OR NOT public.catalog_has_role('DELIVERY') THEN
    RAISE EXCEPTION 'Seul un livreur actif de l''organisation peut accepter une mission.' USING ERRCODE = '42501';
  END IF;

  -- Contrôle d'idempotence : si le livreur actuel a déjà accepté la mission
  SELECT * INTO v_mission
  FROM public.delivery_missions
  WHERE id = p_mission_id AND organization_id = v_org_id;

  IF v_mission.id IS NULL THEN
    RAISE EXCEPTION 'Mission introuvable dans votre organisation.';
  END IF;

  IF v_mission.assigned_to = v_user_id AND v_mission.status = 'ACCEPTED' THEN
    RETURN v_mission;
  END IF;

  -- Mise à jour conditionnelle atomique avec RETURNING
  UPDATE public.delivery_missions
  SET status = 'ACCEPTED',
      assigned_to = v_user_id,
      accepted_at = COALESCE(accepted_at, NOW()),
      updated_at = NOW()
  WHERE id = p_mission_id
    AND organization_id = v_org_id
    AND (
      (status = 'OPEN' AND (assigned_to IS NULL OR assigned_to = v_user_id))
      OR (status = 'ASSIGNED' AND assigned_to = v_user_id)
    )
  RETURNING * INTO v_mission;

  IF v_mission.id IS NULL THEN
    RAISE EXCEPTION 'Cette mission a déjà été prise';
  END IF;

  RETURN v_mission;
END;
$$;

-- 4c. Refus de mission (Livreur attribué ou OWNER/MANAGER)
CREATE OR REPLACE FUNCTION public.decline_delivery_mission(
  p_mission_id UUID,
  p_reason TEXT
)
RETURNS public.delivery_missions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_mission public.delivery_missions;
BEGIN
  PERFORM set_config('app.in_rpc', 'true', true);

  v_user_id := auth.uid();
  v_org_id := auth.get_user_org_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié.' USING ERRCODE = '42501';
  END IF;

  IF btrim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'Un motif de refus est obligatoire.';
  END IF;

  SELECT * INTO v_mission
  FROM public.delivery_missions
  WHERE id = p_mission_id AND organization_id = v_org_id;

  IF v_mission.id IS NULL THEN
    RAISE EXCEPTION 'Mission introuvable.';
  END IF;

  -- Seul le livreur attribué ou un responsable peut refuser
  IF v_mission.assigned_to IS DISTINCT FROM v_user_id AND NOT public.catalog_has_role('OWNER', 'MANAGER') THEN
    RAISE EXCEPTION 'Vous n''êtes pas autorisé à refuser cette mission.' USING ERRCODE = '42501';
  END IF;

  IF v_mission.status IN ('CANCELLED', 'FAILED', 'AT_SHOP') THEN
    RAISE EXCEPTION 'Impossible de refuser une mission clôturée ou terminée.';
  END IF;

  UPDATE public.delivery_missions
  SET status = 'OPEN',
      assigned_to = NULL,
      assigned_at = NULL,
      cancel_reason = btrim(p_reason),
      updated_at = NOW()
  WHERE id = p_mission_id AND organization_id = v_org_id
  RETURNING * INTO v_mission;

  RETURN v_mission;
END;
$$;

-- 4d. Réattribution de mission (OWNER, MANAGER)
CREATE OR REPLACE FUNCTION public.reassign_delivery_mission(
  p_mission_id UUID,
  p_new_assignee UUID,
  p_reason TEXT
)
RETURNS public.delivery_missions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID;
  v_mission public.delivery_missions;
  v_valid_courier BOOLEAN := FALSE;
  v_new_status TEXT := 'ASSIGNED';
BEGIN
  PERFORM set_config('app.in_rpc', 'true', true);

  v_org_id := auth.get_user_org_id();

  IF v_org_id IS NULL OR NOT public.catalog_has_role('OWNER', 'MANAGER') THEN
    RAISE EXCEPTION 'Réattribution réservée au Propriétaire et au Manager.' USING ERRCODE = '42501';
  END IF;

  IF btrim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'Un motif de réattribution est obligatoire.';
  END IF;

  IF p_new_assignee IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.memberships
      WHERE user_id = p_new_assignee
        AND organization_id = v_org_id
        AND role = 'DELIVERY'
        AND is_active = true
    ) INTO v_valid_courier;

    IF NOT v_valid_courier THEN
      RAISE EXCEPTION 'Le membre spécifié n''est pas un livreur actif de votre organisation.';
    END IF;
  ELSE
    v_new_status := 'OPEN';
  END IF;

  UPDATE public.delivery_missions
  SET status = v_new_status,
      assigned_to = p_new_assignee,
      assigned_at = CASE WHEN p_new_assignee IS NOT NULL THEN NOW() ELSE NULL END,
      cancel_reason = btrim(p_reason),
      updated_at = NOW()
  WHERE id = p_mission_id AND organization_id = v_org_id
  RETURNING * INTO v_mission;

  IF v_mission.id IS NULL THEN
    RAISE EXCEPTION 'Mission introuvable.';
  END IF;

  RETURN v_mission;
END;
$$;

-- 4e. Annulation de mission (OWNER, MANAGER)
CREATE OR REPLACE FUNCTION public.cancel_delivery_mission(
  p_mission_id UUID,
  p_reason TEXT
)
RETURNS public.delivery_missions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID;
  v_mission public.delivery_missions;
BEGIN
  PERFORM set_config('app.in_rpc', 'true', true);

  v_org_id := auth.get_user_org_id();

  IF v_org_id IS NULL OR NOT public.catalog_has_role('OWNER', 'MANAGER') THEN
    RAISE EXCEPTION 'L''annulation de mission est réservée au Propriétaire et au Manager.' USING ERRCODE = '42501';
  END IF;

  IF btrim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'Un motif d''annulation est obligatoire.';
  END IF;

  UPDATE public.delivery_missions
  SET status = 'CANCELLED',
      cancel_reason = btrim(p_reason),
      updated_at = NOW()
  WHERE id = p_mission_id AND organization_id = v_org_id
  RETURNING * INTO v_mission;

  IF v_mission.id IS NULL THEN
    RAISE EXCEPTION 'Mission introuvable.';
  END IF;

  RETURN v_mission;
END;
$$;

-- 4f. Avancement d'étape de mission (DELIVERY attribué UNIQUEMENT)
CREATE OR REPLACE FUNCTION public.advance_delivery_mission(
  p_mission_id UUID,
  p_next_status TEXT,
  p_items_count INTEGER DEFAULT NULL
)
RETURNS public.delivery_missions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_mission public.delivery_missions;
BEGIN
  PERFORM set_config('app.in_rpc', 'true', true);

  v_user_id := auth.uid();
  v_org_id := auth.get_user_org_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_mission
  FROM public.delivery_missions
  WHERE id = p_mission_id AND organization_id = v_org_id;

  IF v_mission.id IS NULL THEN
    RAISE EXCEPTION 'Mission introuvable.';
  END IF;

  -- Seul le livreur attribué peut faire avancer sa mission
  IF v_mission.assigned_to IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Seul le livreur attribué peut faire avancer cette mission.' USING ERRCODE = '42501';
  END IF;

  -- Contrôle strict des transitions étape par étape
  IF v_mission.status = 'ACCEPTED' AND p_next_status = 'EN_ROUTE' THEN
    UPDATE public.delivery_missions
    SET status = 'EN_ROUTE', en_route_at = NOW(), updated_at = NOW()
    WHERE id = p_mission_id RETURNING * INTO v_mission;

  ELSIF v_mission.status = 'EN_ROUTE' AND p_next_status = 'AT_CUSTOMER' THEN
    UPDATE public.delivery_missions
    SET status = 'AT_CUSTOMER', at_customer_at = NOW(), updated_at = NOW()
    WHERE id = p_mission_id RETURNING * INTO v_mission;

  ELSIF v_mission.status = 'AT_CUSTOMER' AND p_next_status = 'COLLECTED' THEN
    IF p_items_count IS NULL OR p_items_count < 0 THEN
      RAISE EXCEPTION 'Le nombre de pièces collectées (≥ 0) est obligatoire pour confirmer la collecte.';
    END IF;
    UPDATE public.delivery_missions
    SET status = 'COLLECTED',
        items_count_collected = p_items_count,
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

-- 4g. Déclaration d'échec de mission (DELIVERY attribué UNIQUEMENT)
CREATE OR REPLACE FUNCTION public.fail_delivery_mission(
  p_mission_id UUID,
  p_reason TEXT
)
RETURNS public.delivery_missions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_mission public.delivery_missions;
BEGIN
  PERFORM set_config('app.in_rpc', 'true', true);

  v_user_id := auth.uid();
  v_org_id := auth.get_user_org_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié.' USING ERRCODE = '42501';
  END IF;

  IF btrim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'Le motif d''échec est obligatoire.';
  END IF;

  SELECT * INTO v_mission
  FROM public.delivery_missions
  WHERE id = p_mission_id AND organization_id = v_org_id;

  IF v_mission.id IS NULL THEN
    RAISE EXCEPTION 'Mission introuvable.';
  END IF;

  IF v_mission.assigned_to IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Seul le livreur attribué peut signaler un échec.' USING ERRCODE = '42501';
  END IF;

  IF v_mission.status NOT IN ('ACCEPTED', 'EN_ROUTE', 'AT_CUSTOMER', 'COLLECTED', 'IN_TRANSIT') THEN
    RAISE EXCEPTION 'Impossible de signaler un échec pour une mission à ce statut.';
  END IF;

  -- Marquer la mission en FAILED sans toucher au statut de la commande
  UPDATE public.delivery_missions
  SET status = 'FAILED',
      fail_reason = btrim(p_reason),
      updated_at = NOW()
  WHERE id = p_mission_id AND organization_id = v_org_id
  RETURNING * INTO v_mission;

  RETURN v_mission;
END;
$$;

-- 4h. Consultation des détails confidentiels d'une mission
CREATE OR REPLACE FUNCTION public.get_mission_details(p_mission_id UUID)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  order_id UUID,
  kind TEXT,
  status TEXT,
  assigned_to UUID,
  pay_amount NUMERIC,
  zone_label VARCHAR(100),
  instructions VARCHAR(300),
  items_count_collected INTEGER,
  client_name VARCHAR(255),
  client_phone VARCHAR(30),
  address TEXT,
  request_code VARCHAR(20),
  ticket_number VARCHAR(20),
  created_at TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  en_route_at TIMESTAMPTZ,
  at_customer_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ,
  in_transit_at TIMESTAMPTZ,
  at_shop_at TIMESTAMPTZ,
  cancel_reason TEXT,
  fail_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_m public.delivery_missions;
BEGIN
  v_user_id := auth.uid();
  v_org_id := auth.get_user_org_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_m
  FROM public.delivery_missions
  WHERE delivery_missions.id = p_mission_id AND delivery_missions.organization_id = v_org_id;

  IF v_m.id IS NULL THEN
    RAISE EXCEPTION 'Mission introuvable.';
  END IF;

  -- Accès aux coordonnées confidentielles du client :
  -- Uniquement si l'appelant est OWNER/MANAGER OU s'il est le livreur attribué ET (mission active OU clôturée depuis < 7 jours)
  IF NOT (
    public.catalog_has_role('OWNER', 'MANAGER')
    OR (
      v_m.assigned_to = v_user_id
      AND (
        v_m.status NOT IN ('FAILED', 'CANCELLED', 'AT_SHOP')
        OR v_m.updated_at >= NOW() - INTERVAL '7 days'
      )
    )
  ) THEN
    RAISE EXCEPTION 'Accès refusé aux détails confidentiels de cette mission.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.organization_id,
    m.order_id,
    m.kind,
    m.status,
    m.assigned_to,
    m.pay_amount,
    m.zone_label,
    m.instructions,
    m.items_count_collected,
    o.client_name,
    o.client_phone,
    CASE WHEN m.kind = 'COLLECTION' THEN o.pickup_address ELSE o.delivery_address END AS address,
    o.request_code,
    o.ticket_number,
    m.created_at,
    m.assigned_at,
    m.accepted_at,
    m.en_route_at,
    m.at_customer_at,
    m.collected_at,
    m.in_transit_at,
    m.at_shop_at,
    m.cancel_reason,
    m.fail_reason
  FROM public.delivery_missions m
  JOIN public.orders o ON o.id = m.order_id
  WHERE m.id = p_mission_id;
END;
$$;

-- 4i. Liste anonymisée des missions disponibles (OPEN) pour le livreur
CREATE OR REPLACE FUNCTION public.list_open_missions()
RETURNS TABLE (
  id UUID,
  kind TEXT,
  zone_label VARCHAR(100),
  pay_amount NUMERIC,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  v_org_id := auth.get_user_org_id();

  IF v_org_id IS NULL OR NOT public.catalog_has_role('DELIVERY') THEN
    RAISE EXCEPTION 'Accès réservé aux livreurs actifs.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.kind,
    m.zone_label,
    m.pay_amount,
    m.created_at
  FROM public.delivery_missions m
  WHERE m.organization_id = v_org_id
    AND m.status = 'OPEN'
    AND m.assigned_to IS NULL
  ORDER BY m.created_at DESC;
END;
$$;

-- 5. CONFIGURATION DES PERMISSIONS EXECUTE SUR LES RPC
REVOKE ALL ON FUNCTION public.create_delivery_mission FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_delivery_mission FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decline_delivery_mission FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reassign_delivery_mission FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_delivery_mission FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.advance_delivery_mission FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_delivery_mission FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_mission_details FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_open_missions FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_delivery_mission TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_delivery_mission TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_delivery_mission TO authenticated;
GRANT EXECUTE ON FUNCTION public.reassign_delivery_mission TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_delivery_mission TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_delivery_mission TO authenticated;
GRANT EXECUTE ON FUNCTION public.fail_delivery_mission TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mission_details TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_open_missions TO authenticated;
