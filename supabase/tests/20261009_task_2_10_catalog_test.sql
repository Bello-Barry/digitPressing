-- =============================================================================
-- TEST AUTOMATISÉ POUR LE CATALOGUE NORMALISÉ (TÂCHE 2.10)
-- Validation RLS, isolement multi-tenant, refus des doublons normalisés et rôles
-- Annulation finale automatique via RAISE EXCEPTION 'ROLLBACK_TEST_SUCCESS'
-- Refus accepté seulement si SQLSTATE 42501 (insufficient_privilege) ou 23505 (unique_violation)
-- =============================================================================

DO $$
DECLARE
  v_org_a_id UUID := 'a2100000-0000-0000-0000-000000000000';
  v_org_b_id UUID := 'b2100000-0000-0000-0000-000000000000';

  v_owner_a_id   UUID := 'a2101111-1111-1111-1111-111111111111';
  v_manager_a_id UUID := 'a2102222-2222-2222-2222-222222222222';
  v_cashier_a_id UUID := 'a2103333-3333-3333-3333-333333333333';
  v_owner_b_id   UUID := 'b2101111-1111-1111-1111-111111111111';

  v_cat_a_id UUID;
  v_garment_a_id UUID;

  v_count_cats INTEGER;
  v_count_garments INTEGER;
  v_count INTEGER;
  v_caught BOOLEAN := false;
  v_err_code TEXT;
BEGIN
  RAISE NOTICE '=== DÉBUT DES TESTS SQL CATALOGUE NORMALISÉ (TÂCHE 2.10) ===';

  RESET ROLE;

  -- 1. SETUP ORGANISATIONS DE TEST
  INSERT INTO public.organizations (id, name, slug, ticket_prefix, country_code, currency, is_active)
  VALUES
    (v_org_a_id, 'Pressing Catalog Test A', 'cat-test-a-210', 'CA', '242', 'XAF', true),
    (v_org_b_id, 'Pressing Catalog Test B', 'cat-test-b-210', 'CB', '242', 'XAF', true)
  ON CONFLICT (id) DO NOTHING;

  -- SETUP UTILISATEURS
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (v_owner_a_id,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.a@cat.test',   crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_manager_a_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manager.a@cat.test', crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_cashier_a_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cashier.a@cat.test', crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_owner_b_id,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.b@cat.test',   crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- SETUP MEMBERSHIPS
  INSERT INTO public.memberships (user_id, organization_id, role, is_active)
  VALUES
    (v_owner_a_id,   v_org_a_id, 'OWNER',   true),
    (v_manager_a_id, v_org_a_id, 'MANAGER', true),
    (v_cashier_a_id, v_org_a_id, 'CASHIER', true),
    (v_owner_b_id,   v_org_b_id, 'OWNER',   true)
  ON CONFLICT (user_id, organization_id) DO UPDATE SET role = EXCLUDED.role, is_active = true;

  -- 2. SEED DU CATALOGUE PAR DÉFAUT
  PERFORM public.seed_default_catalog(v_org_a_id);
  PERFORM public.seed_default_catalog(v_org_b_id);


  -- ---------------------------------------------------------------------------
  -- TEST 1 : OWNER PEUT LIRE ET CRÉER DANS LE CATALOGUE DE SON ORG
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- 1a. OWNER voit au moins les 7 catégories et les articles du seed
  SELECT COUNT(*) INTO v_count_cats FROM public.service_categories WHERE organization_id = v_org_a_id;
  SELECT COUNT(*) INTO v_count_garments FROM public.garment_types WHERE organization_id = v_org_a_id;

  IF v_count_cats < 7 THEN
    RAISE EXCEPTION 'TEST 1a FAILED: OWNER A doit voir au moins 7 catégories du seed (vu: %)', v_count_cats;
  END IF;

  IF v_count_garments < 10 THEN
    RAISE EXCEPTION 'TEST 1a FAILED: OWNER A doit voir les articles du seed (vu: %)', v_count_garments;
  END IF;

  -- 1b. OWNER crée une catégorie et un article spécifiques
  INSERT INTO public.service_categories (organization_id, name, sort_order)
  VALUES (v_org_a_id, 'Accessoires Spéciaux', 20)
  RETURNING id INTO v_cat_a_id;

  INSERT INTO public.garment_types (organization_id, category_id, name)
  VALUES (v_org_a_id, v_cat_a_id, 'Chapeau')
  RETURNING id INTO v_garment_a_id;

  RAISE NOTICE '✓ Test 1 OWNER OK : Seed verifié (% catégories, % articles) et création personnalisée', v_count_cats, v_count_garments;


  -- ---------------------------------------------------------------------------
  -- TEST 2 : REFUS DU DOUBLON NORMALISÉ (Casse & accents)
  -- ---------------------------------------------------------------------------
  v_caught := false;
  BEGIN
    -- Doit échouer car "chapeau" existe déjà sous "Chapeau" dans v_org_a_id
    INSERT INTO public.garment_types (organization_id, category_id, name)
    VALUES (v_org_a_id, v_cat_a_id, '  châpeau  ');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE;
    IF v_err_code = '23505' THEN
      v_caught := true;
    ELSE
      RAISE EXCEPTION 'TEST 2 FAILED: Code d''erreur inattendu pour le doublon: SQLSTATE %', v_err_code;
    END IF;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 2 FAILED: Le doublon normalisé "châpeau" n''a PAS été refusé par l''index unique !';
  END IF;

  RAISE NOTICE '✓ Test 2 DOUBLON NORMALISÉ REFUSÉ OK';


  -- ---------------------------------------------------------------------------
  -- TEST 3 : CASHIER LIT LE CATALOGUE MAIS NE PEUT NI CRÉER NI MODIFIER
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_cashier_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- 3a. Cashier lit les catégories
  SELECT COUNT(*) INTO v_count FROM public.service_categories WHERE organization_id = v_org_a_id;
  IF v_count <> v_count_cats + 1 THEN
    RAISE EXCEPTION 'TEST 3a FAILED: CASHIER doit pouvoir lire le catalogue (vu: %, attendu: %)', v_count, v_count_cats + 1;
  END IF;

  -- 3b. Cashier tente de créer une catégorie
  v_caught := false;
  BEGIN
    INSERT INTO public.service_categories (organization_id, name)
    VALUES (v_org_a_id, 'Catégorie Intruse Cashier');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE;
    IF v_err_code = '42501' THEN
      v_caught := true;
    ELSE
      RAISE EXCEPTION 'TEST 3b FAILED: Code d''erreur inattendu pour création catégorie par cashier: SQLSTATE %', v_err_code;
    END IF;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 3b FAILED: CASHIER a pu créer une catégorie !';
  END IF;

  -- 3c. Cashier tente de créer un article
  v_caught := false;
  BEGIN
    INSERT INTO public.garment_types (organization_id, category_id, name)
    VALUES (v_org_a_id, v_cat_a_id, 'Article Intrus Cashier');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE;
    IF v_err_code = '42501' THEN
      v_caught := true;
    ELSE
      RAISE EXCEPTION 'TEST 3c FAILED: Code d''erreur inattendu pour création article par cashier: SQLSTATE %', v_err_code;
    END IF;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 3c FAILED: CASHIER a pu créer un article !';
  END IF;

  RAISE NOTICE '✓ Test 3 CASHIER OK : Lecture autorisée, écriture bloquée';


  -- ---------------------------------------------------------------------------
  -- TEST 4 : ÉTANCHÉITÉ MULTI-TENANT (Owner B ne voit pas le catalogue de Org A)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_b_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT COUNT(*) INTO v_count
  FROM public.garment_types
  WHERE organization_id = v_org_a_id AND id = v_garment_a_id;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 4 FAILED: Owner B ne doit PAS voir les articles spécifiques de Org A (vu: %)', v_count;
  END IF;

  RAISE NOTICE '✓ Test 4 ISOLATION ORGS OK : Owner B ne voit pas les articles de Org A';


  -- ---------------------------------------------------------------------------
  -- ANNULATION AUTOMATIQUE (ROLLBACK SANITAIRE)
  -- ---------------------------------------------------------------------------
  RAISE EXCEPTION 'ROLLBACK_TEST_SUCCESS';

EXCEPTION
  WHEN EXCEPTION THEN
    IF SQLERRM = 'ROLLBACK_TEST_SUCCESS' THEN
      RAISE NOTICE '=== TOUS LES TESTS SQL 2.10 CATALOGUE ONT RÉUSSI AVEC SUCCÈS (DONNÉES NETTOYÉES) ===';
    ELSE
      RAISE EXCEPTION '%', SQLERRM;
    END IF;
END $$;
