-- =============================================================================
-- TEST AUTOMATISÉ : DÉPENSES DU PRESSING & CAISSE/RÉSULTAT (TÂCHE 4.8)
-- Valide RLS, plafonds, catégories, immuabilité, annulation, audit et clôture
-- Rollback automatique via RAISE EXCEPTION 'ROLLBACK_TEST_SUCCESS'
-- =============================================================================

DO $$
DECLARE
  v_org_a_id UUID := 'a4800000-0000-0000-0000-000000000000';
  v_org_b_id UUID := 'b4800000-0000-0000-0000-000000000000';

  v_owner_a_id    UUID := 'a4811111-1111-1111-1111-111111111111';
  v_manager_a_id  UUID := 'a4822222-2222-2222-2222-222222222222';
  v_cashier_a_id  UUID := 'a4833333-3333-3333-3333-333333333333';
  v_delivery_a_id UUID := 'a4844444-4444-4444-4444-444444444444';

  v_owner_b_id    UUID := 'b4811111-1111-1111-1111-111111111111';

  v_cat_daily_a_id UUID;
  v_cat_salary_a_id UUID;
  v_cat_loyer_a_id UUID;

  v_expense_a1_id UUID;
  v_count INTEGER;
  v_caught BOOLEAN := false;
  v_err_code TEXT;
  v_expected_balance NUMERIC;
BEGIN
  RAISE NOTICE '=== DÉBUT DU TEST SQL DÉPENSES (TÂCHE 4.8) ===';

  RESET ROLE;

  -- 1. SETUP ORGANISATIONS DE TEST AVEC PLAFOND CAISSIER = 10 000 FCFA
  INSERT INTO public.organizations (id, name, slug, ticket_prefix, country_code, currency, cashier_expense_limit, is_active)
  VALUES
    (v_org_a_id, 'Pressing Expenses Test A', 'expenses-test-a', 'EA', '242', 'XAF', 10000, true),
    (v_org_b_id, 'Pressing Expenses Test B', 'expenses-test-b', 'EB', '242', 'XAF', 10000, true)
  ON CONFLICT (id) DO UPDATE SET cashier_expense_limit = EXCLUDED.cashier_expense_limit;

  -- SEED DES CATÉGORIES
  PERFORM public.seed_default_expense_categories(v_org_a_id);
  PERFORM public.seed_default_expense_categories(v_org_b_id);

  -- Récupération des ID de catégories
  SELECT id INTO v_cat_daily_a_id FROM public.expense_categories WHERE organization_id = v_org_a_id AND name = 'Ration journalière des employés';
  SELECT id INTO v_cat_salary_a_id FROM public.expense_categories WHERE organization_id = v_org_a_id AND name = 'Salaires';
  SELECT id INTO v_cat_loyer_a_id FROM public.expense_categories WHERE organization_id = v_org_a_id AND name = 'Loyer';

  -- SETUP UTILISATEURS AUTH
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (v_owner_a_id,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.a@expenses.test',    crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_manager_a_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manager.a@expenses.test',  crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_cashier_a_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cashier.a@expenses.test',  crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_delivery_a_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'delivery.a@expenses.test', crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_owner_b_id,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.b@expenses.test',    crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW())
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

  -- ---------------------------------------------------------------------------
  -- TEST 1 : CAISSIER ENREGISTRE UNE DÉPENSE AUTORISÉE SOUS LE PLAFOND (5 000 FCFA)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_cashier_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_expense_a1_id := public.record_expense(
    p_org_id       => v_org_a_id,
    p_category_id  => v_cat_daily_a_id,
    p_amount       => 5000,
    p_expense_date => CURRENT_DATE,
    p_method       => 'CASH',
    p_from_till    => true,
    p_payee        => 'Employés ration',
    p_note         => 'Ration midi de l''équipe'
  );

  IF v_expense_a1_id IS NULL THEN
    RAISE EXCEPTION 'TEST 1 FAILED: record_expense n''a pas retourné d''ID de dépense.';
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.expenses WHERE id = v_expense_a1_id AND created_by = v_cashier_a_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST 1 FAILED: La dépense n''a pas été insérée correctement.';
  END IF;

  -- Vérification du déclencheur d'audit
  SELECT COUNT(*) INTO v_count FROM public.audit_logs WHERE organization_id = v_org_a_id AND object_type = 'expenses' AND object_id = v_expense_a1_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST 1 FAILED: La dépense n''a pas généré de log d''audit (vu: %).', v_count;
  END IF;

  RAISE NOTICE '✓ Test 1 OK : Le caissier a enregistré une dépense de 5 000 FCFA avec journal d''audit.';

  -- ---------------------------------------------------------------------------
  -- TEST 2 : CAISSIER ESSAYE DE DÉPASSER SON PLAFOND (15 000 > 10 000) -> REFUSÉ
  -- ---------------------------------------------------------------------------
  v_caught := false;
  BEGIN
    PERFORM public.record_expense(
      p_org_id       => v_org_a_id,
      p_category_id  => v_cat_daily_a_id,
      p_amount       => 15000,
      p_expense_date => CURRENT_DATE,
      p_method       => 'CASH',
      p_from_till    => true
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE;
    IF v_err_code = '42501' THEN v_caught := true; END IF;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 2 FAILED: La dépense dépassant le plafond aurait dû être refusée (42501).';
  END IF;

  RAISE NOTICE '✓ Test 2 OK : Dépense au-delà du plafond refusée avec SQLSTATE 42501.';

  -- ---------------------------------------------------------------------------
  -- TEST 3 : CAISSIER ESSAYE UNE CATÉGORIE NON AUTORISÉE (Loyer) -> REFUSÉ
  -- ---------------------------------------------------------------------------
  v_caught := false;
  BEGIN
    PERFORM public.record_expense(
      p_org_id       => v_org_a_id,
      p_category_id  => v_cat_loyer_a_id,
      p_amount       => 5000,
      p_expense_date => CURRENT_DATE,
      p_method       => 'CASH',
      p_from_till    => false
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE;
    IF v_err_code = '42501' THEN v_caught := true; END IF;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Le caissier ne doit pas enregistrer de Loyer (42501).';
  END IF;

  RAISE NOTICE '✓ Test 3 OK : Catégorie non autorisée au caissier refusée avec SQLSTATE 42501.';

  -- ---------------------------------------------------------------------------
  -- TEST 4 : MANAGER ESSAYE UNE CATÉGORIE OWNER_ONLY (Salaires) -> REFUSÉ
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_manager_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_caught := false;
  BEGIN
    PERFORM public.record_expense(
      p_org_id       => v_org_a_id,
      p_category_id  => v_cat_salary_a_id,
      p_amount       => 50000,
      p_expense_date => CURRENT_DATE,
      p_method       => 'CASH',
      p_from_till    => false
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE;
    IF v_err_code = '42501' THEN v_caught := true; END IF;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 4 FAILED: Le gérant ne doit pas enregistrer de Salaires (42501).';
  END IF;

  RAISE NOTICE '✓ Test 4 OK : Catégorie owner_only refusée au gérant avec SQLSTATE 42501.';

  -- ---------------------------------------------------------------------------
  -- TEST 5 : MODIFICATION DIRECTE DE MONTANT OU DELETE SUR EXPENSES -> REFUSÉ
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- Tentative d'UPDATE direct du montant par l'OWNER
  v_caught := false;
  BEGIN
    UPDATE public.expenses SET amount = 2000 WHERE id = v_expense_a1_id;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE;
    IF v_err_code = '42501' THEN v_caught := true; END IF;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 5 FAILED: L''UPDATE direct sur expenses aurait dû lever une exception (42501).';
  END IF;

  -- Tentative de DELETE direct par l'OWNER
  v_caught := false;
  BEGIN
    DELETE FROM public.expenses WHERE id = v_expense_a1_id;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE;
    IF v_err_code = '42501' THEN v_caught := true; END IF;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 5 FAILED: Le DELETE direct sur expenses aurait dû lever une exception (42501).';
  END IF;

  RAISE NOTICE '✓ Test 5 OK : Modifications et suppressions directes sur expenses strictement bloquées par trigger immuable.';

  -- ---------------------------------------------------------------------------
  -- TEST 6 : ANNULATION SANS MOTIF OU MOTIF TROP COURT -> REFUSÉ
  -- ---------------------------------------------------------------------------
  v_caught := false;
  BEGIN
    PERFORM public.void_expense(v_expense_a1_id, 'abc');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE;
    IF v_err_code = '42501' THEN v_caught := true; END IF;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 6 FAILED: Annulation avec motif < 5 caractères aurait dû être refusée (42501).';
  END IF;

  RAISE NOTICE '✓ Test 6 OK : Annulation sans motif détaillé refusée.';

  -- ---------------------------------------------------------------------------
  -- TEST 7 : ANNULATION VALIDE PAR L'OWNER AVEC MOTIF
  -- ---------------------------------------------------------------------------
  PERFORM public.void_expense(v_expense_a1_id, 'Erreur d''imputation sur la ration');

  SELECT COUNT(*) INTO v_count FROM public.expenses WHERE id = v_expense_a1_id AND voided_at IS NOT NULL AND void_reason IS NOT NULL;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST 7 FAILED: La dépense n''a pas été marquée comme annulée.';
  END IF;

  RAISE NOTICE '✓ Test 7 OK : Annulation valide enregistrée avec motif et horodatage.';

  -- ---------------------------------------------------------------------------
  -- TEST 8 : CAISSE DU JOUR CLÔTURÉE BLOQUE LES DÉPENSES SUR CAISSE
  -- ---------------------------------------------------------------------------
  -- Création d'une clôture de caisse 'CLOSED' pour aujourd'hui
  INSERT INTO public.cash_closings (organization_id, opened_by, date, status, closed_at)
  VALUES (v_org_a_id, v_owner_a_id, CURRENT_DATE, 'CLOSED', NOW())
  ON CONFLICT (organization_id, date) DO UPDATE SET status = 'CLOSED', closed_at = NOW();

  v_caught := false;
  BEGIN
    PERFORM public.record_expense(
      p_org_id       => v_org_a_id,
      p_category_id  => v_cat_daily_a_id,
      p_amount       => 2000,
      p_expense_date => CURRENT_DATE,
      p_method       => 'CASH',
      p_from_till    => true
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE;
    IF v_err_code = '42501' THEN v_caught := true; END IF;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 8 FAILED: Une dépense sur caisse dans une journée déjà clôturée aurait dû être refusée (42501).';
  END IF;

  RAISE NOTICE '✓ Test 8 OK : Dépense sur caisse clôturée refusée.';

  -- ---------------------------------------------------------------------------
  -- TEST 9 : ISOLATION RLS MULTI-TENANT (OWNER B NE VOIT PAS ORG A)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_b_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT COUNT(*) INTO v_count FROM public.expenses WHERE organization_id = v_org_a_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 9 FAILED: Owner B ne doit pas lire les dépenses de Org A (vu: %).', v_count;
  END IF;

  RAISE NOTICE '✓ Test 9 OK : Isolation RLS entre organisations respectée.';

  -- ---------------------------------------------------------------------------
  -- TEST 10 : UTILISATEUR ANONYME BLOQUÉ EN LECTURE
  -- ---------------------------------------------------------------------------
  PERFORM set_config('role', 'anon', true);

  SELECT COUNT(*) INTO v_count FROM public.expenses;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 10 FAILED: Utilisateur anonyme ne doit lire aucune dépense (vu: %).', v_count;
  END IF;

  RAISE NOTICE '✓ Test 10 OK : Rôle anonyme bloqué.';

  -- ---------------------------------------------------------------------------
  -- ANNULATION AUTOMATIQUE DU TEST
  -- ---------------------------------------------------------------------------
  RAISE EXCEPTION 'ROLLBACK_TEST_SUCCESS';

EXCEPTION
  WHEN EXCEPTION THEN
    IF SQLERRM = 'ROLLBACK_TEST_SUCCESS' THEN
      RAISE NOTICE '=== TOUS LES TESTS SQL DÉPENSES (TÂCHE 4.8) ONT RÉUSSI AVEC SUCCÈS ===';
    ELSE
      RAISE EXCEPTION '%', SQLERRM;
    END IF;
END $$;
