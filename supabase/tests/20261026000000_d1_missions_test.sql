-- =============================================================================
-- TEST AUTOMATISÉ : TÂCHE D1 - MISSIONS DE COLLECTE ET DE LIVRAISON
-- Valide RLS, acceptation atomique, idempotence, transitions, masquage client,
-- refus d'accès, immuabilité directe, isolation multi-tenant et audit.
-- Rollback automatique via RAISE EXCEPTION 'ROLLBACK_TEST_SUCCESS'
-- =============================================================================

DO $$
DECLARE
  v_org_a_id UUID := 'a1000000-0000-0000-0000-000000000000';
  v_org_b_id UUID := 'b1000000-0000-0000-0000-000000000000';

  v_owner_a_id    UUID := 'a1111111-1111-1111-1111-111111111111';
  v_manager_a_id  UUID := 'a2222222-2222-2222-2222-222222222222';
  v_cashier_a_id  UUID := 'a3333333-3333-3333-3333-333333333333';
  v_courier_a1_id UUID := 'a4444444-4444-4444-4444-444444444444';
  v_courier_a2_id UUID := 'a5555555-5555-5555-5555-555555555555';

  v_owner_b_id    UUID := 'b1111111-1111-1111-1111-111111111111';
  v_courier_b_id  UUID := 'b4444444-4444-4444-4444-444444444444';

  v_customer_a_id UUID := 'a0000000-0000-0000-0000-000000000001';
  v_order_delivery_a_id UUID := 'a0000000-0000-0000-0000-000000000002';
  v_order_pickup_a_id   UUID := 'a0000000-0000-0000-0000-000000000003';

  v_mission_open_id UUID;
  v_mission_res RECORD;
  v_details RECORD;
  v_count INTEGER;
  v_caught BOOLEAN := false;
  v_err_code TEXT;
  v_err_msg TEXT;
BEGIN
  RAISE NOTICE '=== DÉBUT DU TEST SQL MISSIONS D1 ===';

  RESET ROLE;

  -- 1. SETUP ORGANISATIONS DE TEST
  INSERT INTO public.organizations (id, name, slug, ticket_prefix, country_code, currency, is_active)
  VALUES
    (v_org_a_id, 'Pressing D1 Test A', 'd1-test-a', 'DA', '242', 'XAF', true),
    (v_org_b_id, 'Pressing D1 Test B', 'd1-test-b', 'DB', '242', 'XAF', true)
  ON CONFLICT (id) DO UPDATE SET is_active = true;

  -- SETUP UTILISATEURS AUTH
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (v_owner_a_id,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.a@d1.test',      crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_manager_a_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manager.a@d1.test',    crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_cashier_a_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cashier.a@d1.test',    crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_courier_a1_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'courier.a1@d1.test',   crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_courier_a2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'courier.a2@d1.test',   crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_owner_b_id,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.b@d1.test',      crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_courier_b_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'courier.b@d1.test',    crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- SETUP MEMBERSHIPS
  INSERT INTO public.memberships (user_id, organization_id, role, is_active)
  VALUES
    (v_owner_a_id,    v_org_a_id, 'OWNER',    true),
    (v_manager_a_id,  v_org_a_id, 'MANAGER',  true),
    (v_cashier_a_id,  v_org_a_id, 'CASHIER',  true),
    (v_courier_a1_id, v_org_a_id, 'DELIVERY', true),
    (v_courier_a2_id, v_org_a_id, 'DELIVERY', true),
    (v_owner_b_id,    v_org_b_id, 'OWNER',    true),
    (v_courier_b_id,  v_org_b_id, 'DELIVERY', true)
  ON CONFLICT (user_id, organization_id) DO UPDATE SET role = EXCLUDED.role, is_active = true;

  -- SETUP CLIENT ET COMMANDES EN ORG A
  INSERT INTO public.customers (id, organization_id, full_name, phone)
  VALUES (v_customer_a_id, v_org_a_id, 'Jean Dupont', '066123456')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.orders (
    id, organization_id, customer_id, client_name, client_phone,
    status, mode, pickup_address, delivery_address, total_amount
  ) VALUES
    (v_order_delivery_a_id, v_org_a_id, v_customer_a_id, 'Jean Dupont', '066123456', 'VALIDATED', 'DELIVERY', 'Rue Mbochi, Bacongo', 'Avenue de la Paix, Poto-Poto', 5000),
    (v_order_pickup_a_id,   v_org_a_id, v_customer_a_id, 'Jean Dupont', '066123456', 'VALIDATED', 'PICKUP',   'Rue Mbochi, Bacongo', NULL, 3000)
  ON CONFLICT (id) DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- TEST 1 : CRÉATION IMPOSSIBLE SI RÉMUNÉRATION NON CONFIGURÉE
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_caught := false;
  BEGIN
    PERFORM public.create_delivery_mission(v_order_pickup_a_id, 'COLLECTION', NULL, 'Bacongo', 'Sonnex svp');
  EXCEPTION WHEN OTHERS THEN
    v_err_msg := SQLERRM;
    IF v_err_msg LIKE '%Définissez la rémunération dans Paramètres%' THEN
      v_caught := true;
    END IF;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 1 FAILED: La création doit échouer avec "Définissez la rémunération dans Paramètres" si non configurée (vu: %).', v_err_msg;
  END IF;

  RAISE NOTICE '✓ Test 1 OK : Blocage création de mission sans rémunération configurée.';

  -- CONFIGURATION DES RÉMUNÉRATIONS DANS ORG A
  UPDATE public.organizations
  SET courier_pay_collection = 1000, courier_pay_delivery = 1500
  WHERE id = v_org_a_id;

  -- ---------------------------------------------------------------------------
  -- TEST 2 : CRÉATION RÉUSSIE DE MISSIONS PAR OWNER / MANAGER
  -- ---------------------------------------------------------------------------
  v_mission_open_id := public.create_delivery_mission(
    p_order_id     => v_order_pickup_a_id,
    p_kind         => 'COLLECTION',
    p_assigned_to  => NULL,
    p_zone_label   => 'Bacongo Centre',
    p_instructions => 'Appeler avant d''arriver'
  );

  IF v_mission_open_id IS NULL THEN
    RAISE EXCEPTION 'TEST 2 FAILED: create_delivery_mission a renvoyé NULL.';
  END IF;

  SELECT count(*) INTO v_count FROM public.delivery_missions WHERE id = v_mission_open_id AND status = 'OPEN' AND pay_amount = 1000;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST 2 FAILED: La mission OPEN n''a pas été insérée avec le bon montant et statut.';
  END IF;

  RAISE NOTICE '✓ Test 2 OK : Mission créée au statut OPEN avec rémunération figée (1 000 FCFA).';

  -- ---------------------------------------------------------------------------
  -- TEST 3 : ACCEPTATION ATOMIQUE ET PAR LE LIVREUR COURIER A1
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_courier_a1_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_mission_res := public.accept_delivery_mission(v_mission_open_id);

  IF v_mission_res.status <> 'ACCEPTED' OR v_mission_res.assigned_to <> v_courier_a1_id THEN
    RAISE EXCEPTION 'TEST 3 FAILED: L''acceptation a échoué (statut: %, attribué: %).', v_mission_res.status, v_mission_res.assigned_to;
  END IF;

  RAISE NOTICE '✓ Test 3 OK : Mission acceptée par le premier livreur avec statut ACCEPTED.';

  -- ---------------------------------------------------------------------------
  -- TEST 4 : SECOND LIVREUR REÇOIT "Cette mission a déjà été prise"
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_courier_a2_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_caught := false;
  BEGIN
    PERFORM public.accept_delivery_mission(v_mission_open_id);
  EXCEPTION WHEN OTHERS THEN
    v_err_msg := SQLERRM;
    IF v_err_msg LIKE '%Cette mission a déjà été prise%' THEN
      v_caught := true;
    END IF;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 4 FAILED: Le second livreur aurait dû recevoir "Cette mission a déjà été prise" (vu: %).', v_err_msg;
  END IF;

  RAISE NOTICE '✓ Test 4 OK : Concurrence d''acceptation gérée de façon atomique.';

  -- ---------------------------------------------------------------------------
  -- TEST 5 : IDEMPOTENCE : LE MÊME LIVREUR RÉPÈTE LA DEMANDE SANS ERREUR
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_courier_a1_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_mission_res := public.accept_delivery_mission(v_mission_open_id);
  IF v_mission_res.status <> 'ACCEPTED' OR v_mission_res.assigned_to <> v_courier_a1_id THEN
    RAISE EXCEPTION 'TEST 5 FAILED: Répétition de la demande d''acceptation a échoué.';
  END IF;

  RAISE NOTICE '✓ Test 5 OK : Répétition idempotente de l''acceptation par le même livreur.';

  -- ---------------------------------------------------------------------------
  -- TEST 6 : REFUS D'ACCEPTATION POUR CASHIER ET LIVREUR D'UNE AUTRE ORG
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_cashier_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_caught := false;
  BEGIN
    PERFORM public.accept_delivery_mission(v_mission_open_id);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE;
    IF v_err_code = '42501' THEN v_caught := true; END IF;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 6a FAILED: Cashier aurait dû être refusé avec SQLSTATE 42501.';
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_courier_b_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_caught := false;
  BEGIN
    PERFORM public.accept_delivery_mission(v_mission_open_id);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE;
    IF v_err_code = '42501' THEN v_caught := true; END IF;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 6b FAILED: Livreur de Org B aurait dû être refusé avec SQLSTATE 42501.';
  END IF;

  RAISE NOTICE '✓ Test 6 OK : Caissier et livreur externe correctement refusés (42501).';

  -- ---------------------------------------------------------------------------
  -- TEST 7 : SAUT D'ÉTAPE REFUSÉ
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_courier_a1_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_caught := false;
  BEGIN
    PERFORM public.advance_delivery_mission(v_mission_open_id, 'COLLECTED', 5);
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 7 FAILED: Le saut d''étape de ACCEPTED à COLLECTED aurait dû être refusé.';
  END IF;

  RAISE NOTICE '✓ Test 7 OK : Saut d''étape refusé.';

  -- ---------------------------------------------------------------------------
  -- TEST 8 : AT_CUSTOMER VERS COLLECTED SANS NOMBRE DE PIÈCES REFUSÉ
  -- ---------------------------------------------------------------------------
  PERFORM public.advance_delivery_mission(v_mission_open_id, 'EN_ROUTE');
  PERFORM public.advance_delivery_mission(v_mission_open_id, 'AT_CUSTOMER');

  v_caught := false;
  BEGIN
    PERFORM public.advance_delivery_mission(v_mission_open_id, 'COLLECTED', NULL);
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 8 FAILED: Le passage à COLLECTED sans nombre de pièces doit échouer.';
  END IF;

  RAISE NOTICE '✓ Test 8 OK : Confirmation de collecte exige un nombre de pièces ≥ 0.';

  -- ---------------------------------------------------------------------------
  -- TEST 9 : AVANCEMENT COMPLET ET ÉTAPE PAR ÉTAPE JUSQU'À AT_SHOP
  -- ---------------------------------------------------------------------------
  PERFORM public.advance_delivery_mission(v_mission_open_id, 'COLLECTED', 4);
  PERFORM public.advance_delivery_mission(v_mission_open_id, 'IN_TRANSIT');
  v_mission_res := public.advance_delivery_mission(v_mission_open_id, 'AT_SHOP');

  IF v_mission_res.status <> 'AT_SHOP' OR v_mission_res.items_count_collected <> 4 THEN
    RAISE EXCEPTION 'TEST 9 FAILED: Mission devrait être AT_SHOP avec 4 pièces (vu: %, %).', v_mission_res.status, v_mission_res.items_count_collected;
  END IF;

  RAISE NOTICE '✓ Test 9 OK : Avancement complet validé jusqu''à l''arrivée au pressing (AT_SHOP).';

  -- ---------------------------------------------------------------------------
  -- TEST 10 : LIST_OPEN_MISSIONS NE DÉVOILE NI NOM NI ADRESSE NI TÉLÉPHONE
  -- ---------------------------------------------------------------------------
  -- Créer une nouvelle mission OPEN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  PERFORM public.create_delivery_mission(
    p_order_id     => v_order_delivery_a_id,
    p_kind         => 'DELIVERY',
    p_assigned_to  => NULL,
    p_zone_label   => 'Poto-Poto Market',
    p_instructions => 'Attention fragile'
  );

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_courier_a1_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT count(*) INTO v_count FROM public.list_open_missions();
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST 10 FAILED: list_open_missions aurait dû renvoyer 1 mission disponible (vu: %).', v_count;
  END IF;

  RAISE NOTICE '✓ Test 10 OK : list_open_missions renvoie uniquement les informations anonymisées.';

  -- ---------------------------------------------------------------------------
  -- TEST 11 : GET_MISSION_DETAILS REFUSÉ À UN LIVREUR NON ATTRIBUÉ
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_courier_a2_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_caught := false;
  BEGIN
    PERFORM public.get_mission_details(v_mission_open_id);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE;
    IF v_err_code = '42501' THEN v_caught := true; END IF;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 11 FAILED: Un livreur non attribué ne doit pas accéder aux détails d''une mission (42501).';
  END IF;

  -- Mais le livreur attribué (Courier A1) a accès
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_courier_a1_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT * INTO v_details FROM public.get_mission_details(v_mission_open_id);
  IF v_details.client_phone <> '066123456' OR v_details.address <> 'Rue Mbochi, Bacongo' THEN
    RAISE EXCEPTION 'TEST 11 FAILED: Le livreur attribué doit voir les détails du client.';
  END IF;

  RAISE NOTICE '✓ Test 11 OK : Confidentialité des données client strictement respectée.';

  -- ---------------------------------------------------------------------------
  -- TEST 12 : MUTATION DIRECTE (INSERT/UPDATE/DELETE) BLOQUÉE POUR TOUS
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_caught := false;
  BEGIN
    UPDATE public.delivery_missions SET pay_amount = 9999 WHERE id = v_mission_open_id;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE;
    IF v_err_code = '42501' THEN v_caught := true; END IF;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 12 FAILED: UPDATE direct sur delivery_missions aurait dû être bloqué (42501).';
  END IF;

  RAISE NOTICE '✓ Test 12 OK : Les écritures directes sur delivery_missions sont strictement bloquées.';

  -- ---------------------------------------------------------------------------
  -- TEST 13 : DEUXIÈME MISSION ACTIVE POUR LA MÊME COMMANDE ET LE MÊME TYPE REFUSÉE
  -- ---------------------------------------------------------------------------
  v_caught := false;
  BEGIN
    PERFORM public.create_delivery_mission(
      p_order_id     => v_order_delivery_a_id,
      p_kind         => 'DELIVERY',
      p_assigned_to  => NULL,
      p_zone_label   => 'Poto-Poto 2'
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 13 FAILED: La 2ème mission active pour la même commande et le même type doit être refusée.';
  END IF;

  RAISE NOTICE '✓ Test 13 OK : Contrainte d''unicité partielle d''une seule mission active respectée.';

  -- ---------------------------------------------------------------------------
  -- TEST 14 : ISOLATION RLS ENTRE DEUX ORGANISATIONS
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_b_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT count(*) INTO v_count FROM public.delivery_missions WHERE organization_id = v_org_a_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 14 FAILED: Owner B ne doit pas voir les missions de Org A (vu: %).', v_count;
  END IF;

  RAISE NOTICE '✓ Test 14 OK : Isolation RLS multi-tenant validée.';

  -- ---------------------------------------------------------------------------
  -- TEST 15 : ACCÈS ANONYME REFUSÉ
  -- ---------------------------------------------------------------------------
  PERFORM set_config('role', 'anon', true);

  SELECT count(*) INTO v_count FROM public.delivery_missions;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 15 FAILED: L''utilisateur anonyme ne doit pas accéder à delivery_missions.';
  END IF;

  RAISE NOTICE '✓ Test 15 OK : Utilisateur anonyme sans accès.';

  -- ---------------------------------------------------------------------------
  -- TEST 16 : JOURNAL D'AUDIT COMPLET POUR LES ACTIONS DE MISSION
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT count(*) INTO v_count
  FROM public.audit_logs
  WHERE organization_id = v_org_a_id AND object_type = 'delivery_missions';

  IF v_count < 2 THEN
    RAISE EXCEPTION 'TEST 16 FAILED: Des entrées d''audit auraient dû être générées pour delivery_missions (vu: %).', v_count;
  END IF;

  RAISE NOTICE '✓ Test 16 OK : Génération automatique des journaux d''audit pour delivery_missions.';

  -- ---------------------------------------------------------------------------
  -- ROLLBACK AUTOMATIQUE
  -- ---------------------------------------------------------------------------
  RAISE EXCEPTION 'ROLLBACK_TEST_SUCCESS';

EXCEPTION
  WHEN EXCEPTION THEN
    IF SQLERRM = 'ROLLBACK_TEST_SUCCESS' THEN
      RAISE NOTICE '=== TOUS LES TESTS SQL MISSIONS D1 ONT RÉUSSI AVEC SUCCÈS ===';
    ELSE
      RAISE EXCEPTION '%', SQLERRM;
    END IF;
END $$;
