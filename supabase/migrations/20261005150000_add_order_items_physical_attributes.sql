-- Migration: Add physical article attributes to order_items
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS item_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS color VARCHAR(50),
  ADD COLUMN IF NOT EXISTS pattern VARCHAR(50),
  ADD COLUMN IF NOT EXISTS brand VARCHAR(100),
  ADD COLUMN IF NOT EXISTS size VARCHAR(50),
  ADD COLUMN IF NOT EXISTS item_notes TEXT;

-- Update create_order_request RPC to insert physical characteristics
CREATE OR REPLACE FUNCTION create_order_request(
  p_org_id        UUID,
  p_client_name   TEXT,
  p_client_phone  TEXT,
  p_items         JSONB,
  p_mode          TEXT     DEFAULT 'DROP_OFF',
  p_address       TEXT     DEFAULT NULL,
  p_notes         TEXT     DEFAULT NULL,
  p_ip_hash       TEXT     DEFAULT NULL,
  p_honeypot      TEXT     DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id     UUID;
  v_request_code TEXT;
  v_subtotal     DECIMAL(12,2) := 0;
  v_total        DECIMAL(12,2) := 0;
  v_item         JSONB;
  v_rate_count   INTEGER;
  v_phone_norm   TEXT;
  v_customer_id  UUID;
BEGIN
  IF p_honeypot IS NOT NULL AND p_honeypot != '' THEN
    RAISE EXCEPTION 'SPAM_DETECTED';
  END IF;

  v_phone_norm := regexp_replace(p_client_phone, '[^0-9+]', '', 'g');
  IF char_length(v_phone_norm) < 8 THEN
    RAISE EXCEPTION 'INVALID_PHONE';
  END IF;

  DELETE FROM rate_limits WHERE expires_at < NOW();

  INSERT INTO rate_limits (key, action, count, window_start, expires_at)
  VALUES ('phone:' || v_phone_norm, 'create_order', 1, NOW(), NOW() + INTERVAL '1 hour')
  ON CONFLICT (key, action)
  DO UPDATE SET count = rate_limits.count + 1
  RETURNING count INTO v_rate_count;

  IF v_rate_count > 3 THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_subtotal := v_subtotal + ((v_item->>'unit_price')::DECIMAL * (v_item->>'quantity')::INTEGER);
  END LOOP;

  v_total := v_subtotal;

  v_request_code := assign_request_code(p_org_id);

  INSERT INTO customers (organization_id, full_name, phone_normalized, phone_display)
  VALUES (p_org_id, p_client_name, v_phone_norm, p_client_phone)
  ON CONFLICT (organization_id, phone_normalized)
  DO UPDATE SET full_name = EXCLUDED.full_name
  RETURNING id INTO v_customer_id;

  INSERT INTO orders (
    organization_id, request_code, customer_id,
    client_name, client_phone, status, mode,
    pickup_address, delivery_address,
    subtotal, total_amount, notes, ip_hash
  )
  VALUES (
    p_org_id, v_request_code, v_customer_id,
    p_client_name, v_phone_norm, 'REQUEST', p_mode::order_mode,
    CASE WHEN p_mode = 'PICKUP' THEN p_address ELSE NULL END,
    CASE WHEN p_mode = 'DELIVERY' THEN p_address ELSE NULL END,
    v_subtotal, v_total, p_notes, p_ip_hash
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (
      organization_id, order_id, service_id,
      service_name, unit_price, quantity, line_total,
      item_type, color, pattern, brand, size, item_notes, notes
    )
    VALUES (
      p_org_id,
      v_order_id,
      (v_item->>'service_id')::UUID,
      v_item->>'service_name',
      (v_item->>'unit_price')::DECIMAL,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'unit_price')::DECIMAL * (v_item->>'quantity')::INTEGER,
      v_item->>'item_type',
      v_item->>'color',
      v_item->>'pattern',
      v_item->>'brand',
      v_item->>'size',
      v_item->>'item_notes',
      v_item->>'notes'
    );
  END LOOP;

  RETURN jsonb_build_object(
    'order_id',      v_order_id,
    'request_code',  v_request_code,
    'total_amount',  v_total
  );
END;
$$;
