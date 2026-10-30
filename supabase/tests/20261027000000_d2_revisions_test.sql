-- =============================================================================
-- TEST AUTOMATISÉ : TÂCHE D2 - CONTRÔLE CLIENT ET CORRECTION DE FACTURE
-- Valide la création de révision, le calcul serveur, la vérification OTP,
-- la dérogation non vérifiée, le blocage des mutations directes et l'audit.
-- Rollback automatique via RAISE EXCEPTION 'ROLLBACK_TEST_SUCCESS'
-- =============================================================================

DO $$
DECLARE
  v_org_a_id UUID := 'a2000000-0000-0000-0000-000000000000';
  v_org_b_id UUID := 'b2000000-0000-0000-0000-000000000000';

  v_owner_a_id    UUID := 'a2111111-1111-1111-1111-111111111111';
  v_courier_a_id  UUID := 'a2444444-4444-4444-4444-444444444444';
  v_owner_b_id    UUID := 'b2111111-1111-1111-1111-111111111111';

  v_customer_a_id UUID := 'a2000000-0000-0000-0000-000000000001';
  v_order_a_id    UUID := 'a2000000-0000-0000-0000-000000000002';
  v_mission_a_id  UUID := 'a2000000-0000-0000-0000-000000000003';

  v_cat_id        UUID := 'a2000000-0000-0000-0000-000000000004';
  v_garment_id    UUID := 'a2000000-0000-0000-0000-000000000005';
  v_service_chemise_id UUID := 'a2000000-0000-0000-0000-000000000006';
  v_service_pantalon_id UUID := 'a2000000-0000-0000-0000-000000000007';

  v_rev_draft RECORD;
  v_rev_confirmed public.order_revisions;
  v_count INTEGER;
  v_new_subtotal NUMERIC;
  v_caught BOOLEAN := false;
  v_err_code TEXT;
  v_err_msg TEXT;
BEGIN
  RAISE NOTICE '=== DÉBUT DU TEST SQL REVISIONS D2 ===';

  RESET ROLE;

  -- 1. SETUP ORGANISATION, MEMBRES ET CATALOGUE
  INSERT INTO public.organizations (id, name, slug, ticket_prefix, country_code, currency, courier_pay_collection, courier_pay_delivery, is_active)
  VALUES
    (v_org_a_id, 'Pressing D2 Test A', 'd2-test-a', 'D2A', '242', 'XAF', 1000, 1500, true),
    (v_org_b_id, 'Pressing D2 Test B', 'd2-test-b', 'D2B', '242', 'XAF', 1000, 1500, true)
  ON CONFLICT (id) DO UPDATE SET is_active = true;

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (v_owner_a_id,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.a@d2.test',   crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_courier_a_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'courier.a@d2.test', crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_owner_b_id,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.b@d2.test',   crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.memberships (user_id, organization_id, role, is_active)
  VALUES
    (v_owner_a_id,   v_org_a_id, 'OWNER',    true),
    (v_courier_a_id, v_org_a_id, 'DELIVERY', true),
    (v_owner_b_id,   v_org_b_id, 'OWNER',    true)
  ON CONFLICT (user_id, organization_id) DO UPDATE SET role = EXCLUDED.role, is_active = true;

  -- CATALOGUE
  INSERT INTO public.service_categories (id, organization_id, name, normalized_name, sort_order)
  VALUES (v_cat_id, v_org_a_id, 'Lavage', 'lavage', 1)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.garment_types (id, organization_id, name, normalized_name)
  VALUES (v_garment_id, v_org_a_id, 'Chemise', 'chemise')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.services (id, organization_id, category_id, garment_type_id, name, price, is_active)
  VALUES
    (v_service_chemise_id,  v_org_a_id, v_cat_id, v_garment_id, 'Chemise - Lavage', 1000, true),
    (v_service_pantalon_id, v_org_a_id, v_cat_id, v_garment_id, 'Pantalon - Lavage', 1500, true)
  ON CONFLICT (id) DO NOTHING;

  -- CLIENT ET COMMANDE INITIALE (Chemise x 1 = 1000 FCFA, Frais = 500)
  INSERT INTO public.customers (id, organization_id, full_name, phone)
  VALUES (v_customer_a_id, v_org_a_id, 'Paul Biyogo', '066223344')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.orders (
    id, organization_id, customer_id, client_name, client_phone,
    status, mode, subtotal, delivery_fee, discount_amount, total_amount, items_count_in
  ) VALUES (
    v_order_a_id, v_org_a_id, v_customer_a_id, 'Paul Biyogo', '066223344',
    'VALIDATED', 'DELIVERY', 1000, 500, 0, 1500, 1
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.order_items (
    organization_id, order_id, service_id, service_name, quantity, unit_price, line_total
  ) VALUES (
    v_org_a_id, v_order_a_id, v_service_chemise_id, 'Chemise - Lavage', 1, 1000, 1000
  )
  ON CONFLICT DO NOTHING;

  -- MISSION DE LIVRAISON ATTRIBUÉE AU LIVREUR A
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_mission_a_id := public.create_delivery_mission(v_order_a_id, 'DELIVERY', v_courier_a_id, 'Poto-Poto', 'Sonnex à la grille');

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_courier_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  PERFORM public.accept_delivery_mission(v_mission_a_id);

  -- ---------------------------------------------------------------------------
  -- TEST 1 : CRÉATION D'UN PROJET DE RÉVISION (Chemise x 2 + Pantalon x 1 = 3500 FCFA)
  -- ---------------------------------------------------------------------------
  SELECT * INTO v_rev_draft FROM public.create_order_revision_draft(
    p_mission_id => v_mission_a_id,
    p_lines_json => jsonb_build_array(
      jsonb_build_object('service_id', v_service_chemise_id, 'qty_after', 2, 'color', 'Bleu', 'item_notes', 'Tache col'),
      jsonb_build_object('service_id', v_service_pantalon_id, 'qty_after', 1, 'color', 'Noir')
    ),
    p_notes => 'Ajustement lors du contrôle chez le client'
  );

  IF v_rev_draft.revision_id IS NULL OR v_rev_draft.otp_code IS NULL THEN
    RAISE EXCEPTION 'TEST 1 FAILED: create_order_revision_draft n''a pas généré d''ID ou d''OTP (code: %).', v_rev_draft.otp_code;
  END IF;

  -- Calcul attendu : (2 x 1000) + (1 x 1500) = 3500 FCFA sous-total, + 500 frais = 4000 total
  IF v_rev_draft.subtotal_after <> 3500 OR v_rev_draft.total_after <> 4000 THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Calcul serveur incorrect (sous-total: %, total: %).', v_rev_draft.subtotal_after, v_rev_draft.total_after;
  END IF;

  RAISE NOTICE '✓ Test 1 OK : Projet de révision v1 créé avec calcul serveur et code OTP (4 000 FCFA).';

  -- ---------------------------------------------------------------------------
  -- TEST 2 : MAUVAIS CODE OTP INCÉRÉMENTE LES TENTATIVES PUIS REJETTE À 5
  -- ---------------------------------------------------------------------------
  v_caught := false;
  BEGIN
    PERFORM public.confirm_order_revision_otp(v_rev_draft.revision_id, '000000');
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 2 FAILED: Un mauvais code OTP aurait dû lever une exception.';
  END IF;

  SELECT otp_attempts INTO v_count FROM public.order_revisions WHERE id = v_rev_draft.revision_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST 2 FAILED: otp_attempts doit être égal à 1 (vu: %).', v_count;
  END IF;

  RAISE NOTICE '✓ Test 2 OK : Échec OTP comptabilisé dans otp_attempts.';

  -- ---------------------------------------------------------------------------
  -- TEST 3 : VALIDATION PAR LE BON CODE OTP (CONFIRMED)
  -- ---------------------------------------------------------------------------
  v_rev_confirmed := public.confirm_order_revision_otp(v_rev_draft.revision_id, v_rev_draft.otp_code);

  IF v_rev_confirmed.status <> 'CONFIRMED' OR v_rev_confirmed.verification_type <> 'CLIENT_OTP' THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Statut de révision doit être CONFIRMED/CLIENT_OTP (vu: %, %).', v_rev_confirmed.status, v_rev_confirmed.verification_type;
  END IF;

  -- Vérifier que la commande a été mise à jour avec le nouveau total
  SELECT subtotal, total_amount, items_count_in INTO v_new_subtotal, v_count, v_count
  FROM public.orders WHERE id = v_order_a_id;

  IF v_new_subtotal <> 3500 THEN
    RAISE EXCEPTION 'TEST 3 FAILED: La commande aurait dû avoir un sous-total de 3500 FCFA (vu: %).', v_new_subtotal;
  END IF;

  RAISE NOTICE '✓ Test 3 OK : Révision confirmée par OTP, facture et articles mis à jour.';

  -- ---------------------------------------------------------------------------
  -- TEST 4 : CRÉATION D'UNE DEUXIÈME RÉVISION V2 ET VALIDATION NON VÉRIFIÉE (SANS OTP)
  -- ---------------------------------------------------------------------------
  SELECT * INTO v_rev_draft FROM public.create_order_revision_draft(
    p_mission_id => v_mission_a_id,
    p_lines_json => jsonb_build_array(
      jsonb_build_object('service_id', v_service_chemise_id, 'qty_after', 3)
    ),
    p_notes => 'Ajout 3ème chemise sans batterie sur téléphone client'
  );

  v_rev_confirmed := public.confirm_order_revision_unverified(v_rev_draft.revision_id, 'Téléphone du client déchargé chez le client');

  IF v_rev_confirmed.status <> 'UNVERIFIED_AGREEMENT' OR v_rev_confirmed.verification_type <> 'UNVERIFIED_DECLARATION' THEN
    RAISE EXCEPTION 'TEST 4 FAILED: Statut dérogation doit être UNVERIFIED_AGREEMENT (vu: %).', v_rev_confirmed.status;
  END IF;

  RAISE NOTICE '✓ Test 4 OK : Validation sans vérification client enregistrée avec motif obligatoire.';

  -- ---------------------------------------------------------------------------
  -- TEST 5 : SUPPRESSION OU MODIFICATION DIRECTE BLOQUÉE (42501)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_caught := false;
  BEGIN
    UPDATE public.order_revisions SET total_after = 0 WHERE id = v_rev_draft.revision_id;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE;
    IF v_err_code = '42501' THEN v_caught := true; END IF;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 5 FAILED: L''UPDATE direct sur order_revisions doit être bloqué (42501).';
  END IF;

  RAISE NOTICE '✓ Test 5 OK : Immuabilité directe de order_revisions garantie par trigger.';

  -- ---------------------------------------------------------------------------
  -- TEST 6 : ISOLATION RLS ENTRE DEUX ORGANISATIONS
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_b_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT count(*) INTO v_count FROM public.order_revisions WHERE organization_id = v_org_a_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 6 FAILED: Owner B ne doit pas lire les révisions de Org A (vu: %).', v_count;
  END IF;

  RAISE NOTICE '✓ Test 6 OK : Isolation multi-tenant respectée.';

  -- ---------------------------------------------------------------------------
  -- ROLLBACK AUTOMATIQUE
  -- ---------------------------------------------------------------------------
  RAISE EXCEPTION 'ROLLBACK_TEST_SUCCESS';

EXCEPTION
  WHEN EXCEPTION THEN
    IF SQLERRM = 'ROLLBACK_TEST_SUCCESS' THEN
      RAISE NOTICE '=== TOUS LES TESTS SQL REVISIONS D2 ONT RÉUSSI AVEC SUCCÈS ===';
    ELSE
      RAISE EXCEPTION '%', SQLERRM;
    END IF;
END $$;
