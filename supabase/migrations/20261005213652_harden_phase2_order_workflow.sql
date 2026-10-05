-- Phase 2 hardening: authoritative order creation and physical garment data.
-- All changes are additive; historical orders and payments are preserved.

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS item_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS color VARCHAR(50),
  ADD COLUMN IF NOT EXISTS pattern VARCHAR(50),
  ADD COLUMN IF NOT EXISTS brand VARCHAR(100),
  ADD COLUMN IF NOT EXISTS size VARCHAR(50),
  ADD COLUMN IF NOT EXISTS item_notes TEXT;

-- Replace the public RPC atomically. Drop the old nine-argument signature so
-- PostgREST cannot select a stale/overloaded implementation.
DROP FUNCTION IF EXISTS public.create_order_request(UUID, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE FUNCTION public.create_order_request(
  p_org_id UUID,
  p_client_name TEXT,
  p_client_phone TEXT,
  p_items JSONB,
  p_mode TEXT DEFAULT 'DROP_OFF',
  p_address TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_ip_hash TEXT DEFAULT NULL,
  p_honeypot TEXT DEFAULT NULL,
  p_requested_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_order_id UUID;
  v_request_code TEXT;
  v_subtotal NUMERIC(12,2) := 0;
  v_rate_count INTEGER;
  v_phone_norm TEXT;
  v_customer_id UUID;
  v_item JSONB;
  v_verified_items JSONB := '[]'::JSONB;
  v_service_id UUID;
  v_service_name TEXT;
  v_unit_price NUMERIC(12,2);
  v_quantity INTEGER;
  v_mode order_mode;
BEGIN
  IF COALESCE(p_honeypot, '') <> '' THEN
    RAISE EXCEPTION 'SPAM_DETECTED';
  END IF;

  IF p_org_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM organizations WHERE id = p_org_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'ORGANIZATION_UNAVAILABLE';
  END IF;

  IF p_client_name IS NULL OR char_length(btrim(p_client_name)) < 2 THEN
    RAISE EXCEPTION 'INVALID_CLIENT_NAME';
  END IF;

  v_phone_norm := regexp_replace(COALESCE(p_client_phone, ''), '[^0-9+]', '', 'g');
  IF char_length(v_phone_norm) < 8 THEN
    RAISE EXCEPTION 'INVALID_PHONE';
  END IF;

  BEGIN
    v_mode := COALESCE(NULLIF(p_mode, '')::order_mode, 'DROP_OFF'::order_mode);
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'INVALID_ORDER_MODE';
  END;

  IF v_mode IN ('PICKUP', 'DELIVERY') AND char_length(btrim(COALESCE(p_address, ''))) < 3 THEN
    RAISE EXCEPTION 'ADDRESS_REQUIRED';
  END IF;

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'INVALID_ORDER_ITEMS';
  END IF;
  IF jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'INVALID_ORDER_ITEMS';
  END IF;

  -- Resolve every requested service inside the trusted database boundary.
  -- Submitted service names and prices are deliberately ignored.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) AS item(value)
  LOOP
    BEGIN
      v_service_id := NULLIF(v_item->>'service_id', '')::UUID;
      v_quantity := (v_item->>'quantity')::INTEGER;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'INVALID_ORDER_ITEM';
    END;

    IF v_service_id IS NULL OR v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 50 THEN
      RAISE EXCEPTION 'INVALID_ORDER_ITEM';
    END IF;

    SELECT name, price INTO v_service_name, v_unit_price
    FROM services
    WHERE id = v_service_id
      AND organization_id = p_org_id
      AND is_active = true
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'SERVICE_UNAVAILABLE';
    END IF;

    v_subtotal := v_subtotal + (v_unit_price * v_quantity);
    v_verified_items := v_verified_items || jsonb_build_array(jsonb_build_object(
      'service_id', v_service_id,
      'service_name', v_service_name,
      'unit_price', v_unit_price,
      'quantity', v_quantity,
      'item_type', left(NULLIF(btrim(v_item->>'item_type'), ''), 100),
      'color', left(NULLIF(btrim(v_item->>'color'), ''), 50),
      'pattern', left(NULLIF(btrim(v_item->>'pattern'), ''), 50),
      'brand', left(NULLIF(btrim(v_item->>'brand'), ''), 100),
      'size', left(NULLIF(btrim(v_item->>'size'), ''), 50),
      'item_notes', left(NULLIF(btrim(v_item->>'item_notes'), ''), 1000),
      'notes', left(NULLIF(btrim(v_item->>'notes'), ''), 1000)
    ));
  END LOOP;

  DELETE FROM rate_limits WHERE expires_at < NOW();
  INSERT INTO rate_limits (key, action, count, window_start, expires_at)
  VALUES ('phone:' || v_phone_norm, 'create_order', 1, NOW(), NOW() + INTERVAL '1 hour')
  ON CONFLICT (key, action)
  DO UPDATE SET count = rate_limits.count + 1
  RETURNING count INTO v_rate_count;

  IF v_rate_count > 3 THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  v_request_code := assign_request_code(p_org_id);

  INSERT INTO customers (organization_id, full_name, phone_normalized, phone_display)
  VALUES (p_org_id, btrim(p_client_name), v_phone_norm, p_client_phone)
  ON CONFLICT (organization_id, phone_normalized)
  DO UPDATE SET full_name = EXCLUDED.full_name,
                phone_display = EXCLUDED.phone_display,
                updated_at = NOW()
  RETURNING id INTO v_customer_id;

  INSERT INTO orders (
    organization_id, request_code, customer_id,
    client_name, client_phone, status, mode,
    pickup_address, delivery_address, requested_at,
    subtotal, total_amount, notes, ip_hash
  ) VALUES (
    p_org_id, v_request_code, v_customer_id,
    btrim(p_client_name), v_phone_norm, 'REQUEST', v_mode,
    CASE WHEN v_mode = 'PICKUP' THEN NULLIF(btrim(p_address), '') ELSE NULL END,
    CASE WHEN v_mode = 'DELIVERY' THEN NULLIF(btrim(p_address), '') ELSE NULL END,
    p_requested_at,
    v_subtotal, v_subtotal, NULLIF(btrim(p_notes), ''), p_ip_hash
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_verified_items) AS item(value)
  LOOP
    INSERT INTO order_items (
      organization_id, order_id, service_id,
      service_name, unit_price, quantity, line_total,
      item_type, color, pattern, brand, size, item_notes, notes
    ) VALUES (
      p_org_id, v_order_id, (v_item->>'service_id')::UUID,
      v_item->>'service_name', (v_item->>'unit_price')::NUMERIC,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'unit_price')::NUMERIC * (v_item->>'quantity')::INTEGER,
      v_item->>'item_type', v_item->>'color', v_item->>'pattern',
      v_item->>'brand', v_item->>'size', v_item->>'item_notes', v_item->>'notes'
    );
  END LOOP;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'request_code', v_request_code,
    'total_amount', v_subtotal
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_order_request(UUID, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_request(UUID, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO anon, authenticated;

-- Receiving requires the authenticated caller to match the actor id and hold
-- an active in-organization OWNER/MANAGER/CASHIER membership.
CREATE OR REPLACE FUNCTION public.receive_order_and_assign_ticket(
  p_order_id UUID,
  p_org_id UUID,
  p_user_id UUID,
  p_items_count INTEGER DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_prefix TEXT;
  v_next INTEGER;
  v_ticket TEXT;
  v_current_status order_status;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
      AND organization_id = p_org_id
      AND is_active = true
      AND role IN ('OWNER', 'MANAGER', 'CASHIER')
  ) THEN
    RAISE EXCEPTION 'INSUFFICIENT_ROLE';
  END IF;

  IF p_items_count IS NULL OR p_items_count < 1 THEN
    RAISE EXCEPTION 'INVALID_ITEMS_COUNT';
  END IF;

  SELECT status INTO v_current_status
  FROM orders
  WHERE id = p_order_id AND organization_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  IF v_current_status <> 'VALIDATED' THEN
    RAISE EXCEPTION 'ORDER_MUST_BE_VALIDATED';
  END IF;

  SELECT ticket_prefix INTO v_prefix FROM organizations WHERE id = p_org_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORGANIZATION_UNAVAILABLE';
  END IF;
  v_prefix := COALESCE(NULLIF(v_prefix, ''), 'LB');

  INSERT INTO ticket_sequences (organization_id, last_value)
  VALUES (p_org_id, 1)
  ON CONFLICT (organization_id)
  DO UPDATE SET last_value = ticket_sequences.last_value + 1, updated_at = NOW()
  RETURNING last_value INTO v_next;

  v_ticket := v_prefix || '-' || LPAD(v_next::TEXT, 4, '0');

  UPDATE orders SET
    ticket_number = v_ticket,
    status = 'RECEIVED',
    received_by = auth.uid(),
    items_count_in = COALESCE(p_items_count, items_count_in),
    updated_at = NOW()
  WHERE id = p_order_id AND organization_id = p_org_id;

  RETURN v_ticket;
END;
$function$;

REVOKE ALL ON FUNCTION public.receive_order_and_assign_ticket(UUID, UUID, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receive_order_and_assign_ticket(UUID, UUID, UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_invoice_by_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_result JSONB;
BEGIN
  IF p_token IS NULL OR length(btrim(p_token)) < 16 THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'order', jsonb_build_object(
      'id', o.id, 'request_code', o.request_code, 'ticket_number', o.ticket_number,
      'status', o.status, 'client_name', o.client_name, 'client_phone', o.client_phone,
      'mode', o.mode, 'subtotal', o.subtotal, 'delivery_fee', o.delivery_fee,
      'discount_amount', o.discount_amount, 'total_amount', o.total_amount,
      'items_count_in', o.items_count_in, 'created_at', o.created_at,
      'requested_at', o.requested_at
    ),
    'organization', jsonb_build_object(
      'id', org.id, 'name', org.name, 'slug', org.slug, 'ticket_prefix', org.ticket_prefix,
      'phone_1', org.phone_1, 'phone_2', org.phone_2, 'email', org.email,
      'address', org.address, 'currency', org.currency, 'footer_text', org.footer_text
    ),
    'items', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', oi.id, 'service_name', oi.service_name, 'quantity', oi.quantity,
        'unit_price', oi.unit_price, 'line_total', oi.line_total, 'notes', oi.notes,
        'item_type', oi.item_type, 'color', oi.color, 'pattern', oi.pattern,
        'brand', oi.brand, 'size', oi.size, 'item_notes', oi.item_notes
      ) ORDER BY oi.created_at, oi.id), '[]'::JSONB)
      FROM order_items oi WHERE oi.order_id = o.id
    ),
    'payments', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', p.id, 'amount', p.amount, 'method', p.method, 'collected_at', p.collected_at
      ) ORDER BY p.collected_at, p.id), '[]'::JSONB)
      FROM payments p WHERE p.order_id = o.id
    ),
    'summary', jsonb_build_object(
      'paid_amount', COALESCE(summary.paid_amount, 0),
      'balance_due', COALESCE(summary.balance_due, o.total_amount)
    )
  ) INTO v_result
  FROM orders o
  JOIN organizations org ON org.id = o.organization_id
  LEFT JOIN order_payment_summary summary ON summary.order_id = o.id
  WHERE o.invoice_token = btrim(p_token);

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_invoice_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invoice_by_token(TEXT) TO anon, authenticated;
