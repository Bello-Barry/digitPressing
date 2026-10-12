-- =============================================================================
-- TEST AUTOMATISÉ : LINGE PRÊT NON RÉCUPÉRÉ ET RAPPELS (TÂCHE 4.3)
-- Validation RPC log_reminder, RLS customer_reminders et journal d'audit
-- Rollback automatique via RAISE EXCEPTION 'ROLLBACK_TEST_SUCCESS'
-- =============================================================================

DO $$
DECLARE
  v_org_a_id UUID := 'a4300000-0000-0000-0000-000000000000';
  v_org_b_id UUID := 'b4300000-0000-0000-0000-000000000000';

  v_owner_a_id    UUID := 'a4311111-1111-1111-1111-111111111111';
  v_cashier_a_id  UUID := 'a4333333-3333-3333-3333-333333333333';
  v_delivery_a_id UUID := 'a4344444-4444-4444-4444-444444444444';

  v_owner_b_id    UUID := 'b4311111-1111-1111-1111-111111111111';

  v_customer_a_id UUID;
  v_order_ready_a_id UUID;
  v_order_processing_a_id UUID;

  v_reminder_id UUID;
  v_count INTEGER;
  v_caught BOOLEAN := false;
  v_err_code TEXT;
BEGIN
  RAISE NOTICE '=== DÉBUT DU TEST SQL RAPPELS LINGE PRÊT (TÂCHE 4.3) ===';

  RESET ROLE;

  -- 1. SETUP ORGANISATIONS DE TEST
  INSERT INTO public.organizations (id, name, slug, ticket_prefix, country_code, currency, pickup_reminder_days, is_active)
  VALUES
    (v_org_a_id, 'Pressing Reminders Test A', 'reminders-test-a', 'RA', '242', 'XAF', 3, true),
    (v_org_b_id, 'Pressing Reminders Test B', 'reminders-test-b', 'RB', '242', 'XAF', 3, true)
  ON CONFLICT (id) DO NOTHING;

  -- SETUP UTILISATEURS
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (v_owner_a_id,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.a@reminders.test',    crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_cashier_a_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cashier.a@reminders.test',  crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_delivery_a_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'delivery.a@reminders.test', crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_owner_b_id,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.b@reminders.test',    crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- SETUP MEMBERSHIPS
  INSERT INTO public.memberships (user_id, organization_id, role, is_active)
  VALUES
    (v_owner_a_id,    v_org_a_id, 'OWNER',    true),
    (v_cashier_a_id,  v_org_a_id, 'CASHIER',  true),
    (v_delivery_a_id, v_org_a_id, 'DELIVERY', true),
    (v_owner_b_id,    v_org_b_id, 'OWNER',    true)
  ON CONFLICT (user_id, organization_id) DO UPDATE SET role = EXCLUDED.role, is_active = true;

  -- SETUP CUSTOMER & ORDERS
  INSERT INTO public.customers (organization_id, full_name, phone_normalized, phone_display)
  VALUES (v_org_a_id, 'Client Test Rappel', '242067311016', '+242 06 731 1016')
  RETURNING id INTO v_customer_a_id;

  INSERT INTO public.orders (organization_id, customer_id, client_name, client_phone, total_amount, subtotal, status, ready_at)
  VALUES (v_org_a_id, v_customer_a_id, 'Client Test Rappel', '242067311016', 5000, 5000, 'READY', NOW() - INTERVAL '5 days')
  RETURNING id INTO v_order_ready_a_id;

  INSERT INTO public.orders (organization_id, customer_id, client_name, client_phone, total_amount, subtotal, status)
  VALUES (v_org_a_id, v_customer_a_id, 'Client Test En Cours', '242067311016', 3000, 3000, 'PROCESSING')
  RETURNING id INTO v_order_processing_a_id;

  -- ---------------------------------------------------------------------------
  -- TEST 1 : CASHIER D'ORG A ENREGISTRE UN RAPPEL POUR UNE COMMANDE READY
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_cashier_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_reminder_id := public.log_reminder(v_order_ready_a_id, 'READY_PICKUP');

  IF v_reminder_id IS NULL THEN
    RAISE EXCEPTION 'TEST 1 FAILED: log_reminder n''a pas retourné d''ID de rappel.';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.customer_reminders
  WHERE id = v_reminder_id AND organization_id = v_org_a_id AND created_by = v_cashier_a_id;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST 1 FAILED: La ligne de rappel n''a pas été créée correctement.';
  END IF;

  -- Vérification du déclencheur d'audit
  SELECT COUNT(*) INTO v_count
  FROM public.audit_logs
  WHERE organization_id = v_org_a_id AND object_type = 'customer_reminders' AND object_id = v_reminder_id::text;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Le rappel n''a pas généré de ligne dans audit_logs (vu: %).', v_count;
  END IF;

  RAISE NOTICE '✓ Test 1 OK : CASHIER a pu enregistrer un rappel et l''audit log a été alimenté.';

  -- ---------------------------------------------------------------------------
  -- TEST 2 : RÔLE DELIVERY REFUSÉ (SQLSTATE 42501)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_delivery_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_caught := false;
  BEGIN
    PERFORM public.log_reminder(v_order_ready_a_id, 'READY_PICKUP');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE;
    IF v_err_code = '42501' THEN
      v_caught := true;
    ELSE
      RAISE EXCEPTION 'TEST 2 FAILED: Code d''erreur inattendu pour DELIVERY: %', v_err_code;
    END IF;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 2 FAILED: Rôle DELIVERY aurait dû être refusé par log_reminder.';
  END IF;

  RAISE NOTICE '✓ Test 2 OK : Rôle DELIVERY refusé avec SQLSTATE 42501.';

  -- ---------------------------------------------------------------------------
  -- TEST 3 : RAPPEL SUR UNE COMMANDE NON-READY REFUSÉ (SQLSTATE 42501)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_cashier_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_caught := false;
  BEGIN
    PERFORM public.log_reminder(v_order_processing_a_id, 'READY_PICKUP');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE;
    IF v_err_code = '42501' THEN
      v_caught := true;
    ELSE
      RAISE EXCEPTION 'TEST 3 FAILED: Code d''erreur inattendu pour commande non READY: %', v_err_code;
    END IF;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Rappel sur commande non-READY aurait dû être refusé.';
  END IF;

  RAISE NOTICE '✓ Test 3 OK : Rappel sur commande PROCESSING refusé avec SQLSTATE 42501.';

  -- ---------------------------------------------------------------------------
  -- TEST 4 : UPDATE ET DELETE REFUSÉS MEME POUR L'OWNER
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  UPDATE public.customer_reminders SET kind = 'READY_PICKUP' WHERE id = v_reminder_id;
  -- Sous RLS sans politique UPDATE, 0 ligne est modifiée
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 4 FAILED: L''UPDATE sur customer_reminders aurait dû affecter 0 ligne (vu: %).', v_count;
  END IF;

  DELETE FROM public.customer_reminders WHERE id = v_reminder_id;
  -- Sous RLS sans politique DELETE, 0 ligne est supprimée
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 4 FAILED: Le DELETE sur customer_reminders aurait dû affecter 0 ligne (vu: %).', v_count;
  END IF;

  RAISE NOTICE '✓ Test 4 OK : UPDATE et DELETE bloqués sur customer_reminders.';

  -- ---------------------------------------------------------------------------
  -- TEST 5 : ISOLATION INTER-ORGANISATIONS (OWNER B NE VOIT PAS ORG A)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_b_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT COUNT(*) INTO v_count FROM public.customer_reminders WHERE organization_id = v_org_a_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 5 FAILED: Owner B ne doit pas lire les rappels de Org A (vu: %).', v_count;
  END IF;

  RAISE NOTICE '✓ Test 5 OK : Isolation RLS entre organisations respectée.';

  -- ---------------------------------------------------------------------------
  -- TEST 6 : UTILISATEUR ANONYME BLOCKÉ EN LECTURE
  -- ---------------------------------------------------------------------------
  PERFORM set_config('role', 'anon', true);

  SELECT COUNT(*) INTO v_count FROM public.customer_reminders;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 6 FAILED: Utilisateur anonyme ne doit lire aucun rappel (vu: %).', v_count;
  END IF;

  RAISE NOTICE '✓ Test 6 OK : Rôle anonyme bloqué.';

  -- ---------------------------------------------------------------------------
  -- ANNULATION AUTOMATIQUE DE TEST
  -- ---------------------------------------------------------------------------
  RAISE EXCEPTION 'ROLLBACK_TEST_SUCCESS';

EXCEPTION
  WHEN EXCEPTION THEN
    IF SQLERRM = 'ROLLBACK_TEST_SUCCESS' THEN
      RAISE NOTICE '=== TOUS LES TESTS SQL 4.3 ONT RÉUSSI AVEC SUCCÈS (DONNÉES NETTOYÉES) ===';
    ELSE
      RAISE EXCEPTION '%', SQLERRM;
    END IF;
END $$;
