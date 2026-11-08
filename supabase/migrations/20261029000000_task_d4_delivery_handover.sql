-- =============================================================================
-- MIGRATION 20261029000000 : TÂCHE D4 - LIVRAISON, PAIEMENT, REMISE DE CAISSE
-- Le client confirme la remise avec un code court affiché sur son suivi.
-- Les livreurs enregistrent leurs paiements via RPC et remettent le liquide.
-- Migration à appliquer manuellement après validation.
-- =============================================================================

-- 1. Liens idempotents entre les paiements pris par les livreurs et leur mission.
ALTER TABLE public.delivery_missions
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.delivery_missions DROP CONSTRAINT IF EXISTS delivery_missions_status_check;
ALTER TABLE public.delivery_missions ADD CONSTRAINT delivery_missions_status_check
  CHECK (status IN ('OPEN','ASSIGNED','ACCEPTED','EN_ROUTE','AT_CUSTOMER','COLLECTED','IN_TRANSIT','AT_SHOP','COMPLETED','FAILED','CANCELLED'));
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS delivery_mission_id UUID REFERENCES public.delivery_missions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS idempotency_key UUID;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_delivery_request_unique
  ON public.payments(delivery_mission_id, idempotency_key)
  WHERE delivery_mission_id IS NOT NULL AND idempotency_key IS NOT NULL;

INSERT INTO public.private_secrets (key, value)
VALUES ('delivery_otp_secret', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.delivery_confirmation_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  mission_id UUID NOT NULL UNIQUE REFERENCES public.delivery_missions(id) ON DELETE RESTRICT,
  nonce INTEGER NOT NULL DEFAULT 1 CHECK (nonce > 0),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.delivery_cash_handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  courier_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED', 'DISCREPANCY')) DEFAULT 'PENDING',
  expected_cash_amount NUMERIC(12,2) NOT NULL CHECK (expected_cash_amount >= 0),
  declared_amount NUMERIC(12,2) NOT NULL CHECK (declared_amount >= 0),
  counted_amount NUMERIC(12,2),
  discrepancy NUMERIC(12,2),
  resolution_note TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT delivery_cash_handover_validation CHECK (
    (status = 'PENDING' AND counted_amount IS NULL AND validated_by IS NULL AND validated_at IS NULL)
    OR (status = 'CONFIRMED' AND counted_amount IS NOT NULL AND validated_by IS NOT NULL AND validated_at IS NOT NULL AND discrepancy = 0)
    OR (status = 'DISCREPANCY' AND counted_amount IS NOT NULL AND validated_by IS NOT NULL AND validated_at IS NOT NULL
      AND discrepancy IS NOT NULL AND discrepancy <> 0 AND length(btrim(COALESCE(resolution_note, ''))) >= 5)
  )
);

CREATE TABLE IF NOT EXISTS public.delivery_cash_handover_lines (
  payment_id UUID PRIMARY KEY REFERENCES public.payments(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  handover_id UUID NOT NULL REFERENCES public.delivery_cash_handovers(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_delivery_cash_handover_org_status
  ON public.delivery_cash_handovers(organization_id, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_cash_handover_courier
  ON public.delivery_cash_handovers(organization_id, courier_id, submitted_at DESC);

ALTER TABLE public.delivery_confirmation_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_cash_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_cash_handover_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delivery_confirmation_challenges_staff_read ON public.delivery_confirmation_challenges;
CREATE POLICY delivery_confirmation_challenges_staff_read ON public.delivery_confirmation_challenges FOR SELECT
  USING (public.catalog_has_role(organization_id, ARRAY['OWNER','MANAGER']::text[]));
DROP POLICY IF EXISTS delivery_cash_handovers_read ON public.delivery_cash_handovers;
CREATE POLICY delivery_cash_handovers_read ON public.delivery_cash_handovers FOR SELECT
  USING (
    public.catalog_has_role(organization_id, ARRAY['OWNER','MANAGER','CASHIER']::text[])
    OR (courier_id = auth.uid() AND public.catalog_has_role(organization_id, ARRAY['DELIVERY']::text[]))
  );
DROP POLICY IF EXISTS delivery_cash_handover_lines_read ON public.delivery_cash_handover_lines;
CREATE POLICY delivery_cash_handover_lines_read ON public.delivery_cash_handover_lines FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.delivery_cash_handovers h
    WHERE h.id = delivery_cash_handover_lines.handover_id AND h.organization_id = delivery_cash_handover_lines.organization_id
      AND (public.catalog_has_role(h.organization_id, ARRAY['OWNER','MANAGER','CASHIER']::text[])
        OR (h.courier_id = auth.uid() AND public.catalog_has_role(h.organization_id, ARRAY['DELIVERY']::text[])))
  ));

REVOKE ALL ON public.delivery_confirmation_challenges FROM PUBLIC, anon;
REVOKE ALL ON public.delivery_cash_handovers FROM PUBLIC, anon;
REVOKE ALL ON public.delivery_cash_handover_lines FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.delivery_confirmation_challenges FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.delivery_cash_handovers FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.delivery_cash_handover_lines FROM authenticated;
GRANT SELECT ON public.delivery_confirmation_challenges, public.delivery_cash_handovers, public.delivery_cash_handover_lines TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_direct_delivery_d4_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('app.in_rpc', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Utilisez une action D4 autorisée.' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.prevent_direct_delivery_d4_mutation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prevent_delivery_d4_challenge_mutation ON public.delivery_confirmation_challenges;
CREATE TRIGGER trg_prevent_delivery_d4_challenge_mutation BEFORE INSERT OR UPDATE OR DELETE ON public.delivery_confirmation_challenges
  FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_delivery_d4_mutation();
DROP TRIGGER IF EXISTS trg_prevent_delivery_cash_handover_mutation ON public.delivery_cash_handovers;
CREATE TRIGGER trg_prevent_delivery_cash_handover_mutation BEFORE INSERT OR UPDATE OR DELETE ON public.delivery_cash_handovers
  FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_delivery_d4_mutation();
DROP TRIGGER IF EXISTS trg_prevent_delivery_cash_handover_line_mutation ON public.delivery_cash_handover_lines;
CREATE TRIGGER trg_prevent_delivery_cash_handover_line_mutation BEFORE INSERT OR UPDATE OR DELETE ON public.delivery_cash_handover_lines
  FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_delivery_d4_mutation();

DROP TRIGGER IF EXISTS trg_audit_delivery_confirmation_challenges ON public.delivery_confirmation_challenges;
CREATE TRIGGER trg_audit_delivery_confirmation_challenges AFTER INSERT OR UPDATE OR DELETE ON public.delivery_confirmation_challenges
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generic_audit_log();
DROP TRIGGER IF EXISTS trg_audit_delivery_cash_handovers ON public.delivery_cash_handovers;
CREATE TRIGGER trg_audit_delivery_cash_handovers AFTER INSERT OR UPDATE OR DELETE ON public.delivery_cash_handovers
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generic_audit_log();
DROP TRIGGER IF EXISTS trg_audit_delivery_cash_handover_lines ON public.delivery_cash_handover_lines;
CREATE TRIGGER trg_audit_delivery_cash_handover_lines AFTER INSERT OR UPDATE OR DELETE ON public.delivery_cash_handover_lines
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generic_audit_log();

-- Delivery missions can only be created for READY orders.
CREATE OR REPLACE FUNCTION public.validate_delivery_mission_is_ready()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status public.order_status;
BEGIN
  IF NEW.kind = 'DELIVERY' THEN
    SELECT status INTO v_status FROM public.orders WHERE id = NEW.order_id AND organization_id = NEW.organization_id FOR UPDATE;
    IF v_status IS DISTINCT FROM 'READY' OR NOT EXISTS (
      SELECT 1 FROM public.orders WHERE id = NEW.order_id AND organization_id = NEW.organization_id AND mode = 'DELIVERY'
    ) THEN
      RAISE EXCEPTION 'Une mission de livraison ne peut commencer que pour une commande prête (READY).';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_delivery_mission_is_ready() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_validate_delivery_mission_is_ready ON public.delivery_missions;
CREATE TRIGGER trg_validate_delivery_mission_is_ready BEFORE INSERT ON public.delivery_missions
  FOR EACH ROW EXECUTE FUNCTION public.validate_delivery_mission_is_ready();

-- A delivery mission cannot use the COLLECTION-only COLLECTED transition.
CREATE OR REPLACE FUNCTION public.block_delivery_mission_collected_transition()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.kind = 'DELIVERY' AND OLD.status = 'AT_CUSTOMER' AND NEW.status = 'COLLECTED' THEN
    RAISE EXCEPTION 'Une mission de livraison doit être confirmée par le code du client.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.block_delivery_mission_collected_transition() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_block_delivery_mission_collected_transition ON public.delivery_missions;
CREATE TRIGGER trg_block_delivery_mission_collected_transition BEFORE UPDATE OF status ON public.delivery_missions
  FOR EACH ROW EXECUTE FUNCTION public.block_delivery_mission_collected_transition();

-- Create/rotate a fresh 30-minute challenge whenever the assigned courier arrives.
CREATE OR REPLACE FUNCTION public.prepare_delivery_confirmation_challenge()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kind = 'DELIVERY' AND NEW.status = 'AT_CUSTOMER' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.delivery_confirmation_challenges (organization_id, mission_id, nonce, attempts, expires_at)
    VALUES (NEW.organization_id, NEW.id, 1, 0, NOW() + INTERVAL '30 minutes')
    ON CONFLICT (mission_id) DO UPDATE SET nonce = public.delivery_confirmation_challenges.nonce + 1,
      attempts = 0, expires_at = NOW() + INTERVAL '30 minutes', confirmed_at = NULL, confirmed_by = NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.prepare_delivery_confirmation_challenge() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_prepare_delivery_confirmation_challenge ON public.delivery_missions;
CREATE TRIGGER trg_prepare_delivery_confirmation_challenge AFTER UPDATE OF status ON public.delivery_missions
  FOR EACH ROW EXECUTE FUNCTION public.prepare_delivery_confirmation_challenge();

-- Keep order delivery state changes behind the code-confirmation RPC for active missions.
CREATE OR REPLACE FUNCTION public.protect_mission_delivery_order_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'DELIVERED' AND OLD.status IS DISTINCT FROM NEW.status
    AND EXISTS (SELECT 1 FROM public.delivery_missions m WHERE m.order_id = NEW.id AND m.organization_id = NEW.organization_id
      AND m.kind = 'DELIVERY' AND m.status NOT IN ('FAILED','CANCELLED','COMPLETED'))
    AND current_setting('app.in_rpc', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'La livraison avec mission D4 doit être confirmée par le code à usage unique du client.' USING ERRCODE = '42501';
  END IF;
  IF NEW.delivery_override_by IS DISTINCT FROM OLD.delivery_override_by
    OR NEW.delivery_override_at IS DISTINCT FROM OLD.delivery_override_at
    OR NEW.delivery_override_note IS DISTINCT FROM OLD.delivery_override_note THEN
    IF current_setting('app.in_rpc', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'La dérogation de livraison doit être autorisée par le RPC responsable.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_mission_delivery_order_status() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_protect_mission_delivery_order_status ON public.orders;
CREATE TRIGGER trg_protect_mission_delivery_order_status BEFORE UPDATE OF status, delivery_override_by, delivery_override_at, delivery_override_note ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.protect_mission_delivery_order_status();

-- Internal code is deterministic but keyed by a private database secret and a rotating nonce.
CREATE OR REPLACE FUNCTION public.compute_delivery_confirmation_code(p_mission_id UUID, p_nonce INTEGER)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE v_secret TEXT; v_digest TEXT; v_value BIGINT;
BEGIN
  SELECT value INTO v_secret FROM public.private_secrets WHERE key = 'delivery_otp_secret';
  IF v_secret IS NULL THEN RAISE EXCEPTION 'Secret de confirmation introuvable.'; END IF;
  v_digest := encode(digest(v_secret || 'DELIVERY' || p_mission_id::text || p_nonce::text, 'sha256'), 'hex');
  v_value := ('x' || substring(v_digest from 1 for 8))::bit(32)::bigint;
  RETURN lpad((v_value % 900000 + 100000)::text, 6, '0');
END;
$$;
REVOKE ALL ON FUNCTION public.compute_delivery_confirmation_code(UUID, INTEGER) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_delivery_confirmation_for_customer(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE v_order public.orders; v_mission public.delivery_missions; v_challenge public.delivery_confirmation_challenges;
BEGIN
  IF p_token IS NULL OR length(btrim(p_token)) < 32 THEN RETURN NULL; END IF;
  SELECT * INTO v_order FROM public.orders WHERE invoice_token = btrim(p_token);
  IF v_order.id IS NULL OR v_order.status <> 'READY' THEN RETURN NULL; END IF;
  SELECT * INTO v_mission FROM public.delivery_missions
    WHERE order_id = v_order.id AND kind = 'DELIVERY' AND status = 'AT_CUSTOMER'
    ORDER BY updated_at DESC LIMIT 1;
  IF v_mission.id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO v_challenge FROM public.delivery_confirmation_challenges
    WHERE mission_id = v_mission.id AND confirmed_at IS NULL AND attempts < 5 AND expires_at > NOW();
  IF v_challenge.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('code', public.compute_delivery_confirmation_code(v_mission.id, v_challenge.nonce),
    'expires_at', v_challenge.expires_at, 'client_name', v_order.client_name);
END;
$$;
REVOKE ALL ON FUNCTION public.get_delivery_confirmation_for_customer(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_delivery_confirmation_for_customer(TEXT) TO anon, authenticated;

-- Prepare a WhatsApp message without exposing the raw invoice token in mission details.
CREATE OR REPLACE FUNCTION public.get_delivery_customer_whatsapp_link(p_mission_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions, pg_temp AS $$
DECLARE v_m public.delivery_missions; v_o public.orders; v_message TEXT; v_encoded TEXT; v_url TEXT;
BEGIN
  SELECT * INTO v_m FROM public.delivery_missions WHERE id = p_mission_id;
  IF v_m.id IS NULL OR v_m.kind <> 'DELIVERY' OR v_m.status <> 'AT_CUSTOMER'
    OR v_m.assigned_to IS DISTINCT FROM auth.uid()
    OR NOT public.catalog_has_role(v_m.organization_id, ARRAY['DELIVERY']::text[]) THEN
    RAISE EXCEPTION 'Lien client disponible uniquement au livreur assigné arrivé chez le client.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_o FROM public.orders WHERE id = v_m.order_id AND organization_id = v_m.organization_id;
  v_url := 'https://digitpressing.cg/f/' || v_o.invoice_token;
  v_message := format('Bonjour %s, votre livreur est arrivé pour remettre votre linge. Merci de consulter votre suivi et de lui communiquer le code de confirmation affiché : %s', v_o.client_name, v_url);
  v_encoded := replace(v_message, '%', '%25');
  v_encoded := replace(v_encoded, ' ', '%20');
  v_encoded := replace(v_encoded, '&', '%26');
  v_encoded := replace(v_encoded, '?', '%3F');
  v_encoded := replace(v_encoded, '#', '%23');
  v_encoded := replace(v_encoded, E'\n', '%0A');
  RETURN 'https://wa.me/' || regexp_replace(v_o.client_phone, '[^0-9]', '', 'g') || '?text=' || v_encoded;
END;
$$;
REVOKE ALL ON FUNCTION public.get_delivery_customer_whatsapp_link(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_delivery_customer_whatsapp_link(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_delivery_mission_payment(
  p_mission_id UUID, p_amount NUMERIC, p_method public.payment_method,
  p_reference TEXT, p_idempotency_key UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions, pg_temp AS $$
DECLARE v_m public.delivery_missions; v_o public.orders; v_balance NUMERIC; v_payment public.payments;
BEGIN
  PERFORM set_config('app.in_rpc','true',true);
  IF auth.uid() IS NULL OR p_idempotency_key IS NULL THEN RAISE EXCEPTION 'Authentification et clé de requête requises.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_m FROM public.delivery_missions WHERE id = p_mission_id FOR UPDATE;
  IF v_m.id IS NULL OR v_m.kind <> 'DELIVERY' OR v_m.assigned_to IS DISTINCT FROM auth.uid()
    OR v_m.status <> 'AT_CUSTOMER' OR NOT public.catalog_has_role(v_m.organization_id, ARRAY['DELIVERY']::text[]) THEN
    RAISE EXCEPTION 'Seul le livreur assigné, arrivé chez le client, peut encaisser.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_o FROM public.orders WHERE id = v_m.order_id AND organization_id = v_m.organization_id FOR UPDATE;
  IF v_o.status <> 'READY' THEN RAISE EXCEPTION 'La commande n’est plus au statut READY.'; END IF;
  SELECT balance_due INTO v_balance FROM public.order_payment_summary WHERE order_id = v_o.id;
  SELECT * INTO v_payment FROM public.payments WHERE delivery_mission_id = p_mission_id AND idempotency_key = p_idempotency_key;
  IF v_payment.id IS NOT NULL THEN
    RETURN jsonb_build_object('ok',true,'payment_id',v_payment.id,'amount',v_payment.amount,'method',v_payment.method,'idempotent',true);
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > COALESCE(v_balance,0) THEN RAISE EXCEPTION 'Montant invalide ou supérieur au solde dû.'; END IF;
  IF p_method NOT IN ('CASH','MTN_MOMO','AIRTEL_MONEY','OTHER') THEN RAISE EXCEPTION 'Mode de paiement invalide.'; END IF;
  INSERT INTO public.payments (organization_id, order_id, delivery_mission_id, idempotency_key, amount, method,
    reference, collected_by, collected_at, notes)
  VALUES (v_m.organization_id, v_o.id, p_mission_id, p_idempotency_key, p_amount, p_method,
    NULLIF(btrim(p_reference),''), auth.uid(), NOW(), 'Paiement collecté par le livreur lors de la mission D4')
  RETURNING * INTO v_payment;
  RETURN jsonb_build_object('ok',true,'payment_id',v_payment.id,'amount',v_payment.amount,'method',v_payment.method,'idempotent',false);
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_delivery_mission(p_mission_id UUID, p_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions, pg_temp AS $$
DECLARE v_m public.delivery_missions; v_o public.orders; v_ch public.delivery_confirmation_challenges; v_due NUMERIC; v_expected TEXT;
BEGIN
  PERFORM set_config('app.in_rpc','true',true);
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_m FROM public.delivery_missions WHERE id = p_mission_id FOR UPDATE;
  IF v_m.id IS NULL OR v_m.kind <> 'DELIVERY' OR v_m.status <> 'AT_CUSTOMER'
    OR v_m.assigned_to IS DISTINCT FROM auth.uid() OR NOT public.catalog_has_role(v_m.organization_id, ARRAY['DELIVERY']::text[]) THEN
    RAISE EXCEPTION 'Seul le livreur assigné arrivé chez le client peut finaliser cette mission.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_o FROM public.orders WHERE id = v_m.order_id AND organization_id = v_m.organization_id FOR UPDATE;
  IF v_o.status <> 'READY' THEN RAISE EXCEPTION 'La commande doit être READY avant sa remise.'; END IF;
  SELECT * INTO v_ch FROM public.delivery_confirmation_challenges WHERE mission_id = p_mission_id FOR UPDATE;
  IF v_ch.id IS NULL OR v_ch.confirmed_at IS NOT NULL OR v_ch.expires_at <= NOW() OR v_ch.attempts >= 5 THEN
    RETURN jsonb_build_object('ok',false,'message','Le code a expiré ou n’est plus utilisable.');
  END IF;
  v_expected := public.compute_delivery_confirmation_code(p_mission_id, v_ch.nonce);
  IF p_code IS NULL OR p_code !~ '^\d{6}$' OR p_code <> v_expected THEN
    UPDATE public.delivery_confirmation_challenges SET attempts = attempts + 1 WHERE id = v_ch.id;
    RETURN jsonb_build_object('ok',false,'message','Code incorrect.','attempts_left',GREATEST(0,4-v_ch.attempts));
  END IF;
  SELECT balance_due INTO v_due FROM public.order_payment_summary WHERE order_id = v_o.id;
  IF COALESCE(v_due,0) > 0 AND (v_o.delivery_override_by IS NULL OR length(btrim(COALESCE(v_o.delivery_override_note,''))) < 5) THEN
    RETURN jsonb_build_object('ok',false,'message','Le solde doit être payé ou une dérogation OWNER/MANAGER motivée doit être enregistrée avant la remise.');
  END IF;

  UPDATE public.delivery_confirmation_challenges SET confirmed_at = NOW(), confirmed_by = auth.uid() WHERE id = v_ch.id;
  UPDATE public.orders SET status = 'DELIVERED', delivered_by = auth.uid(), updated_at = NOW() WHERE id = v_o.id;
  UPDATE public.delivery_missions SET status = 'COMPLETED', completed_at = NOW(), updated_at = NOW() WHERE id = p_mission_id;
  RETURN jsonb_build_object('ok',true,'message','Remise confirmée par le client.');
END;
$$;

CREATE OR REPLACE FUNCTION public.authorize_unpaid_delivery(p_order_id UUID, p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions, pg_temp AS $$
DECLARE v_org UUID; v_order public.orders; v_due NUMERIC;
BEGIN
  PERFORM set_config('app.in_rpc','true',true);
  v_org := auth.get_user_org_id();
  IF v_org IS NULL OR NOT public.catalog_has_role(v_org, ARRAY['OWNER','MANAGER']::text[]) THEN
    RAISE EXCEPTION 'Dérogation réservée au OWNER ou MANAGER.' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(COALESCE(p_reason,''))) < 5 THEN RAISE EXCEPTION 'Un motif de cinq caractères minimum est obligatoire.'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND organization_id = v_org FOR UPDATE;
  IF v_order.id IS NULL OR v_order.status <> 'READY' OR v_order.mode <> 'DELIVERY' THEN RAISE EXCEPTION 'Commande de livraison READY introuvable.'; END IF;
  SELECT balance_due INTO v_due FROM public.order_payment_summary WHERE order_id = v_order.id;
  IF COALESCE(v_due,0) <= 0 THEN RAISE EXCEPTION 'Aucun solde dû ne nécessite une dérogation.'; END IF;
  UPDATE public.orders SET delivery_override_by = auth.uid(), delivery_override_at = NOW(),
    delivery_override_note = btrim(p_reason), updated_at = NOW() WHERE id = v_order.id;
  RETURN jsonb_build_object('ok',true,'balance_due',v_due);
END;
$$;

-- Cash payments are grouped once and require an in-person cashier/manager validation.
CREATE OR REPLACE FUNCTION public.list_unhanded_delivery_cash()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
DECLARE v_org UUID; v_rows JSONB;
BEGIN
  v_org := auth.get_user_org_id();
  IF v_org IS NULL OR NOT public.catalog_has_role(v_org, ARRAY['DELIVERY']::text[]) THEN RAISE EXCEPTION 'Livreur actif requis.' USING ERRCODE = '42501'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',p.id,'amount',p.amount,'collected_at',p.collected_at,
    'request_code',o.request_code,'ticket_number',o.ticket_number) ORDER BY p.collected_at,p.id),'[]'::jsonb)
  INTO v_rows FROM public.payments p JOIN public.orders o ON o.id = p.order_id
  WHERE p.organization_id = v_org AND p.collected_by = auth.uid() AND p.method = 'CASH'
    AND p.delivery_mission_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.delivery_cash_handover_lines l WHERE l.payment_id = p.id);
  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_delivery_cash_handover(p_declared_amount NUMERIC)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
DECLARE v_org UUID; v_expected NUMERIC; v_handover UUID; v_line RECORD;
BEGIN
  PERFORM set_config('app.in_rpc','true',true);
  v_org := auth.get_user_org_id();
  IF v_org IS NULL OR NOT public.catalog_has_role(v_org, ARRAY['DELIVERY']::text[]) THEN RAISE EXCEPTION 'Livreur actif requis.' USING ERRCODE = '42501'; END IF;
  IF p_declared_amount IS NULL OR p_declared_amount < 0 THEN RAISE EXCEPTION 'Montant déclaré invalide.'; END IF;
  PERFORM 1 FROM public.payments p WHERE p.organization_id = v_org AND p.collected_by = auth.uid()
    AND p.method = 'CASH' AND p.delivery_mission_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.delivery_cash_handover_lines l WHERE l.payment_id = p.id)
    FOR UPDATE;
  SELECT COALESCE(SUM(p.amount),0) INTO v_expected FROM public.payments p
    WHERE p.organization_id = v_org AND p.collected_by = auth.uid() AND p.method = 'CASH'
      AND p.delivery_mission_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.delivery_cash_handover_lines l WHERE l.payment_id = p.id);
  IF NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.organization_id = v_org AND p.collected_by = auth.uid()
    AND p.method = 'CASH' AND p.delivery_mission_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.delivery_cash_handover_lines l WHERE l.payment_id = p.id)) THEN
    RAISE EXCEPTION 'Aucun paiement espèces en attente de remise.';
  END IF;
  INSERT INTO public.delivery_cash_handovers (organization_id,courier_id,expected_cash_amount,declared_amount)
    VALUES (v_org,auth.uid(),v_expected,p_declared_amount) RETURNING id INTO v_handover;
  FOR v_line IN SELECT p.id FROM public.payments p WHERE p.organization_id = v_org AND p.collected_by = auth.uid()
    AND p.method = 'CASH' AND p.delivery_mission_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.delivery_cash_handover_lines l WHERE l.payment_id = p.id)
    FOR UPDATE
  LOOP
    INSERT INTO public.delivery_cash_handover_lines(payment_id,organization_id,handover_id)
      VALUES(v_line.id,v_org,v_handover);
  END LOOP;
  RETURN v_handover;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_delivery_cash_handover(
  p_handover_id UUID, p_counted_amount NUMERIC, p_resolution_note TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
DECLARE v_h public.delivery_cash_handovers; v_difference NUMERIC;
BEGIN
  PERFORM set_config('app.in_rpc','true',true);
  SELECT * INTO v_h FROM public.delivery_cash_handovers WHERE id = p_handover_id FOR UPDATE;
  IF v_h.id IS NULL THEN RAISE EXCEPTION 'Remise de caisse introuvable.'; END IF;
  IF NOT public.catalog_has_role(v_h.organization_id, ARRAY['OWNER','MANAGER','CASHIER']::text[]) OR v_h.courier_id = auth.uid() THEN
    RAISE EXCEPTION 'La remise doit être validée par un caissier ou responsable distinct du livreur.' USING ERRCODE = '42501';
  END IF;
  IF v_h.status <> 'PENDING' THEN RAISE EXCEPTION 'Cette remise a déjà été validée.'; END IF;
  IF p_counted_amount IS NULL OR p_counted_amount < 0 THEN RAISE EXCEPTION 'Montant compté invalide.'; END IF;
  v_difference := p_counted_amount - v_h.expected_cash_amount;
  IF v_difference <> 0 AND length(btrim(COALESCE(p_resolution_note,''))) < 5 THEN
    RAISE EXCEPTION 'Un motif de cinq caractères est obligatoire en cas d’écart.';
  END IF;
  IF v_difference = 0 AND NOT public.catalog_has_role(v_h.organization_id, ARRAY['OWNER','MANAGER']::text[])
    AND NOT EXISTS (SELECT 1 FROM public.memberships WHERE organization_id = v_h.organization_id AND user_id = auth.uid() AND role = 'CASHIER' AND is_active) THEN
    RAISE EXCEPTION 'La remise doit être validée par un caissier actif ou un responsable.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.delivery_cash_handovers SET status = CASE WHEN v_difference = 0 THEN 'CONFIRMED' ELSE 'DISCREPANCY' END,
    counted_amount = p_counted_amount, discrepancy = v_difference,
    resolution_note = CASE WHEN v_difference <> 0 THEN btrim(p_resolution_note) ELSE NULL END,
    validated_by = auth.uid(), validated_at = NOW() WHERE id = p_handover_id;
  RETURN jsonb_build_object('ok',true,'status',CASE WHEN v_difference = 0 THEN 'CONFIRMED' ELSE 'DISCREPANCY' END,'discrepancy',v_difference);
END;
$$;

-- Do not close an organization cash register while courier cash is unhanded/unverified.
CREATE OR REPLACE FUNCTION public.prevent_cash_close_with_unhanded_delivery_cash()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status = 'CLOSED' AND OLD.status IS DISTINCT FROM NEW.status AND EXISTS (
    SELECT 1 FROM public.payments p WHERE p.organization_id = NEW.organization_id AND p.method = 'CASH'
      AND p.delivery_mission_id IS NOT NULL
      AND (p.collected_at AT TIME ZONE 'Africa/Brazzaville')::date = NEW.date
      AND NOT EXISTS (SELECT 1 FROM public.delivery_cash_handover_lines l
        JOIN public.delivery_cash_handovers h ON h.id = l.handover_id
        WHERE l.payment_id = p.id AND h.status IN ('CONFIRMED','DISCREPANCY'))
  ) THEN RAISE EXCEPTION 'Clôture impossible : des espèces de livreur n’ont pas encore été remises et vérifiées.'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.prevent_cash_close_with_unhanded_delivery_cash() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_prevent_cash_close_with_unhanded_delivery_cash ON public.cash_closings;
CREATE TRIGGER trg_prevent_cash_close_with_unhanded_delivery_cash BEFORE UPDATE OF status ON public.cash_closings
  FOR EACH ROW EXECUTE FUNCTION public.prevent_cash_close_with_unhanded_delivery_cash();

-- Ended courier missions expose client details only for the seven-day audit window.
-- PostgreSQL does not allow CREATE OR REPLACE to alter a function's OUT row type.
-- Dropping this RPC is safe here: no database object depends on it and it is recreated below.
DROP FUNCTION IF EXISTS public.get_mission_details(UUID);
CREATE OR REPLACE FUNCTION public.get_mission_details(p_mission_id UUID)
RETURNS TABLE (
  id UUID, organization_id UUID, order_id UUID, kind TEXT, status TEXT, assigned_to UUID,
  pay_amount NUMERIC, zone_label VARCHAR(100), instructions VARCHAR(300), items_count_collected INTEGER,
  client_name VARCHAR(255), client_phone VARCHAR(30), address TEXT, request_code VARCHAR(20), ticket_number VARCHAR(20),
  created_at TIMESTAMPTZ, assigned_at TIMESTAMPTZ, accepted_at TIMESTAMPTZ, en_route_at TIMESTAMPTZ,
  at_customer_at TIMESTAMPTZ, collected_at TIMESTAMPTZ, in_transit_at TIMESTAMPTZ, at_shop_at TIMESTAMPTZ,
  cancel_reason TEXT, fail_reason TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_org UUID; v_user UUID; v_m public.delivery_missions;
BEGIN
  v_user := auth.uid(); v_org := auth.get_user_org_id();
  IF v_org IS NULL THEN RAISE EXCEPTION 'Utilisateur non authentifié.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_m FROM public.delivery_missions WHERE delivery_missions.id = p_mission_id AND delivery_missions.organization_id = v_org;
  IF v_m.id IS NULL THEN RAISE EXCEPTION 'Mission introuvable.'; END IF;
  IF NOT (public.catalog_has_role(v_org, ARRAY['OWNER','MANAGER']::text[]) OR (v_m.assigned_to = v_user AND
    (v_m.status NOT IN ('FAILED','CANCELLED','AT_SHOP','COMPLETED') OR v_m.updated_at >= NOW() - INTERVAL '7 days'))) THEN
    RAISE EXCEPTION 'Accès refusé aux détails confidentiels de cette mission.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT m.id,m.organization_id,m.order_id,m.kind,m.status,m.assigned_to,m.pay_amount,m.zone_label,m.instructions,
    m.items_count_collected,o.client_name,o.client_phone,CASE WHEN m.kind='COLLECTION' THEN o.pickup_address ELSE o.delivery_address END,
    o.request_code,o.ticket_number,m.created_at,m.assigned_at,m.accepted_at,m.en_route_at,m.at_customer_at,m.collected_at,
    m.in_transit_at,m.at_shop_at,m.cancel_reason,m.fail_reason
    FROM public.delivery_missions m JOIN public.orders o ON o.id=m.order_id WHERE m.id=p_mission_id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_mission_details(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_mission_details(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.record_delivery_mission_payment(UUID, NUMERIC, public.payment_method, TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_delivery_mission(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.authorize_unpaid_delivery(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_unhanded_delivery_cash() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_delivery_cash_handover(NUMERIC) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_delivery_cash_handover(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_delivery_mission_payment(UUID, NUMERIC, public.payment_method, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_delivery_mission(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_unpaid_delivery(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_unhanded_delivery_cash() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_delivery_cash_handover(NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_delivery_cash_handover(UUID, NUMERIC, TEXT) TO authenticated;

