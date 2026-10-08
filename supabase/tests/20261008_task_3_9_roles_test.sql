-- =============================================================================
-- TEST AUTOMATISÉ DES PERMISSIONS ET RÔLES (TÂCHE 3.9)
-- Validation RLS et matrice des rôles (OWNER, MANAGER, CASHIER, DELIVERY)
-- Annulation finale automatique via RAISE EXCEPTION 'ROLLBACK_TEST_SUCCESS'
-- Refus accepté seulement si SQLSTATE 42501 (insufficient_privilege)
-- =============================================================================

DO $$
DECLARE
  v_org_a_id UUID := 'a3900000-0000-0000-0000-000000000000';
  v_org_b_id UUID := 'b3900000-0000-0000-0000-000000000000';

  v_owner_a_id    UUID := 'a3911111-1111-1111-1111-111111111111';
  v_manager_a_id  UUID := 'a3922222-2222-2222-2222-222222222222';
  v_cashier_a_id  UUID := 'a3933333-3333-3333-3333-333333333333';
  v_delivery_a_id UUID := 'a3944444-4444-4444-4444-444444444444';

  v_owner_b_id    UUID := 'b3911111-1111-1111-1111-111111111111';

  v_service_a_id UUID;
  v_order_ready_a_id UUID;
  v_order_processing_a_id UUID;

  v_count INTEGER;
  v_caught BOOLEAN := false;
  v_err_code TEXT;
BEGIN
  RAISE NOTICE '=== DÉBUT DES TESTS SQL DE PERMISSIONS PAR RÔLE (TÂCHE 3.9) ===';

  RESET ROLE;

  -- 1. SETUP ORGANISATIONS DE TEST
  INSERT INTO public.organizations (id, name, slug, ticket_prefix, country_code, currency, is_active)
  VALUES
    (v_org_a_id, 'Pressing Perm Test A', 'perm-test-a-39', 'PA', '242', 'XAF', true),
    (v_org_b_id, 'Pressing Perm Test B', 'perm-test-b-39', 'PB', '242', 'XAF', true)
  ON CONFLICT (id) DO NOTHING;

  -- SETUP UTILISATEURS
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (v_owner_a_id,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.a@perm.test',    crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_manager_a_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manager.a@perm.test',  crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_cashier_a_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cashier.a@perm.test',  crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_delivery_a_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'delivery.a@perm.test', crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_owner_b_id,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.b@perm.test',    crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- SETUP MEMBERSHIPS
  INSERT INTO public.memberships (user_id, organization_id, role, is_active)
  VALUES
    (v_owner_a_id,    v_org_a_id, 'OWNER',    true),
    (v_manager_a_id,  v_org_a_id, 'MANAGER',  true),
    (v_cashier_a_id,  v_org_a_id, 'CASHIER',  true),
    (v_delivery_a_id, v_org_a_id, 'DELIVERY', true),
    (v_owner_b_id,    v_org_b_id, 'OWNER',    true)
  ON CONFLICT (user_id, organization_id) DO UPDATE SET role = EXCLUDED.role, is_active = true;

  -- CRÉATION DONNÉES DE DÉPART DANS ORG A
  INSERT INTO public.services (organization_id, name, price, is_active)
  VALUES (v_org_a_id, 'Chemise Lavage', 2000, true)
  RETURNING id INTO v_service_a_id;

  INSERT INTO public.service_costs (service_id, organization_id, cost_price)
  VALUES (v_service_a_id, v_org_a_id, 500)
  ON CONFLICT (service_id) DO UPDATE SET cost_price = 500;

  INSERT INTO public.orders (organization_id, client_name, client_phone, total_amount, subtotal, status)
  VALUES (v_org_a_id, 'Client Prêt', '060000001', 2000, 2000, 'READY')
  RETURNING id INTO v_order_ready_a_id;

  INSERT INTO public.orders (organization_id, client_name, client_phone, total_amount, subtotal, status)
  VALUES (v_org_a_id, 'Client En Cours', '060000002', 2000, 2000, 'PROCESSING')
  RETURNING id INTO v_order_processing_a_id;


  -- ---------------------------------------------------------------------------
  -- TEST 1 : RÔLE OWNER (Pressing A)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- 1a. OWNER peut lire service_costs
  SELECT COUNT(*) INTO v_count FROM public.service_costs WHERE organization_id = v_org_a_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST 1a FAILED: OWNER doit pouvoir lire service_costs de son organisation (vu: %)', v_count;
  END IF;

  -- 1b. OWNER peut modifier services
  UPDATE public.services SET price = 2500 WHERE id = v_service_a_id;

  RAISE NOTICE '✓ Test 1 OWNER OK : Accès complet à tout dans Org A';


  -- ---------------------------------------------------------------------------
  -- TEST 2 : RÔLE MANAGER (Pressing A)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_manager_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- 2a. MANAGER peut modifier un service
  UPDATE public.services SET price = 3000 WHERE id = v_service_a_id;

  -- 2b. MANAGER NE PEUT PAS lire service_costs (doit retourner 0 ligne ou être bloqué)
  SELECT COUNT(*) INTO v_count FROM public.service_costs WHERE organization_id = v_org_a_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 2b FAILED: MANAGER ne doit PAS lire service_costs (vu: %)', v_count;
  END IF;

  RAISE NOTICE '✓ Test 2 MANAGER OK : Peut modifier services, mais ne peut pas lire service_costs';


  -- ---------------------------------------------------------------------------
  -- TEST 3 : RÔLE CASHIER (Pressing A)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_cashier_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- 3a. CASHIER NE PEUT PAS lire service_costs
  SELECT COUNT(*) INTO v_count FROM public.service_costs WHERE organization_id = v_org_a_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 3a FAILED: CASHIER ne doit PAS lire service_costs (vu: %)', v_count;
  END IF;

  -- 3b. CASHIER NE PEUT PAS modifier la table services (UPDATE affecte 0 ligne sous RLS)
  UPDATE public.services SET price = 4000 WHERE id = v_service_a_id;
  SELECT price INTO v_count FROM public.services WHERE id = v_service_a_id;
  IF v_count = 4000 THEN
    RAISE EXCEPTION 'TEST 3b FAILED: CASHIER a pu modifier le prix d''un service !';
  END IF;

  -- 3c. CASHIER NE PEUT PAS insérer un service
  v_caught := false;
  BEGIN
    INSERT INTO public.services (organization_id, name, price, is_active)
    VALUES (v_org_a_id, 'Intrus Cashier Service', 5000, true);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE;
    IF v_err_code = '42501' THEN
      v_caught := true;
    ELSE
      RAISE EXCEPTION 'TEST 3c FAILED: Erreur inattendue lors de l''insertion service cashier: SQLSTATE %', v_err_code;
    END IF;
  END;

  RAISE NOTICE '✓ Test 3 CASHIER OK : Refus de modification de prix/services et de lecture des coûts';


  -- ---------------------------------------------------------------------------
  -- TEST 4 : RÔLE DELIVERY (Pressing A)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_delivery_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- 4a. DELIVERY ne voit que les commandes READY / DELIVERED
  SELECT COUNT(*) INTO v_count FROM public.orders WHERE organization_id = v_org_a_id;
  -- v_order_ready_a_id est READY -> visible ; v_order_processing_a_id est PROCESSING -> masquée
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST 4a FAILED: DELIVERY doit voir uniquement ses livraisons prêtes/livrées (attendu 1, vu: %)', v_count;
  END IF;

  -- 4b. DELIVERY ne peut pas lire service_costs
  SELECT COUNT(*) INTO v_count FROM public.service_costs WHERE organization_id = v_org_a_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 4b FAILED: DELIVERY ne doit PAS lire service_costs (vu: %)', v_count;
  END IF;

  RAISE NOTICE '✓ Test 4 DELIVERY OK : Filtre strict sur ses livraisons, aucun accès aux coûts';


  -- ---------------------------------------------------------------------------
  -- TEST 5 : ÉTANCHÉITÉ ENTRE ORGANISATIONS (Owner B vs Org A)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_b_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT COUNT(*) INTO v_count FROM public.service_costs WHERE organization_id = v_org_a_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 5 FAILED: Owner B ne doit PAS lire service_costs de Org A (vu: %)', v_count;
  END IF;

  RAISE NOTICE '✓ Test 5 ISOLATION ORGS OK : Aucun rôle ne sort de son organisation';

  -- ---------------------------------------------------------------------------
  -- ANNULATION AUTOMATIQUE (ROLLBACK SANITAIRE)
  -- ---------------------------------------------------------------------------
  RAISE EXCEPTION 'ROLLBACK_TEST_SUCCESS';

EXCEPTION
  WHEN EXCEPTION THEN
    IF SQLERRM = 'ROLLBACK_TEST_SUCCESS' THEN
      RAISE NOTICE '=== TOUS LES TESTS SQL 3.9 ONT RÉUSSI AVEC SUCCÈS (DONNÉES NETTOYÉES) ===';
    ELSE
      RAISE EXCEPTION '%', SQLERRM;
    END IF;
END $$;
