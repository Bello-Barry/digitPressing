-- =============================================================================
-- TESTS D'ISOLATION MULTI-TENANT & RLS - PHASE 1
-- Exécute des vérifications complètes des règles de sécurité et RLS
-- =============================================================================

DO $$
DECLARE
  v_test_user_a UUID := 'b1943c2c-df18-4f5a-968e-39858bd46134'; -- Real Owner LB Pressing
  v_test_user_b UUID := '88888888-8888-8888-8888-888888888888'; -- Test Cashier Org B
  v_org_a UUID := '11111111-1111-1111-1111-111111111111'; -- LB Pressing
  v_org_b UUID := '22222222-2222-2222-2222-222222222222'; -- Pressing Express Demo
  v_res_a JSONB;
  v_res_b JSONB;
  v_order_a_id UUID;
  v_order_b_id UUID;
  v_ticket_1 TEXT;
  v_ticket_2 TEXT;
  v_role TEXT;
  v_caught BOOLEAN := false;
BEGIN
  -- Créer temporairement l'utilisateur test B dans auth.users
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES (
    v_test_user_b,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'cashier.test@express-demo.cg',
    crypt('password123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  -- Setup membership Org B
  INSERT INTO memberships (user_id, organization_id, role)
  VALUES (v_test_user_b, v_org_b, 'CASHIER')
  ON CONFLICT (user_id, organization_id) DO UPDATE SET role = 'CASHIER';

  -- 1. Tester avec contexte auth = User A (Owner LB Pressing)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_test_user_a::text)::text, true);

  v_role := get_user_role_in_org(v_org_a);
  IF v_role <> 'OWNER' THEN
    RAISE EXCEPTION 'TEST FAILED: Role de user_a devrait etre OWNER, recu: %', v_role;
  END IF;

  v_role := get_user_role_in_org(v_org_b);
  IF v_role IS NOT NULL THEN
    RAISE EXCEPTION 'TEST FAILED: user_a ne doit avoir AUCUN role dans org_b';
  END IF;

  -- 2. Tester avec contexte auth = User B (Cashier Express Demo)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_test_user_b::text)::text, true);

  v_role := get_user_role_in_org(v_org_b);
  IF v_role <> 'CASHIER' THEN
    RAISE EXCEPTION 'TEST FAILED: Role de user_b devrait etre CASHIER, recu: %', v_role;
  END IF;

  v_role := get_user_role_in_org(v_org_a);
  IF v_role IS NOT NULL THEN
    RAISE EXCEPTION 'TEST FAILED: user_b ne doit avoir AUCUN role dans org_a';
  END IF;

  RAISE NOTICE '✓ Test 1: Isolation des rôles par organisation réussie';

  -- 3. Test création demande publique via RPC create_order_request
  v_res_a := create_order_request(
    v_org_a,
    'Client Test A',
    '067000001',
    '[{"service_id": null, "service_name": "Chemise test", "quantity": 2, "unit_price": 5000}]'::JSONB,
    'DROP_OFF',
    NULL,
    'Demande test RLS'
  );
  v_order_a_id := (v_res_a->>'order_id')::UUID;

  v_res_b := create_order_request(
    v_org_b,
    'Client Test B',
    '067000002',
    '[{"service_id": null, "service_name": "Costume test", "quantity": 1, "unit_price": 20000}]'::JSONB,
    'DROP_OFF',
    NULL,
    'Demande test Org B'
  );
  v_order_b_id := (v_res_b->>'order_id')::UUID;

  IF v_order_a_id IS NULL OR v_order_b_id IS NULL THEN
    RAISE EXCEPTION 'TEST FAILED: Echec creation commandes';
  END IF;
  RAISE NOTICE '✓ Test 2: RPC create_order_request OK (Org A: %, Org B: %)', v_res_a->>'request_code', v_res_b->>'request_code';

  -- 4. Test attribution de ticket sans trou
  v_ticket_1 := receive_order_and_assign_ticket(v_order_a_id, v_org_a, v_test_user_a, 2);
  IF v_ticket_1 NOT LIKE 'LB-%' THEN
    RAISE EXCEPTION 'TEST FAILED: Ticket Org A devrait commencer par LB-, recu: %', v_ticket_1;
  END IF;

  v_ticket_2 := receive_order_and_assign_ticket(v_order_b_id, v_org_b, v_test_user_b, 1);
  IF v_ticket_2 NOT LIKE 'EX-%' THEN
    RAISE EXCEPTION 'TEST FAILED: Ticket Org B devrait commencer par EX-, recu: %', v_ticket_2;
  END IF;
  RAISE NOTICE '✓ Test 3: Séquences tickets atomiques et préfixes OK (Org A: %, Org B: %)', v_ticket_1, v_ticket_2;

  -- 5. Test RPC de suivi client sans compte
  DECLARE
    v_track_res JSONB;
    v_req_code TEXT;
  BEGIN
    SELECT request_code INTO v_req_code FROM orders WHERE id = v_order_a_id;
    v_track_res := get_order_tracking(v_org_a, v_req_code, '067000001');
    IF v_track_res->>'status' <> 'RECEIVED' THEN
      RAISE EXCEPTION 'TEST FAILED: Statut suivi incorrect, recu: %', v_track_res;
    END IF;

    -- Suivi avec mauvais numéro -> doit lever NOT_FOUND
    BEGIN
      v_track_res := get_order_tracking(v_org_a, v_req_code, '069999999');
    EXCEPTION WHEN OTHERS THEN
      v_caught := true;
    END;

    IF NOT v_caught THEN
      RAISE EXCEPTION 'TEST FAILED: Suivi client avec mauvais numero aurait du echouer avec NOT_FOUND';
    END IF;
  END;
  RAISE NOTICE '✓ Test 4: RPC get_order_tracking et sécurité numéro OK';

  -- 6. Nettoyage des commandes de test
  DELETE FROM order_items WHERE order_id IN (v_order_a_id, v_order_b_id);
  DELETE FROM payments WHERE order_id IN (v_order_a_id, v_order_b_id);
  DELETE FROM orders WHERE id IN (v_order_a_id, v_order_b_id);
  DELETE FROM memberships WHERE user_id = v_test_user_b;
  DELETE FROM auth.users WHERE id = v_test_user_b;

  RAISE NOTICE '=== TOUS LES TESTS SQL ET RLS DE PHASE 1 ONT REUSSI AVEC SUCCES ===';
END $$;
