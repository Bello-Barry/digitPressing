-- =============================================================================
-- TESTS D'ISOLATION MULTI-TENANT & RLS - TÂCHE 3.0 (Mise à jour Tâche 3.9)
-- Vérification de l'étanchéité entre organisations et confidentialité des coûts
-- =============================================================================

DO $$
DECLARE
  v_user_a_id UUID := 'a1111111-1111-1111-1111-111111111111'; -- Owner Org Demo A
  v_user_b_id UUID := 'b2222222-2222-2222-2222-222222222222'; -- Cashier Org Demo B
  v_org_a_id  UUID := 'a0000000-0000-0000-0000-000000000000'; -- Demo Org A
  v_org_b_id  UUID := 'b0000000-0000-0000-0000-000000000000'; -- Demo Org B

  v_service_a_id UUID;
  v_service_b_id UUID;
  v_service_b_inactive_id UUID;
  v_order_a_id   UUID;
  v_order_b_id   UUID;
  v_payment_a_id UUID;

  v_count INTEGER;
  v_caught BOOLEAN := false;
  v_summary_count INTEGER;
BEGIN
  RAISE NOTICE '=== DÉBUT DES TESTS D''ISOLATION MULTI-TENANT ET SÉCURITÉ 3.9 ===';

  RESET ROLE;

  -- 1. SETUP DES ORGANISATIONS DE DÉMONSTRATION
  INSERT INTO public.organizations (id, name, slug, ticket_prefix, country_code, currency, is_active)
  VALUES
    (v_org_a_id, 'Pressing Demo Alpha', 'demo-alpha-30', 'PA', '242', 'XAF', true),
    (v_org_b_id, 'Pressing Demo Beta',  'demo-beta-30',  'PB', '242', 'XAF', true)
  ON CONFLICT (id) DO NOTHING;

  -- SETUP UTILISATEURS
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (v_user_a_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.alpha@test.cg', crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_user_b_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cashier.beta@test.cg', crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- SETUP MEMBERSHIPS
  INSERT INTO public.memberships (user_id, organization_id, role, is_active)
  VALUES
    (v_user_a_id, v_org_a_id, 'OWNER', true),
    (v_user_b_id, v_org_b_id, 'CASHIER', true)
  ON CONFLICT (user_id, organization_id) DO UPDATE SET role = EXCLUDED.role, is_active = true;

  -- CREATION DONNEES DE TEST DANS CHAQUE ORG
  INSERT INTO public.services (organization_id, name, price, is_active)
  VALUES (v_org_a_id, 'Service Alpha Express', 5000, true)
  RETURNING id INTO v_service_a_id;

  INSERT INTO public.services (organization_id, name, price, is_active)
  VALUES (v_org_b_id, 'Service Beta VIP', 10000, true)
  RETURNING id INTO v_service_b_id;

  -- Service INACTIF d'un autre pressing (Org B)
  INSERT INTO public.services (organization_id, name, price, is_active)
  VALUES (v_org_b_id, 'Service Beta Archives Inactif', 12000, false)
  RETURNING id INTO v_service_b_inactive_id;

  -- Insertion d'un coût interne dans service_costs
  INSERT INTO public.service_costs (service_id, organization_id, cost_price)
  VALUES (v_service_a_id, v_org_a_id, 1500)
  ON CONFLICT (service_id) DO UPDATE SET cost_price = 1500;

  INSERT INTO public.orders (organization_id, client_name, client_phone, total_amount, subtotal, status)
  VALUES (v_org_a_id, 'Client Alpha', '061111111', 5000, 5000, 'RECEIVED')
  RETURNING id INTO v_order_a_id;

  INSERT INTO public.orders (organization_id, client_name, client_phone, total_amount, subtotal, status)
  VALUES (v_org_b_id, 'Client Beta', '062222222', 10000, 10000, 'RECEIVED')
  RETURNING id INTO v_order_b_id;

  INSERT INTO public.payments (organization_id, order_id, amount, method, collected_by)
  VALUES (v_org_a_id, v_order_a_id, 5000, 'CASH', v_user_a_id)
  RETURNING id INTO v_payment_a_id;

  -- ---------------------------------------------------------------------------
  -- TEST 1 : SIMULATION CONTEXTE USER A (Pressing Demo Alpha - OWNER)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- 1a. User A doit voir sa propre commande
  SELECT COUNT(*) INTO v_count FROM public.orders WHERE organization_id = v_org_a_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST FAILED 1a: User A devrait voir 1 commande dans Org A, vu: %', v_count;
  END IF;

  -- 1b. User A ne doit voir AUCUNE commande de Org B
  SELECT COUNT(*) INTO v_count FROM public.orders WHERE organization_id = v_org_b_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST FAILED 1b: User A ne doit voir AUCUNE commande de Org B, vu: %', v_count;
  END IF;

  -- 1c. Les services ACTIFS sont publics par conception, mais un service INACTIF d'un autre pressing est invisible
  SELECT COUNT(*) INTO v_count FROM public.services WHERE organization_id = v_org_b_id AND is_active = false;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST FAILED 1c: Un service INACTIF d''un autre pressing ne doit pas être visible (vu: %)', v_count;
  END IF;

  -- 1d. User A via order_payment_summary ne voit que Org A
  SELECT COUNT(*) INTO v_summary_count FROM public.order_payment_summary WHERE organization_id = v_org_b_id;
  IF v_summary_count <> 0 THEN
    RAISE EXCEPTION 'TEST FAILED 1d: Vue order_payment_summary leak des données de Org B vers User A (vu: %)', v_summary_count;
  END IF;

  RAISE NOTICE '✓ Test 1 OK : User A est totalement isolé dans Org A et les services inactifs distants sont masqués';

  -- ---------------------------------------------------------------------------
  -- TEST 2 : CONTEXTE ANONYME (ANON) - VERIFICATION SECURITE DU COUT INTERNE
  -- ---------------------------------------------------------------------------
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claims', NULL, true);

  -- 2a. anon ne peut lire aucun coût dans service_costs
  SELECT COUNT(*) INTO v_count FROM public.service_costs;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST FAILED 2a: Rôle anon a pu lire dans service_costs ! (vu: %)', v_count;
  END IF;

  RAISE NOTICE '✓ Test 2 OK : Rôle anon est totalement bloqué sur les coûts internes';

  -- ---------------------------------------------------------------------------
  -- NETTOYAGE DES DONNÉES DE TEST
  -- ---------------------------------------------------------------------------
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);

  DELETE FROM public.service_costs WHERE organization_id IN (v_org_a_id, v_org_b_id);
  DELETE FROM public.payments WHERE organization_id IN (v_org_a_id, v_org_b_id);
  DELETE FROM public.order_items WHERE organization_id IN (v_org_a_id, v_org_b_id);
  DELETE FROM public.orders WHERE organization_id IN (v_org_a_id, v_org_b_id);
  DELETE FROM public.services WHERE organization_id IN (v_org_a_id, v_org_b_id);
  DELETE FROM public.memberships WHERE organization_id IN (v_org_a_id, v_org_b_id);
  DELETE FROM auth.users WHERE id IN (v_user_a_id, v_user_b_id);
  DELETE FROM public.organizations WHERE id IN (v_org_a_id, v_org_b_id);

  RAISE NOTICE '=== TOUS LES TESTS D''ISOLATION ET DE SÉCURITÉ 3.0 / 3.9 ONT RÉUSSI AVEC SUCCÈS ===';
END $$;
