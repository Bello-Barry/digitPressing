-- Test D3 : contrôle conforme, écart bloquant, résolution motivée, séparation des rôles.
-- À exécuter uniquement sur une base locale de test après les migrations versionnées.
BEGIN;
DO $$
DECLARE
  v_org_a UUID := gen_random_uuid();
  v_org_b UUID := gen_random_uuid();
  v_owner_a UUID := gen_random_uuid();
  v_manager_a UUID := gen_random_uuid();
  v_courier_a UUID := gen_random_uuid();
  v_owner_b UUID := gen_random_uuid();
  v_customer UUID := gen_random_uuid();
  v_order_ok UUID := gen_random_uuid();
  v_order_gap UUID := gen_random_uuid();
  v_item_ok UUID := gen_random_uuid();
  v_item_gap UUID := gen_random_uuid();
  v_mission_ok UUID := gen_random_uuid();
  v_mission_gap UUID := gen_random_uuid();
  v_result JSONB;
  v_ticket TEXT;
  v_count INTEGER;
BEGIN
  INSERT INTO public.organizations (id, name, slug, ticket_prefix, country_code, currency, is_active)
  VALUES (v_org_a, 'Test D3 réception A', 'd3-' || substr(v_org_a::text,1,8), 'D3A', '242', 'XAF', true),
         (v_org_b, 'Test D3 réception B', 'd3-' || substr(v_org_b::text,1,8), 'D3B', '242', 'XAF', true);
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  SELECT id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', id::text || '@d3.test', crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()
  FROM (VALUES (v_owner_a),(v_manager_a),(v_courier_a),(v_owner_b)) AS users(id);
  INSERT INTO public.memberships (user_id, organization_id, role, is_active)
  VALUES (v_owner_a,v_org_a,'OWNER',true),(v_manager_a,v_org_a,'MANAGER',true),
         (v_courier_a,v_org_a,'DELIVERY',true),(v_owner_b,v_org_b,'OWNER',true);
  INSERT INTO public.customers (id, organization_id, full_name, phone)
  VALUES (v_customer,v_org_a,'Client test D3','061234567');
  INSERT INTO public.orders (id, organization_id, customer_id, client_name, client_phone, status, mode, total_amount, subtotal)
  VALUES (v_order_ok,v_org_a,v_customer,'Client test D3','061234567','VALIDATED','PICKUP',2000,2000),
         (v_order_gap,v_org_a,v_customer,'Client test D3','061234567','VALIDATED','PICKUP',2000,2000);
  INSERT INTO public.order_items (id, organization_id, order_id, service_name, unit_price, quantity, line_total, item_type, color)
  VALUES (v_item_ok,v_org_a,v_order_ok,'Chemise',1000,2,2000,'Chemise','Bleu'),
         (v_item_gap,v_org_a,v_order_gap,'Pantalon',1000,2,2000,'Pantalon','Noir');
  PERFORM set_config('app.in_rpc','true',true);
  INSERT INTO public.delivery_missions (id, organization_id, order_id, kind, status, assigned_to, pay_amount, zone_label)
  VALUES (v_mission_ok,v_org_a,v_order_ok,'COLLECTION','AT_SHOP',v_courier_a,500,'Bacongo'),
         (v_mission_gap,v_org_a,v_order_gap,'COLLECTION','AT_SHOP',v_courier_a,500,'Bacongo');
  PERFORM set_config('app.in_rpc','false',true);

  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_owner_a::text,'role','authenticated')::text, true);
  PERFORM set_config('role','authenticated',true);
  BEGIN
    PERFORM public.inspect_delivery_receipt(v_mission_ok,
      jsonb_build_array(jsonb_build_object('order_item_id',v_item_ok,'service_name','Chemise','expected_quantity',2,'received_quantity',2)));
    RAISE EXCEPTION 'D3 : le livreur assigné ne doit pas valider sa réception.';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  RESET ROLE;
  PERFORM set_config('app.in_rpc','true',true);
  UPDATE public.delivery_missions SET assigned_to = v_courier_a WHERE id = v_mission_ok;
  PERFORM set_config('app.in_rpc','false',true);
  PERFORM set_config('role','authenticated',true);

  BEGIN
    PERFORM public.receive_order_and_assign_ticket(v_order_gap,v_org_a,v_owner_a,2);
    RAISE EXCEPTION 'D3 : l’ancien chemin direct ne doit pas contourner le contrôle de collecte.';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  v_result := public.inspect_delivery_receipt(v_mission_ok,
    jsonb_build_array(jsonb_build_object('order_item_id',v_item_ok,'service_name','Chemise','expected_quantity',2,'received_quantity',2)));
  IF v_result->>'status' <> 'CONFORM' THEN RAISE EXCEPTION 'D3 : contrôle conforme non validé (%).',v_result; END IF;
  SELECT status::text INTO v_ticket FROM public.orders WHERE id = v_order_ok;
  IF v_ticket <> 'RECEIVED' THEN RAISE EXCEPTION 'D3 : la commande conforme doit passer à RECEIVED.'; END IF;
  IF NOT (SELECT items_verified FROM public.orders WHERE id = v_order_ok) THEN RAISE EXCEPTION 'D3 : items_verified doit être vrai après contrôle conforme.'; END IF;
  IF (SELECT status FROM public.delivery_missions WHERE id = v_mission_ok) <> 'COMPLETED' THEN RAISE EXCEPTION 'D3 : la mission doit être terminée après réception.'; END IF;

  v_result := public.inspect_delivery_receipt(v_mission_gap,
    jsonb_build_array(jsonb_build_object('order_item_id',v_item_gap,'service_name','Pantalon','expected_quantity',2,'received_quantity',1,
      'discrepancy_note','Une pièce manquante','condition_discrepancy',true,'condition_note','Tache à signaler')));
  IF v_result->>'status' <> 'DISCREPANCY' THEN RAISE EXCEPTION 'D3 : l’écart doit bloquer la réception (%).',v_result; END IF;
  IF (SELECT status::text FROM public.orders WHERE id = v_order_gap) <> 'VALIDATED' THEN RAISE EXCEPTION 'D3 : une commande avec écart ne doit pas recevoir de ticket.'; END IF;
  IF (SELECT status FROM public.delivery_missions WHERE id = v_mission_gap) <> 'AT_SHOP' THEN RAISE EXCEPTION 'D3 : une mission en écart reste à AT_SHOP.'; END IF;

  BEGIN
    PERFORM public.resolve_delivery_receipt(v_mission_gap,'');
    RAISE EXCEPTION 'D3 : la résolution sans motif aurait dû échouer.';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'D3 : la résolution sans motif aurait dû échouer.' THEN RAISE; END IF;
    IF SQLSTATE NOT IN ('P0001','42501') THEN RAISE; END IF;
  END;
  v_result := public.resolve_delivery_receipt(v_mission_gap,'Écart accepté par le responsable après recomptage');
  IF v_result->>'status' <> 'RESOLVED' OR v_result->>'ticket_number' IS NULL THEN RAISE EXCEPTION 'D3 : résolution motivée non finalisée (%).',v_result; END IF;
  IF NOT (SELECT items_verified FROM public.orders WHERE id = v_order_gap) THEN RAISE EXCEPTION 'D3 : le contrôle doit être marqué vérifié après résolution.'; END IF;
  BEGIN
    UPDATE public.delivery_receipts SET status = 'DISCREPANCY' WHERE mission_id = v_mission_gap;
    RAISE EXCEPTION 'D3 : une modification directe du contrôle aurait dû être refusée.';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'D3 : une modification directe du contrôle aurait dû être refusée.' THEN RAISE; END IF;
    IF SQLSTATE <> '42501' THEN RAISE; END IF;
  END;

  -- Un livreur ne peut ni lire les commandes de dépôt ni valider sa propre mission.
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_courier_a::text,'role','authenticated')::text, true);
  SELECT count(*) INTO v_count FROM public.delivery_receipts;
  IF v_count <> 0 THEN RAISE EXCEPTION 'D3 : les livreurs ne doivent pas lire les contrôles de réception.'; END IF;

  -- Isolation de l'organisation B.
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_owner_b::text,'role','authenticated')::text, true);
  SELECT count(*) INTO v_count FROM public.delivery_receipts;
  IF v_count <> 0 THEN RAISE EXCEPTION 'D3 : fuite inter-organisation dans les reçus.'; END IF;

  RAISE NOTICE 'D3 OK : réception conforme, blocage et résolution motivée des écarts, confidentialité et isolation.';
END;
$$;
ROLLBACK;
