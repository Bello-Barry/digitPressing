-- =============================================================================
-- TEST AUTOMATISÉ : TÂCHE D2 - CONTRÔLE CLIENT ET CORRECTION DE FACTURE (POINT 9)
-- Valide précisément :
-- 1. Brouillon : changer une quantité, retirer une ligne (qty_after=0), ajouter un service du catalogue
-- 2. Mauvais code : renvoie ok=false et le compteur persiste sans rollback
-- 3. Bon code : commande à jour, ligne réellement supprimée, items_count_in inchangé
-- 4. Autre livreur : refusé
-- 5. COLLECTED : refusé sans contrôle préalable puis accepté avec comptage strict
-- =============================================================================

DO $$
DECLARE
  v_org_a_id UUID := 'a4000000-0000-0000-0000-000000000000';
  v_owner_a_id    UUID := 'a4111111-1111-1111-1111-111111111111';
  v_courier_a_id  UUID := 'a4444444-4444-4444-4444-444444444444';
  v_courier_a2_id UUID := 'a4555555-5555-5555-5555-555555555555';

  v_customer_a_id UUID := 'a4000000-0000-0000-0000-000000000001';
  v_order_1_id    UUID := 'a4000000-0000-0000-0000-000000000002';
  v_order_2_id    UUID := 'a4000000-0000-0000-0000-000000000003';
  v_mission_1_id  UUID := 'a4000000-0000-0000-0000-000000000004';
  v_mission_2_id  UUID := 'a4000000-0000-0000-0000-000000000005';

  v_cat_id              UUID := 'a4000000-0000-0000-0000-000000000006';
  v_garment_id          UUID := 'a4000000-0000-0000-0000-000000000007';
  v_service_chemise_id  UUID := 'a4000000-0000-0000-0000-000000000008';
  v_service_pantalon_id UUID := 'a4000000-0000-0000-0000-000000000009';
  v_service_costume_id  UUID := 'a4000000-0000-0000-0000-000000000010';

  v_item_chemise_id  UUID := 'a4000000-0000-0000-0000-000000000011';
  v_item_pantalon_id UUID := 'a4000000-0000-0000-0000-000000000012';

  v_res_json JSONB;
  v_customer_json JSONB;
  v_client_code TEXT;
  v_count INTEGER;
  v_new_subtotal NUMERIC;
  v_new_total NUMERIC;
  v_mission_res public.delivery_missions;
  v_caught BOOLEAN := false;
  v_token TEXT := 'tok_d2_test_verification_code';
BEGIN
  RAISE NOTICE '=== DÉBUT DU TEST SQL REVISIONS D2 (SCÉNARIOS STRICTS) ===';

  RESET ROLE;

  -- 1. SETUP ORGANISATION ET MEMBRES
  INSERT INTO public.organizations (id, name, slug, ticket_prefix, country_code, currency, courier_pay_collection, courier_pay_delivery, is_active)
  VALUES (v_org_a_id, 'Pressing D2 Scenario A', 'd2-scenario-a', 'D2X', '242', 'XAF', 1000, 1500, true)
  ON CONFLICT (id) DO UPDATE SET is_active = true;

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (v_owner_a_id,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.a@d2x.test',    crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_courier_a_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'courier.a1@d2x.test', crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_courier_a2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'courier.a2@d2x.test', crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.memberships (user_id, organization_id, role, is_active)
  VALUES
    (v_owner_a_id,    v_org_a_id, 'OWNER',    true),
    (v_courier_a_id,  v_org_a_id, 'DELIVERY', true),
    (v_courier_a2_id, v_org_a_id, 'DELIVERY', true)
  ON CONFLICT (user_id, organization_id) DO UPDATE SET role = EXCLUDED.role, is_active = true;

  -- CATALOGUE SERVICES
  INSERT INTO public.service_categories (id, organization_id, name, sort_order)
  VALUES (v_cat_id, v_org_a_id, 'Pressing Quotidien', 1)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.garment_types (id, organization_id, category_id, name)
  VALUES (v_garment_id, v_org_a_id, v_cat_id, 'Vêtements Homme/Femme')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.services (id, organization_id, category_id, garment_type_id, name, price, is_active)
  VALUES
    (v_service_chemise_id,  v_org_a_id, v_cat_id, v_garment_id, 'Chemise Propre', 1000, true),
    (v_service_pantalon_id, v_org_a_id, v_cat_id, v_garment_id, 'Pantalon Jean',   1500, true),
    (v_service_costume_id,  v_org_a_id, v_cat_id, v_garment_id, 'Costume Laine',   3000, true)
  ON CONFLICT (id) DO NOTHING;

  -- CLIENT ET COMMANDE 1 (Pour test COLLECTED refusé sans contrôle puis accepté)
  INSERT INTO public.customers (id, organization_id, full_name, phone_normalized, phone_display)
  VALUES (v_customer_a_id, v_org_a_id, 'Alain Mboumba', '066112233', '06 611 22 33')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.orders (
    id, organization_id, customer_id, client_name, client_phone,
    status, mode, pickup_address, subtotal, delivery_fee, discount_amount, total_amount, invoice_token
  ) VALUES (
    v_order_1_id, v_org_a_id, v_customer_a_id, 'Alain Mboumba', '066112233',
    'VALIDATED', 'PICKUP', 'Poto-Poto Rond-Point', 2000, 500, 0, 2500, 'tok_order_1_test'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.order_items (
    id, organization_id, order_id, service_id, service_name, quantity, unit_price, line_total
  ) VALUES
    ('a4000000-0000-0000-0000-000000000015'::UUID, v_org_a_id, v_order_1_id, v_service_chemise_id, 'Chemise Propre', 2, 1000, 2000)
  ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('app.in_rpc', 'true', true);
  INSERT INTO public.delivery_missions (
    id, organization_id, order_id, kind, status, assigned_to, pay_amount, zone_label, created_by
  ) VALUES (
    v_mission_1_id, v_org_a_id, v_order_1_id, 'COLLECTION', 'AT_CUSTOMER', v_courier_a_id, 1000, 'Poto-Poto', v_owner_a_id
  )
  ON CONFLICT (id) DO NOTHING;
  PERFORM set_config('app.in_rpc', 'false', true);

  -- ---------------------------------------------------------------------------
  -- SCÉNARIO 5 : COLLECTED REFUSÉ SANS CONTRÔLE PRÉALABLE PUIS ACCEPTÉ
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_courier_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- 5a. COLLECTED refusé car pickup_check_status IS NULL
  v_caught := false;
  BEGIN
    PERFORM public.advance_delivery_mission(v_mission_1_id, 'COLLECTED', 2);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Le contrôle chez le client doit être validé%' THEN
      v_caught := true;
    END IF;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 5 FAILED: advance_delivery_mission aurait dû refuser COLLECTED sans contrôle préalable.';
  END IF;

  -- 5b. Validation du contrôle conforme
  v_res_json := public.confirm_pickup_conform(v_mission_1_id);
  IF (v_res_json->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 5 FAILED: confirm_pickup_conform a échoué.';
  END IF;

  -- 5c. Avancement COLLECTED accepté avec le nombre de pièces calculé (2 chemises)
  v_mission_res := public.advance_delivery_mission(v_mission_1_id, 'COLLECTED', 2);
  IF v_mission_res.status <> 'COLLECTED' OR v_mission_res.items_count_collected <> 2 THEN
    RAISE EXCEPTION 'TEST 5 FAILED: Mission 1 doit être au statut COLLECTED avec 2 pièces.';
  END IF;

  RAISE NOTICE '✓ Scénario 5 validé : COLLECTED refusé sans contrôle puis accepté avec pièces calculées.';

  -- ---------------------------------------------------------------------------
  -- SETUP COMMANDE 2 : 1 Chemise (1000 FCFA) + 1 Pantalon (1500 FCFA) = 2500 FCFA
  -- ---------------------------------------------------------------------------
  RESET ROLE;
  INSERT INTO public.orders (
    id, organization_id, customer_id, client_name, client_phone,
    status, mode, pickup_address, subtotal, delivery_fee, discount_amount, total_amount, invoice_token
  ) VALUES (
    v_order_2_id, v_org_a_id, v_customer_a_id, 'Alain Mboumba', '066112233',
    'VALIDATED', 'PICKUP', 'Poto-Poto Rond-Point', 2500, 500, 0, 3000, v_token
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.order_items (
    id, organization_id, order_id, service_id, service_name, quantity, unit_price, line_total, color
  ) VALUES
    (v_item_chemise_id,  v_org_a_id, v_order_2_id, v_service_chemise_id,  'Chemise Propre', 1, 1000, 1000, 'Bleu'),
    (v_item_pantalon_id, v_org_a_id, v_order_2_id, v_service_pantalon_id, 'Pantalon Jean',   1, 1500, 1500, 'Noir')
  ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('app.in_rpc', 'true', true);
  INSERT INTO public.delivery_missions (
    id, organization_id, order_id, kind, status, assigned_to, pay_amount, zone_label, created_by
  ) VALUES (
    v_mission_2_id, v_org_a_id, v_order_2_id, 'COLLECTION', 'AT_CUSTOMER', v_courier_a_id, 1000, 'Poto-Poto', v_owner_a_id
  )
  ON CONFLICT (id) DO NOTHING;
  PERFORM set_config('app.in_rpc', 'false', true);

  -- ---------------------------------------------------------------------------
  -- SCÉNARIO 4 : AUTRE LIVREUR REFUSÉ
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_courier_a2_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_caught := false;
  BEGIN
    PERFORM public.create_order_revision_draft(v_mission_2_id, '[]'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 4 FAILED: Livreur non attribué n''a pas été rejeté.';
  END IF;

  RAISE NOTICE '✓ Scénario 4 validé : Autre livreur strictement refusé.';

  -- ---------------------------------------------------------------------------
  -- SCÉNARIO 1 : BROUILLON (Changer une quantité, retirer une ligne, ajouter un service)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_courier_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- Chemise passe de 1 à 3 (changer une quantité)
  -- Pantalon passe à 0 (retirer une ligne)
  -- Costume ajouté x 1 à 3000 FCFA (ajouter un service du catalogue)
  -- Sous-total attendu : (3 x 1000) + (0 x 1500) + (1 x 3000) = 6000 FCFA (+ 500 frais = 6500)
  v_res_json := public.create_order_revision_draft(
    p_mission_id => v_mission_2_id,
    p_lines_json => jsonb_build_array(
      jsonb_build_object('order_item_id', v_item_chemise_id, 'qty_after', 3),
      jsonb_build_object('order_item_id', v_item_pantalon_id, 'qty_after', 0),
      jsonb_build_object('service_id', v_service_costume_id, 'qty_after', 1, 'color', 'Gris')
    ),
    p_notes => 'Contrôle vêtements : retrait pantalon et ajout costume'
  );

  IF (v_res_json->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 1 FAILED: create_order_revision_draft a échoué.';
  END IF;

  -- Vérifier que le code N'EST PAS renvoyé au livreur
  IF v_res_json ? 'code' THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Le code ne doit jamais être renvoyé au livreur.';
  END IF;

  IF (v_res_json->>'subtotal_after')::numeric <> 6000 OR (v_res_json->>'total_after')::numeric <> 6500 THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Sous-total calculé % ou total % incorrect (attendu: 6000, 6500).',
      v_res_json->>'subtotal_after', v_res_json->>'total_after';
  END IF;

  RAISE NOTICE '✓ Scénario 1 validé : Brouillon avec quantité changée, ligne retirée (qty=0), service ajouté.';

  -- ---------------------------------------------------------------------------
  -- SCÉNARIO 2 : MAUVAIS CODE (LE COMPTEUR PERSISTE SANS ROLLBACK)
  -- ---------------------------------------------------------------------------
  v_res_json := public.confirm_order_revision_otp(v_mission_2_id, '123123');

  IF (v_res_json->>'ok')::boolean IS NOT FALSE OR (v_res_json->>'attempts_left')::integer <> 4 THEN
    RAISE EXCEPTION 'TEST 2 FAILED: Mauvais code doit renvoyer ok=false et 4 essais restants (vu: %).', v_res_json;
  END IF;

  -- Contrôle en base que attempts vaut bien 1 (persistance sans rollback d'exception)
  SELECT attempts INTO v_count FROM public.order_revisions WHERE mission_id = v_mission_2_id AND status = 'PENDING_AGREEMENT';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST 2 FAILED: Le compteur attempts doit persister à 1 en base (vu: %).', v_count;
  END IF;

  RAISE NOTICE '✓ Scénario 2 validé : Mauvais code renvoie ok=false et le compteur d''essais persiste en base.';

  -- ---------------------------------------------------------------------------
  -- SCÉNARIO 3 : BON CODE (COMMANDE À JOUR, LIGNE RÉELLEMENT SUPPRIMÉE, ITEMS_COUNT_IN INCHANGÉ)
  -- ---------------------------------------------------------------------------
  -- Le client lit le code généré à la volée sur sa page publique
  PERFORM set_config('role', 'anon', true);
  v_customer_json := public.get_pending_revision_for_customer(v_token);
  IF v_customer_json IS NULL OR v_customer_json->>'code' IS NULL THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Le client doit pouvoir lire le code calculé sur la page publique.';
  END IF;
  v_client_code := v_customer_json->>'code';

  -- Le livreur saisit le bon code
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_courier_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_res_json := public.confirm_order_revision_otp(v_mission_2_id, v_client_code);
  IF (v_res_json->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 3 FAILED: confirm_order_revision_otp a échoué avec le bon code (message: %).', v_res_json->>'message';
  END IF;

  -- 3a. Vérifier que la commande a été mise à jour (subtotal = 6000, total = 6500)
  SELECT subtotal, total_amount, items_count_in INTO v_new_subtotal, v_new_total, v_count
  FROM public.orders WHERE id = v_order_2_id;

  IF v_new_subtotal <> 6000 OR v_new_total <> 6500 THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Commande non mise à jour (subtotal: %, total: %).', v_new_subtotal, v_new_total;
  END IF;

  -- 3b. Vérifier que items_count_in est strictement inchangé (NULL)
  IF v_count IS NOT NULL THEN
    RAISE EXCEPTION 'TEST 3 FAILED: items_count_in ne doit PAS être touché lors de la révision chez le client.';
  END IF;

  -- 3c. Vérifier que la ligne avec qty_after = 0 (Pantalon) est RÉELLEMENT SUPPRIMÉE de order_items
  SELECT COUNT(*) INTO v_count FROM public.order_items WHERE id = v_item_pantalon_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 3 FAILED: La ligne avec qty_after=0 n''a pas été supprimée d''order_items (vu: % ligne).', v_count;
  END IF;

  -- 3d. Vérifier que la Chemise est passée à quantity = 3
  SELECT quantity INTO v_count FROM public.order_items WHERE id = v_item_chemise_id;
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'TEST 3 FAILED: La quantité de chemises devrait être de 3 (vu: %).', v_count;
  END IF;

  -- 3e. Vérifier que le Costume a bien été inséré
  SELECT COUNT(*) INTO v_count FROM public.order_items WHERE order_id = v_order_2_id AND service_id = v_service_costume_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Le nouveau service costume n''a pas été inséré dans order_items.';
  END IF;

  -- 3f. Vérifier que pickup_check_status porte bien CORRECTED
  SELECT pickup_check_status INTO v_mission_res.pickup_check_status FROM public.delivery_missions WHERE id = v_mission_2_id;
  IF v_mission_res.pickup_check_status <> 'CORRECTED' THEN
    RAISE EXCEPTION 'TEST 3 FAILED: pickup_check_status doit valoir CORRECTED.';
  END IF;

  RAISE NOTICE '✓ Scénario 3 validé : Bon code accepté, commande à jour, ligne retirée réellement supprimée, items_count_in inchangé.';

  -- ---------------------------------------------------------------------------
  -- ROLLBACK AUTOMATIQUE
  -- ---------------------------------------------------------------------------
  RAISE EXCEPTION 'ROLLBACK_TEST_SUCCESS';

EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM = 'ROLLBACK_TEST_SUCCESS' THEN
      RAISE NOTICE '=== TOUS LES SCÉNARIOS SQL REVISIONS D2 ONT ÉTÉ TESTÉS AVEC SUCCÈS ===';
    ELSE
      RAISE EXCEPTION '%', SQLERRM;
    END IF;
END $$;
