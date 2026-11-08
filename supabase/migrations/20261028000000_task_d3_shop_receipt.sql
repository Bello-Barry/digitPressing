-- =============================================================================
-- MIGRATION 20261028000000 : TÂCHE D3 - CONTRÔLE ET RÉCEPTION AU PRESSING
-- Enregistre le contrôle ligne par ligne et finalise atomiquement la réception.
-- Migration additive : à appliquer manuellement après validation.
-- =============================================================================

-- Une mission de collecte n'est terminée qu'après réception validée au pressing.
ALTER TABLE public.delivery_missions
  DROP CONSTRAINT IF EXISTS delivery_missions_status_check;
ALTER TABLE public.delivery_missions
  ADD CONSTRAINT delivery_missions_status_check CHECK (status IN (
    'OPEN', 'ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'AT_CUSTOMER', 'COLLECTED',
    'IN_TRANSIT', 'AT_SHOP', 'COMPLETED', 'FAILED', 'CANCELLED'
  ));

CREATE TABLE IF NOT EXISTS public.delivery_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  mission_id UUID NOT NULL UNIQUE REFERENCES public.delivery_missions(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('CONFORM', 'DISCREPANCY', 'RESOLVED')),
  expected_items_count INTEGER NOT NULL CHECK (expected_items_count >= 0),
  received_items_count INTEGER NOT NULL CHECK (received_items_count >= 0),
  discrepancy_note TEXT,
  resolution_note TEXT,
  validated_by UUID NOT NULL REFERENCES auth.users(id),
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT delivery_receipts_discrepancy_reason CHECK (
    status <> 'DISCREPANCY' OR length(btrim(COALESCE(discrepancy_note, ''))) >= 5
  ),
  CONSTRAINT delivery_receipts_resolution_reason CHECK (
    status <> 'RESOLVED' OR (length(btrim(COALESCE(resolution_note, ''))) >= 5 AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.delivery_receipt_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  receipt_id UUID NOT NULL REFERENCES public.delivery_receipts(id) ON DELETE RESTRICT,
  order_item_id UUID,
  service_name TEXT NOT NULL,
  item_type TEXT,
  color TEXT,
  pattern TEXT,
  brand TEXT,
  size TEXT,
  item_notes TEXT,
  expected_quantity INTEGER NOT NULL CHECK (expected_quantity >= 0),
  received_quantity INTEGER NOT NULL CHECK (received_quantity >= 0),
  discrepancy_note TEXT,
  condition_discrepancy BOOLEAN NOT NULL DEFAULT false,
  condition_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT delivery_receipt_line_discrepancy_reason CHECK (
    (expected_quantity = received_quantity AND NOT condition_discrepancy)
      OR length(btrim(COALESCE(discrepancy_note, condition_note, ''))) >= 5
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_receipt_line_item_unique
  ON public.delivery_receipt_lines(receipt_id, order_item_id)
  WHERE order_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_delivery_receipts_org_created
  ON public.delivery_receipts(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_receipt_lines_receipt
  ON public.delivery_receipt_lines(receipt_id);

ALTER TABLE public.delivery_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_receipt_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delivery_receipts_staff_read ON public.delivery_receipts;
CREATE POLICY delivery_receipts_staff_read ON public.delivery_receipts FOR SELECT
  USING (public.catalog_has_role(organization_id, ARRAY['OWNER','MANAGER','CASHIER']::text[]));
DROP POLICY IF EXISTS delivery_receipt_lines_staff_read ON public.delivery_receipt_lines;
CREATE POLICY delivery_receipt_lines_staff_read ON public.delivery_receipt_lines FOR SELECT
  USING (public.catalog_has_role(organization_id, ARRAY['OWNER','MANAGER','CASHIER']::text[]));

REVOKE ALL ON public.delivery_receipts FROM PUBLIC, anon;
REVOKE ALL ON public.delivery_receipt_lines FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.delivery_receipts FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.delivery_receipt_lines FROM authenticated;
GRANT SELECT ON public.delivery_receipts, public.delivery_receipt_lines TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_direct_delivery_receipt_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('app.in_rpc', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Utilisez les fonctions de réception autorisées.' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.prevent_direct_delivery_receipt_mutation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prevent_delivery_receipts_mutation ON public.delivery_receipts;
CREATE TRIGGER trg_prevent_delivery_receipts_mutation BEFORE INSERT OR UPDATE OR DELETE ON public.delivery_receipts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_delivery_receipt_mutation();
DROP TRIGGER IF EXISTS trg_prevent_delivery_receipt_lines_mutation ON public.delivery_receipt_lines;
CREATE TRIGGER trg_prevent_delivery_receipt_lines_mutation BEFORE INSERT OR UPDATE OR DELETE ON public.delivery_receipt_lines
  FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_delivery_receipt_mutation();

DROP TRIGGER IF EXISTS trg_audit_delivery_receipts ON public.delivery_receipts;
CREATE TRIGGER trg_audit_delivery_receipts AFTER INSERT OR UPDATE OR DELETE ON public.delivery_receipts
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generic_audit_log();
DROP TRIGGER IF EXISTS trg_audit_delivery_receipt_lines ON public.delivery_receipt_lines;
CREATE TRIGGER trg_audit_delivery_receipt_lines AFTER INSERT OR UPDATE OR DELETE ON public.delivery_receipt_lines
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generic_audit_log();

-- Ferme le chemin de réception standard pour les commandes avec une collecte D1.
CREATE OR REPLACE FUNCTION public.enforce_delivery_receipt_before_order_received()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'RECEIVED' AND OLD.status IS DISTINCT FROM NEW.status AND EXISTS (
    SELECT 1 FROM public.delivery_missions m
    WHERE m.order_id = NEW.id AND m.organization_id = NEW.organization_id
      AND m.kind = 'COLLECTION' AND m.status NOT IN ('FAILED','CANCELLED')
  ) AND NOT EXISTS (
    SELECT 1 FROM public.delivery_receipts r
    JOIN public.delivery_missions m ON m.id = r.mission_id
    WHERE r.order_id = NEW.id AND r.organization_id = NEW.organization_id
      AND r.status IN ('CONFORM','RESOLVED') AND m.status = 'AT_SHOP'
  ) THEN
    RAISE EXCEPTION 'Le contrôle de réception D3 doit être validé avant le ticket officiel.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_delivery_receipt_before_order_received() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_enforce_delivery_receipt_before_order_received ON public.orders;
CREATE TRIGGER trg_enforce_delivery_receipt_before_order_received
  BEFORE UPDATE OF status ON public.orders FOR EACH ROW
  EXECUTE FUNCTION public.enforce_delivery_receipt_before_order_received();

-- p_lines_json contains every invoiced item exactly once; extra garments may use
-- order_item_id=null and expected_quantity=0. Quantity/description are rechecked
-- against the current approved order_items snapshot while locking the order.
CREATE OR REPLACE FUNCTION public.inspect_delivery_receipt(
  p_mission_id UUID,
  p_lines_json JSONB
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_mission public.delivery_missions;
  v_order public.orders;
  v_line JSONB;
  v_item public.order_items;
  v_receipt_id UUID;
  v_expected_total INTEGER := 0;
  v_received_total INTEGER := 0;
  v_line_count INTEGER := 0;
  v_status TEXT;
  v_discrepancy TEXT := '';
  v_ticket TEXT;
BEGIN
  PERFORM set_config('app.in_rpc', 'true', true);
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_mission FROM public.delivery_missions WHERE id = p_mission_id FOR UPDATE;
  IF v_mission.id IS NULL THEN RAISE EXCEPTION 'Mission introuvable.'; END IF;
  IF NOT public.catalog_has_role(v_mission.organization_id, ARRAY['OWNER','MANAGER','CASHIER']::text[]) THEN
    RAISE EXCEPTION 'Personnel du pressing requis pour valider la réception.' USING ERRCODE = '42501';
  END IF;
  IF v_mission.kind <> 'COLLECTION' OR v_mission.status <> 'AT_SHOP' THEN
    RAISE EXCEPTION 'La mission de collecte doit être arrivée au pressing.';
  END IF;
  IF v_mission.assigned_to = auth.uid() THEN
    RAISE EXCEPTION 'Le livreur de cette mission ne peut pas valider sa propre réception.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.delivery_receipts WHERE mission_id = p_mission_id) THEN
    RAISE EXCEPTION 'Un contrôle de réception existe déjà pour cette mission.';
  END IF;
  IF jsonb_typeof(p_lines_json) <> 'array' THEN RAISE EXCEPTION 'Les lignes contrôlées sont requises.'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_mission.order_id AND organization_id = v_mission.organization_id FOR UPDATE;
  IF v_order.id IS NULL OR v_order.status <> 'VALIDATED' THEN
    RAISE EXCEPTION 'La commande doit être validée et non réceptionnée.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.order_revisions WHERE mission_id = p_mission_id AND status = 'PENDING_AGREEMENT') THEN
    RAISE EXCEPTION 'Une révision de facture attend encore l’accord du client.';
  END IF;

  SELECT COALESCE(SUM(quantity), 0)::INTEGER INTO v_expected_total
  FROM public.order_items WHERE order_id = v_order.id AND organization_id = v_order.organization_id;
  IF v_expected_total < 1 THEN RAISE EXCEPTION 'Une commande doit contenir au moins une pièce avant sa réception.'; END IF;
  IF jsonb_array_length(p_lines_json) < (SELECT COUNT(*) FROM public.order_items WHERE order_id = v_order.id) THEN
    RAISE EXCEPTION 'Chaque ligne de la facture doit être contrôlée.';
  END IF;

  INSERT INTO public.delivery_receipts (organization_id, order_id, mission_id, status, expected_items_count, received_items_count, validated_by)
  VALUES (v_order.organization_id, v_order.id, p_mission_id, 'CONFORM', v_expected_total, 0, auth.uid())
  RETURNING id INTO v_receipt_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines_json)
  LOOP
    v_line_count := v_line_count + 1;
    IF NULLIF(v_line->>'received_quantity', '') IS NULL OR (v_line->>'received_quantity')::INTEGER < 0 THEN
      RAISE EXCEPTION 'Chaque quantité reçue doit être un entier positif ou nul.';
    END IF;
    IF NULLIF(v_line->>'order_item_id', '') IS NOT NULL THEN
      SELECT * INTO v_item FROM public.order_items
      WHERE id = (v_line->>'order_item_id')::UUID AND order_id = v_order.id AND organization_id = v_order.organization_id;
      IF v_item.id IS NULL THEN RAISE EXCEPTION 'Une ligne ne correspond pas à la facture actuelle.'; END IF;
      IF EXISTS (
        SELECT 1 FROM public.delivery_receipt_lines
        WHERE receipt_id = v_receipt_id AND order_item_id = v_item.id
      ) THEN RAISE EXCEPTION 'Une ligne de facture a été envoyée plusieurs fois.'; END IF;
      IF COALESCE(NULLIF(v_line->>'expected_quantity','')::INTEGER, -1) <> v_item.quantity THEN
        RAISE EXCEPTION 'La quantité facturée a changé. Rechargez la facture avant le contrôle.';
      END IF;
      INSERT INTO public.delivery_receipt_lines (
        organization_id, receipt_id, order_item_id, service_name, item_type, color, pattern, brand, size, item_notes,
        expected_quantity, received_quantity, discrepancy_note, condition_discrepancy, condition_note
      ) VALUES (
        v_order.organization_id, v_receipt_id, v_item.id, v_item.service_name,
        v_item.item_type, v_item.color, v_item.pattern, v_item.brand, v_item.size, v_item.item_notes,
        v_item.quantity, (v_line->>'received_quantity')::INTEGER, NULLIF(btrim(v_line->>'discrepancy_note'), ''),
        COALESCE((v_line->>'condition_discrepancy')::BOOLEAN, false), NULLIF(btrim(v_line->>'condition_note'), '')
      );
      v_received_total := v_received_total + (v_line->>'received_quantity')::INTEGER;
      IF v_item.quantity <> (v_line->>'received_quantity')::INTEGER OR COALESCE((v_line->>'condition_discrepancy')::BOOLEAN, false) THEN
        v_discrepancy := v_discrepancy || format('%s : attendu %s, reçu %s (%s). ', v_item.service_name, v_item.quantity,
          (v_line->>'received_quantity')::INTEGER, COALESCE(NULLIF(btrim(v_line->>'discrepancy_note'), ''), NULLIF(btrim(v_line->>'condition_note'), ''), 'motif absent'));
      END IF;
    ELSE
      IF COALESCE(NULLIF(v_line->>'expected_quantity','')::INTEGER, 0) <> 0 THEN
        RAISE EXCEPTION 'Un article hors facture doit avoir une quantité attendue nulle.';
      END IF;
      IF (v_line->>'received_quantity')::INTEGER < 1 THEN
        RAISE EXCEPTION 'Un article hors facture doit correspondre à au moins une pièce réellement reçue.';
      END IF;
      INSERT INTO public.delivery_receipt_lines (
        organization_id, receipt_id, service_name, item_type, color, pattern, brand, size, item_notes,
        expected_quantity, received_quantity, discrepancy_note, condition_discrepancy, condition_note
      ) VALUES (
        v_order.organization_id, v_receipt_id,
        COALESCE(NULLIF(btrim(v_line->>'service_name'), ''), 'Article hors facture'),
        v_line->>'item_type', v_line->>'color', v_line->>'pattern', v_line->>'brand', v_line->>'size', v_line->>'item_notes',
        0, (v_line->>'received_quantity')::INTEGER, NULLIF(btrim(v_line->>'discrepancy_note'), ''),
        COALESCE((v_line->>'condition_discrepancy')::BOOLEAN, false), NULLIF(btrim(v_line->>'condition_note'), '')
      );
      v_received_total := v_received_total + (v_line->>'received_quantity')::INTEGER;
      v_discrepancy := v_discrepancy || format('%s : article hors facture, reçu %s (%s). ',
        COALESCE(NULLIF(btrim(v_line->>'service_name'), ''), 'Article hors facture'),
        (v_line->>'received_quantity')::INTEGER, COALESCE(NULLIF(btrim(v_line->>'discrepancy_note'), ''), NULLIF(btrim(v_line->>'condition_note'), ''), 'motif absent'));
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.order_items oi WHERE oi.order_id = v_order.id
      AND NOT EXISTS (SELECT 1 FROM public.delivery_receipt_lines rl WHERE rl.receipt_id = v_receipt_id AND rl.order_item_id = oi.id)
  ) THEN RAISE EXCEPTION 'Chaque ligne de facture doit être contrôlée exactement une fois.'; END IF;
  IF EXISTS (SELECT 1 FROM public.delivery_receipt_lines WHERE receipt_id = v_receipt_id
    AND (expected_quantity <> received_quantity OR condition_discrepancy)
    AND length(btrim(COALESCE(discrepancy_note, condition_note, ''))) < 5) THEN
    RAISE EXCEPTION 'Un motif de cinq caractères minimum est requis pour chaque écart.';
  END IF;

  IF v_discrepancy = '' AND v_expected_total = v_received_total THEN
    v_status := 'CONFORM';
    UPDATE public.delivery_receipts SET status = v_status, received_items_count = v_received_total WHERE id = v_receipt_id;
    v_ticket := public.receive_order_and_assign_ticket(v_order.id, v_order.organization_id, auth.uid(), GREATEST(v_received_total, 1));
    UPDATE public.orders SET items_verified = true, items_discrepancy = NULL WHERE id = v_order.id;
    UPDATE public.delivery_missions SET status = 'COMPLETED', updated_at = NOW() WHERE id = p_mission_id;
    RETURN jsonb_build_object('ok', true, 'status', v_status, 'ticket_number', v_ticket, 'receipt_id', v_receipt_id);
  END IF;

  UPDATE public.delivery_receipts SET status = 'DISCREPANCY', received_items_count = v_received_total,
    discrepancy_note = btrim(v_discrepancy) WHERE id = v_receipt_id;
  UPDATE public.orders SET items_count_in = v_received_total, items_verified = false,
    items_discrepancy = btrim(v_discrepancy), updated_at = NOW() WHERE id = v_order.id;
  RETURN jsonb_build_object('ok', true, 'status', 'DISCREPANCY', 'receipt_id', v_receipt_id,
    'message', 'Écart enregistré. La réception reste bloquée jusqu’à la décision d’un responsable.');
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_delivery_receipt(p_mission_id UUID, p_resolution_note TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_mission public.delivery_missions;
  v_receipt public.delivery_receipts;
  v_order public.orders;
  v_ticket TEXT;
BEGIN
  PERFORM set_config('app.in_rpc', 'true', true);
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_mission FROM public.delivery_missions WHERE id = p_mission_id FOR UPDATE;
  IF v_mission.id IS NULL THEN RAISE EXCEPTION 'Mission introuvable.'; END IF;
  IF NOT public.catalog_has_role(v_mission.organization_id, ARRAY['OWNER','MANAGER']::text[]) THEN
    RAISE EXCEPTION 'Seul un propriétaire ou manager peut traiter un écart.' USING ERRCODE = '42501';
  END IF;
  IF v_mission.assigned_to = auth.uid() THEN RAISE EXCEPTION 'Le livreur ne peut pas valider sa propre réception.' USING ERRCODE = '42501'; END IF;
  IF length(btrim(COALESCE(p_resolution_note,''))) < 5 THEN RAISE EXCEPTION 'Le motif de résolution doit contenir au moins cinq caractères.'; END IF;

  SELECT * INTO v_receipt FROM public.delivery_receipts WHERE mission_id = p_mission_id FOR UPDATE;
  IF v_receipt.id IS NULL OR v_receipt.status <> 'DISCREPANCY' THEN RAISE EXCEPTION 'Aucun écart en attente de résolution.'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = v_receipt.order_id FOR UPDATE;
  IF v_order.status <> 'VALIDATED' THEN RAISE EXCEPTION 'La commande a déjà été reçue.'; END IF;
  IF v_receipt.received_items_count < 1 THEN
    RAISE EXCEPTION 'Aucun article physique n’a été reçu. Impossible d’attribuer un ticket ; contactez le client ou annulez la commande.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.order_revisions WHERE mission_id = p_mission_id AND status = 'PENDING_AGREEMENT') THEN
    RAISE EXCEPTION 'La réception ne peut pas être finalisée tant qu’une révision attend l’accord du client.';
  END IF;

  v_ticket := public.receive_order_and_assign_ticket(v_order.id, v_order.organization_id, auth.uid(), GREATEST(v_receipt.received_items_count, 1));
  UPDATE public.delivery_receipts SET status = 'RESOLVED', resolution_note = btrim(p_resolution_note),
    resolved_by = auth.uid(), resolved_at = NOW() WHERE id = v_receipt.id;
  UPDATE public.orders SET items_verified = true, updated_at = NOW() WHERE id = v_order.id;
  UPDATE public.delivery_missions SET status = 'COMPLETED', updated_at = NOW() WHERE id = p_mission_id;
  RETURN jsonb_build_object('ok', true, 'status', 'RESOLVED', 'ticket_number', v_ticket, 'receipt_id', v_receipt.id);
END;
$$;

REVOKE ALL ON FUNCTION public.inspect_delivery_receipt(UUID, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_delivery_receipt(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inspect_delivery_receipt(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_delivery_receipt(UUID, TEXT) TO authenticated;

