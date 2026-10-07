-- =============================================================================
-- TESTS D'ISOLATION MULTI-TENANT & RLS - TÂCHE 3.0
-- Vérification de l'étanchéité entre deux organisations de démonstration.
-- Rollback automatique via RAISE EXCEPTION sans aucun DELETE physique.
-- Ne touche JAMAIS à l'organisation réelle LB Pressing.
-- =============================================================================

DO $$
DECLARE
  -- Identifiants fixes de démonstration (isolation stricte)
  v_user_a_id UUID := 'a1111111-1111-1111-1111-111111111111'; -- Owner Org Demo Alpha
  v_user_b_id UUID := 'b2222222-2222-2222-2222-222222222222'; -- Cashier Org Demo Beta
  v_org_a_id  UUID := 'a0000000-0000-0000-0000-000000000000'; -- Demo Org Alpha
  v_org_b_id  UUID := 'b0000000-0000-0000-0000-000000000000'; -- Demo Org Beta

  v_service_a_id UUID;
  v_service_b_id UUID;
  v_order_a_id   UUID;
  v_order_b_id   UUID;
  v_payment_a_id UUID;

  v_count INTEGER;
  v_summary_count INTEGER;

  -- Compteurs de bilan de tests
  v_passed INTEGER := 0;
  v_failed INTEGER := 0;
  v_failures TEXT[] := ARRAY[]::TEXT[];
  v_caught BOOLEAN := false;
  v_failures_msg TEXT := '';
BEGIN
  -- Reset initiale des rôles/claims (contexte superutilisateur pour insérer le jeu d'essai)
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);

  -- 1. SETUP DES ORGANISATIONS DE DEMONSTRATION
  INSERT INTO public.organizations (id, name, slug, ticket_prefix, country_code, currency, is_active)
  VALUES
    (v_org_a_id, 'Pressing Demo Alpha 30', 'demo-alpha-30', 'PA', '242', 'XAF', true),
    (v_org_b_id, 'Pressing Demo Beta 30',  'demo-beta-30',  'PB', '242', 'XAF', true)
  ON CONFLICT (id) DO NOTHING;

  -- SETUP DES UTILISATEURS AUTH.USERS
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (v_user_a_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.alpha.30@test.cg', crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_user_b_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cashier.beta.30@test.cg', crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- SETUP DES MEMBERSHIPS
  INSERT INTO public.memberships (user_id, organization_id, role, is_active)
  VALUES
    (v_user_a_id, v_org_a_id, 'OWNER', true),
    (v_user_b_id, v_org_b_id, 'CASHIER', true)
  ON CONFLICT (user_id, organization_id) DO UPDATE SET role = EXCLUDED.role, is_active = true;

  -- SETUP SERVICES
  INSERT INTO public.services (organization_id, name, price, is_active)
  VALUES (v_org_a_id, 'Service Alpha Express', 5000, true)
  RETURNING id INTO v_service_a_id;

  INSERT INTO public.services (organization_id, name, price, is_active)
  VALUES (v_org_b_id, 'Service Beta VIP', 10000, true)
  RETURNING id INTO v_service_b_id;

  -- SETUP ORDERS
  INSERT INTO public.orders (organization_id, client_name, client_phone, total_amount, subtotal, status)
  VALUES (v_org_a_id, 'Client Alpha', '061111111', 5000, 5000, 'RECEIVED')
  RETURNING id INTO v_order_a_id;

  INSERT INTO public.orders (organization_id, client_name, client_phone, total_amount, subtotal, status)
  VALUES (v_org_b_id, 'Client Beta', '062222222', 10000, 10000, 'RECEIVED')
  RETURNING id INTO v_order_b_id;

  -- SETUP PAYMENTS
  INSERT INTO public.payments (organization_id, order_id, amount, method, collected_by)
  VALUES (v_org_a_id, v_order_a_id, 5000, 'CASH', v_user_a_id)
  RETURNING id INTO v_payment_a_id;

  -- ===========================================================================
  -- TESTS SOUS LE CONTEXTE USER A (Owner Demo Org Alpha)
  -- ===========================================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- 1a. User A voit sa propre commande dans Org A
  SELECT COUNT(*) INTO v_count FROM public.orders WHERE organization_id = v_org_a_id;
  IF v_count = 1 THEN
    v_passed := v_passed + 1;
  ELSE
    v_failed := v_failed + 1;
    v_failures := array_append(v_failures, '1a: User A devrait voir 1 commande dans Org A');
  END IF;

  -- 1b. User A ne voit AUCUNE commande de Org B
  SELECT COUNT(*) INTO v_count FROM public.orders WHERE organization_id = v_org_b_id;
  IF v_count = 0 THEN
    v_passed := v_passed + 1;
  ELSE
    v_failed := v_failed + 1;
    v_failures := array_append(v_failures, '1b: User A ne doit voir aucune commande de Org B');
  END IF;

  -- 1c. User A ne voit AUCUN paiement de Org B
  SELECT COUNT(*) INTO v_count FROM public.payments WHERE organization_id = v_org_b_id;
  IF v_count = 0 THEN
    v_passed := v_passed + 1;
  ELSE
    v_failed := v_failed + 1;
    v_failures := array_append(v_failures, '1c: User A ne doit voir aucun paiement de Org B');
  END IF;

  -- 1d. User A via order_payment_summary ne voit aucun résumé de Org B
  SELECT COUNT(*) INTO v_summary_count FROM public.order_payment_summary WHERE organization_id = v_org_b_id;
  IF v_summary_count = 0 THEN
    v_passed := v_passed + 1;
  ELSE
    v_failed := v_failed + 1;
    v_failures := array_append(v_failures, '1d: Vue order_payment_summary leak des données de Org B vers User A');
  END IF;

  -- 1e. Rejet d'insertion de commande dans Org B par User A
  v_caught := false;
  BEGIN
    INSERT INTO public.orders (organization_id, client_name, client_phone, total_amount, subtotal)
    VALUES (v_org_b_id, 'Intrus Alpha', '063333333', 1000, 1000);
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;
  IF v_caught THEN
    v_passed := v_passed + 1;
  ELSE
    v_failed := v_failed + 1;
    v_failures := array_append(v_failures, '1e: User A a pu insérer une commande dans Org B');
  END IF;

  -- 1f. Rejet ou non-effet de modification d'une commande de Org B par User A
  UPDATE public.orders SET client_name = 'Hacked' WHERE id = v_order_b_id;
  SELECT COUNT(*) INTO v_count FROM public.orders WHERE id = v_order_b_id AND client_name = 'Hacked';
  IF v_count = 0 THEN
    v_passed := v_passed + 1;
  ELSE
    v_failed := v_failed + 1;
    v_failures := array_append(v_failures, '1f: User A a pu modifier une commande de Org B');
  END IF;

  -- ===========================================================================
  -- TESTS SOUS LE CONTEXTE USER B (Cashier Demo Org Beta)
  -- ===========================================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- 2a. User B ne voit AUCUNE commande de Org A
  SELECT COUNT(*) INTO v_count FROM public.orders WHERE organization_id = v_org_a_id;
  IF v_count = 0 THEN
    v_passed := v_passed + 1;
  ELSE
    v_failed := v_failed + 1;
    v_failures := array_append(v_failures, '2a: User B ne doit voir aucune commande de Org A');
  END IF;

  -- 2b. User B ne voit AUCUN paiement de Org A
  SELECT COUNT(*) INTO v_count FROM public.payments WHERE organization_id = v_org_a_id;
  IF v_count = 0 THEN
    v_passed := v_passed + 1;
  ELSE
    v_failed := v_failed + 1;
    v_failures := array_append(v_failures, '2b: User B ne doit voir aucun paiement de Org A');
  END IF;

  -- 2c. User B via order_payment_summary ne voit aucun résumé de Org A
  SELECT COUNT(*) INTO v_summary_count FROM public.order_payment_summary WHERE organization_id = v_org_a_id;
  IF v_summary_count = 0 THEN
    v_passed := v_passed + 1;
  ELSE
    v_failed := v_failed + 1;
    v_failures := array_append(v_failures, '2c: Vue order_payment_summary leak des données de Org A vers User B');
  END IF;

  -- 2d. Rejet d'insertion de paiement sur Org A par User B
  v_caught := false;
  BEGIN
    INSERT INTO public.payments (organization_id, order_id, amount, method, collected_by)
    VALUES (v_org_a_id, v_order_a_id, 2000, 'CASH', v_user_b_id);
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;
  IF v_caught THEN
    v_passed := v_passed + 1;
  ELSE
    v_failed := v_failed + 1;
    v_failures := array_append(v_failures, '2d: User B a pu insérer un paiement dans Org A');
  END IF;

  -- Reset role pour préparer le résumé
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);

  -- Formatting failures list
  IF array_length(v_failures, 1) IS NULL OR array_length(v_failures, 1) = 0 THEN
    v_failures_msg := 'Aucun échec';
  ELSE
    v_failures_msg := array_to_string(v_failures, ', ');
  END IF;

  -- ===========================================================================
  -- FIN DES TESTS : ANNULATION AUTOMATIQUE DE TOUTES LES DONNEES CRÉÉES
  -- Aucun DELETE physique n'est exécuté : le RAISE EXCEPTION effectue un rollback.
  -- ===========================================================================
  RAISE EXCEPTION 'TESTS ISOLATION : % réussis, % échoués : %',
    v_passed, v_failed, v_failures_msg;

END $$;
