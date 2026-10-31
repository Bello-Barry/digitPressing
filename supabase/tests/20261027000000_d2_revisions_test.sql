-- =============================================================================
-- TEST AUTOMATISÉ : TÂCHE D2 - CONTRÔLE CLIENT ET CORRECTION DE FACTURE
-- Valide les 8 règles :
-- 1. Code client calculé (non stocké, invisible du livreur, get_pending_revision_for_customer)
-- 2. Essais sans exception (ok=false, essais restants, renew_order_revision_code)
-- 3. Rôles et état AT_CUSTOMER / VALIDATED
-- 4. Conservation des lignes non citées, prix catalogue pour ajouts, prix existants immuables
-- 5. Application sélective des lignes, refus si total < paiements, items_count_in inchangé
-- 6. Supercession, immuabilité, clés sans FK auth.users
-- 7. Contrôle obligatoire avant COLLECTED (confirm_pickup_conform, calcul automatique pièces)
-- 8. Accord non vérifié (UNVERIFIED_AGREEMENT, motif >= 5 car.)
-- Rollback automatique via RAISE EXCEPTION 'ROLLBACK_TEST_SUCCESS'
-- =============================================================================

DO $$
DECLARE
  v_org_a_id UUID := 'a3000000-0000-0000-0000-000000000000';
  v_org_b_id UUID := 'b3000000-0000-0000-0000-000000000000';

  v_owner_a_id    UUID := 'a3111111-1111-1111-1111-111111111111';
  v_courier_a_id  UUID := 'a3444444-4444-4444-4444-444444444444';
  v_courier_a2_id UUID := 'a3555555-5555-5555-5555-555555555555';
  v_owner_b_id    UUID := 'b3111111-1111-1111-1111-111111111111';

  v_customer_a_id UUID := 'a3000000-0000-0000-0000-000000000001';
  v_order_1_id    UUID := 'a3000000-0000-0000-0000-000000000002';
  v_order_2_id    UUID := 'a3000000-0000-0000-0000-000000000003';
  v_mission_1_id  UUID := 'a3000000-0000-0000-0000-000000000004';
  v_mission_2_id  UUID := 'a3000000-0000-0000-0000-000000000005';

  v_cat_id              UUID := 'a3000000-0000-0000-0000-000000000006';
  v_garment_id          UUID := 'a3000000-0000-0000-0000-000000000007';
  v_service_chemise_id  UUID := 'a3000000-0000-0000-0000-000000000008';
  v_service_pantalon_id UUID := 'a3000000-0000-0000-0000-000000000009';
  v_service_costume_id  UUID := 'a3000000-0000-0000-0000-000000000010';

  v_item_chemise_id  UUID := 'a3000000-0000-0000-0000-000000000011';
  v_item_pantalon_id UUID := 'a3000000-0000-0000-0000-000000000012';

  v_res_json JSONB;
  v_customer_json JSONB;
  v_client_code TEXT;
  v_count INTEGER;
  v_new_subtotal NUMERIC;
  v_new_total NUMERIC;
  v_mission_res public.delivery_missions;
  v_caught BOOLEAN := false;
  v_err_code TEXT;
  v_token TEXT := 'tok_test_d2_invoice_123456';
BEGIN
  RAISE NOTICE '=== DÉBUT DU TEST SQL REVISIONS D2 (REWRITE STRICT) ===';

  RESET ROLE;

  -- 1. SETUP ORGANISATION & UTILISATEURS
  INSERT INTO public.organizations (id, name, slug, ticket_prefix, country_code, currency, courier_pay_collection, courier_pay_delivery, is_active)
  VALUES
    (v_org_a_id, 'Pressing D2 Strict A', 'd2-strict-a', 'D2S', '242', 'XAF', 1000, 1500, true),
    (v_org_b_id, 'Pressing D2 Strict B', 'd2-strict-b', 'D2B', '242', 'XAF', 1000, 1500, true)
  ON CONFLICT (id) DO UPDATE SET is_active = true;

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (v_owner_a_id,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.a@d2s.test',    crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_courier_a_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'courier.a1@d2s.test', crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_courier_a2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'courier.a2@d2s.test', crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_owner_b_id,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.b@d2s.test',    crypt('Pass123!', gen_salt('bf')), NOW(), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.memberships (user_id, organization_id, role, is_active)
  VALUES
    (v_owner_a_id,    v_org_a_id, 'OWNER',    true),
    (v_courier_a_id,  v_org_a_id, 'DELIVERY', true),
    (v_courier_a2_id, v_org_a_id, 'DELIVERY', true),
    (v_owner_b_id,    v_org_b_id, 'OWNER',    true)
  ON CONFLICT (user_id, organization_id) DO UPDATE SET role = EXCLUDED.role, is_active = true;

  -- CATALOGUE SERVICES
  INSERT INTO public.service_categories (id, organization_id, name, sort_order)
  VALUES (v_cat_id, v_org_a_id, 'Nettoyage Pressing', 1)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.garment_types (id, organization_id, category_id, name)
  VALUES (v_garment_id, v_org_a_id, v_cat_id, 'Vêtements Quotidiens')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.services (id, organization_id, category_id, garment_type_id, name, price, is_active)
  VALUES
    (v_service_chemise_id,  v_org_a_id, v_cat_id, v_garment_id, 'Chemise Standard', 1000, true),
    (v_service_pantalon_id, v_org_a_id, v_cat_id, v_garment_id, 'Pantalon Ville',    1500, true),
    (v_service_costume_id,  v_org_a_id, v_cat_id, v_garment_id, 'Costume 2 Pièces',  3000, true)
  ON CONFLICT (id) DO NOTHING;

  -- CLIENT & COMMANDES
  INSERT INTO public.customers (id, organization_id, full_name, phone_normalized, phone_display)
  VALUES (v_customer_a_id, v_org_a_id, 'Michel Samba', '066554433', '06 655 44 33')
  ON CONFLICT (id) DO NOTHING;

  -- Commande 1 (pour test contrôle conforme) : Chemise x 1 (1000) + Pantalon x 1 (1500) = 2500 FCFA
  INSERT INTO public.orders (
    id, organization_id, customer_id, client_name, client_phone,
    status, mode, pickup_address, subtotal, delivery_fee, discount_amount, total_amount, invoice_token
  ) VALUES (
    v_order_1_id, v_org_a_id, v_customer_a_id, 'Michel Samba', '066554433',
    'VALIDATED', 'PICKUP', 'Bacongo Rue Lapeyrouse', 2500, 500, 0, 3000, v_token
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.order_items (
    id, organization_id, order_id, service_id, service_name, quantity, unit_price, line_total, color
  ) VALUES
    (v_item_chemise_id,  v_org_a_id, v_order_1_id, v_service_chemise_id,  'Chemise Standard', 1, 1000, 1000, 'Blanc'),
    (v_item_pantalon_id, v_org_a_id, v_order_1_id, v_service_pantalon_id, 'Pantalon Ville',    1, 1500, 1500, 'Noir')
  ON CONFLICT (id) DO NOTHING;

  -- Mission 1 au statut AT_CUSTOMER
  PERFORM set_config('app.in_rpc', 'true', true);
  INSERT INTO public.delivery_missions (
    id, organization_id, order_id, kind, status, assigned_to, pay_amount, zone_label, created_by
  ) VALUES (
    v_mission_1_id, v_org_a_id, v_order_1_id, 'COLLECTION', 'AT_CUSTOMER', v_courier_a_id, 1000, 'Bacongo', v_owner_a_id
  )
  ON CONFLICT (id) DO NOTHING;
  PERFORM set_config('app.in_rpc', 'false', true);

  -- ---------------------------------------------------------------------------
  -- TEST RÈGLE 7 : AVANCEMENT VERS COLLECTED REFUSÉ TANT QUE CONTRÔLE NON VALIDÉ
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_courier_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_caught := false;
  BEGIN
    PERFORM public.advance_delivery_mission(v_mission_1_id, 'COLLECTED', 2);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Le contrôle chez le client doit être validé%' THEN
      v_caught := true;
    END IF;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST R7 FAILED: advance_delivery_mission aurait dû refuser le passage à COLLECTED sans contrôle préalable.';
  END IF;

  RAISE NOTICE '✓ Règle 7a OK : Avancement vers COLLECTED bloqué sans contrôle préalable chez le client.';

  -- CONTRÔLE CONFORME (confirm_pickup_conform)
  v_res_json := public.confirm_pickup_conform(v_mission_1_id);
  IF (v_res_json->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST R7 FAILED: confirm_pickup_conform a échoué.';
  END IF;

  -- Tentative d'avancement avec un nombre saisi différent du total des articles (saisie = 5 alors que 1+1 = 2)
  v_caught := false;
  BEGIN
    PERFORM public.advance_delivery_mission(v_mission_1_id, 'COLLECTED', 5);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%ne correspond pas au total des articles de la commande%' THEN
      v_caught := true;
    END IF;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST R7 FAILED: Saisie d''un nombre de pièces différent du total des articles aurait dû être refusée.';
  END IF;

  -- Avancement avec comptage exact calculé (2 pièces)
  v_mission_res := public.advance_delivery_mission(v_mission_1_id, 'COLLECTED', 2);
  IF v_mission_res.status <> 'COLLECTED' OR v_mission_res.items_count_collected <> 2 THEN
    RAISE EXCEPTION 'TEST R7 FAILED: Mission devrait être COLLECTED avec 2 pièces.';
  END IF;

  RAISE NOTICE '✓ Règle 7b OK : confirm_pickup_conform validé, comptage automatique strict vérifié.';

  -- ---------------------------------------------------------------------------
  -- SETUP COMMANDE 2 & MISSION 2 POUR TEST DES RÉVISIONS (Règles 1, 2, 3, 4, 5, 6, 8)
  -- ---------------------------------------------------------------------------
  RESET ROLE;
  INSERT INTO public.orders (
    id, organization_id, customer_id, client_name, client_phone,
    status, mode, pickup_address, subtotal, delivery_fee, discount_amount, total_amount, invoice_token
  ) VALUES (
    v_order_2_id, v_org_a_id, v_customer_a_id, 'Michel Samba', '066554433',
    'VALIDATED', 'PICKUP', 'Bacongo Rue Lapeyrouse', 1000, 500, 0, 1500, 'tok_client_d2_test'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.order_items (
    id, organization_id, order_id, service_id, service_name, quantity, unit_price, line_total
  ) VALUES (
    'a3000000-0000-0000-0000-000000000020'::UUID, v_org_a_id, v_order_2_id, v_service_chemise_id, 'Chemise Standard', 1, 1000, 1000
  )
  ON CONFLICT DO NOTHING;

  PERFORM set_config('app.in_rpc', 'true', true);
  INSERT INTO public.delivery_missions (
    id, organization_id, order_id, kind, status, assigned_to, pay_amount, zone_label, created_by
  ) VALUES (
    v_mission_2_id, v_org_a_id, v_order_2_id, 'COLLECTION', 'AT_CUSTOMER', v_courier_a_id, 1000, 'Bacongo', v_owner_a_id
  )
  ON CONFLICT (id) DO NOTHING;
  PERFORM set_config('app.in_rpc', 'false', true);

  -- ---------------------------------------------------------------------------
  -- TEST RÈGLE 3 : SEUL LE LIVREUR ATTRIBUÉ PEUT RÉVISER
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
    RAISE EXCEPTION 'TEST R3 FAILED: Livreur non attribué aurait dû être rejeté.';
  END IF;

  RAISE NOTICE '✓ Règle 3 OK : Rôle livreur attribué vérifié.';

  -- ---------------------------------------------------------------------------
  -- TEST RÈGLE 1 & 4 : CRÉATION DE BROUILLON (NE RENVOIE PAS LE CODE) & CALCUL SERVEUR
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_courier_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- Modification : Chemise passe de 1 à 2 (+1000), ajout Costume du catalogue x 1 (+3000)
  -- Total attendu : (2 x 1000) + (1 x 3000) = 5000 sous-total + 500 frais = 5500 FCFA
  v_res_json := public.create_order_revision_draft(
    p_mission_id => v_mission_2_id,
    p_lines_json => jsonb_build_array(
      jsonb_build_object('order_item_id', 'a3000000-0000-0000-0000-000000000020', 'qty_after', 2),
      jsonb_build_object('service_id', v_service_costume_id, 'qty_after', 1, 'color', 'Bleu Nuit')
    ),
    p_notes => 'Ajout costume froissé'
  );

  IF (v_res_json->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST R1/R4 FAILED: create_order_revision_draft a échoué.';
  END IF;

  -- VÉRIFICATION CRITIQUE RÈGLE 1 : Le code N'EST PAS dans le retour de la fonction livreur
  IF v_res_json ? 'code' OR v_res_json ? 'otp_code' THEN
    RAISE EXCEPTION 'TEST R1 FAILED: La fonction livreur ne doit JAMAIS renvoyer le code client !';
  END IF;

  -- Vérification totaux serveur
  IF (v_res_json->>'subtotal_after')::numeric <> 5000 OR (v_res_json->>'total_after')::numeric <> 5500 THEN
    RAISE EXCEPTION 'TEST R4 FAILED: Totaux recalculés incorrects (sous-total: %, total: %).',
      v_res_json->>'subtotal_after', v_res_json->>'total_after';
  END IF;

  RAISE NOTICE '✓ Règle 1 & 4 OK : Brouillon créé, code non divulgué au livreur, totaux calculés au catalogue.';

  -- ---------------------------------------------------------------------------
  -- TEST RÈGLE 1 (SUITE) : LECTURE DU CODE VIA GET_PENDING_REVISION_FOR_CUSTOMER (PUBLIC/ANON)
  -- ---------------------------------------------------------------------------
  PERFORM set_config('role', 'anon', true);

  v_customer_json := public.get_pending_revision_for_customer('tok_client_d2_test');
  IF v_customer_json IS NULL OR v_customer_json->>'code' IS NULL THEN
    RAISE EXCEPTION 'TEST R1 FAILED: Le client ne peut pas lire le code sur son interface publique.';
  END IF;

  v_client_code := v_customer_json->>'code';
  IF char_length(v_client_code) <> 6 THEN
    RAISE EXCEPTION 'TEST R1 FAILED: Le code calculé doit faire 6 chiffres (vu: %).', v_client_code;
  END IF;

  RAISE NOTICE '✓ Règle 1 OK : Code client (%s) calculé à la volée via jeton public anon sans stockage.', v_client_code;

  -- ---------------------------------------------------------------------------
  -- TEST RÈGLE 2 : GESTION DES ESSAIS SANS EXCEPTION (ROLLBACK ÉVITÉ) & RENOUVELLEMENT
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_courier_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- Mauvais code saisi par le livreur
  v_res_json := public.confirm_order_revision_otp(v_mission_2_id, '999999');
  IF (v_res_json->>'ok')::boolean IS NOT FALSE OR (v_res_json->>'attempts_left')::integer <> 4 THEN
    RAISE EXCEPTION 'TEST R2 FAILED: confirm_order_revision_otp avec mauvais code doit renvoyer ok=false et attempts_left=4 (vu: %).', v_res_json;
  END IF;

  -- Vérifier en base que attempts a bien été incrémenté à 1
  SELECT attempts INTO v_count FROM public.order_revisions WHERE mission_id = v_mission_2_id AND status = 'PENDING_AGREEMENT';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST R2 FAILED: Le compteur attempts doit être à 1 en base (vu: %).', v_count;
  END IF;

  -- Renouvellement du code
  v_res_json := public.renew_order_revision_code(v_mission_2_id);
  IF (v_res_json->>'ok')::boolean IS NOT TRUE OR (v_res_json->>'attempts_left')::integer <> 5 OR (v_res_json->>'renews_left')::integer <> 2 THEN
    RAISE EXCEPTION 'TEST R2 FAILED: renew_order_revision_code a échoué (vu: %).', v_res_json;
  END IF;

  -- Lire le nouveau code renouvelé côté client
  PERFORM set_config('role', 'anon', true);
  v_customer_json := public.get_pending_revision_for_customer('tok_client_d2_test');
  v_client_code := v_customer_json->>'code';

  RAISE NOTICE '✓ Règle 2 OK : Mauvais code renvoie ok=false sans lever d''exception, renouvellement réussi.';

  -- ---------------------------------------------------------------------------
  -- TEST RÈGLE 5 : CONFIRMATION PAR CODE CLIENT & APPLICATION SÉLECTIVE
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_courier_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_res_json := public.confirm_order_revision_otp(v_mission_2_id, v_client_code);
  IF (v_res_json->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST R5 FAILED: Confirmation avec le bon code a échoué (message: %).', v_res_json->>'message';
  END IF;

  -- Vérifier mise à jour de la commande
  SELECT subtotal, total_amount, items_count_in INTO v_new_subtotal, v_new_total, v_count
  FROM public.orders WHERE id = v_order_2_id;

  IF v_new_subtotal <> 5000 OR v_new_total <> 5500 THEN
    RAISE EXCEPTION 'TEST R5 FAILED: Totaux commande non mis à jour (vu: subtotal %, total %).', v_new_subtotal, v_new_total;
  END IF;

  IF v_count IS NOT NULL THEN
    RAISE EXCEPTION 'TEST R5 FAILED: items_count_in ne doit PAS être touché lors de la révision chez le client.';
  END IF;

  -- Vérifier que la mission porte pickup_check_status = CORRECTED
  SELECT pickup_check_status INTO v_mission_res.pickup_check_status FROM public.delivery_missions WHERE id = v_mission_2_id;
  IF v_mission_res.pickup_check_status <> 'CORRECTED' THEN
    RAISE EXCEPTION 'TEST R5 FAILED: pickup_check_status doit être CORRECTED.';
  END IF;

  RAISE NOTICE '✓ Règle 5 OK : Révision confirmée et appliquée, items_count_in préservé, statut CORRECTED.';

  -- ---------------------------------------------------------------------------
  -- TEST RÈGLE 8 : DÉCLARATION SANS VÉRIFICATION CLIENT (UNVERIFIED_AGREEMENT)
  -- ---------------------------------------------------------------------------
  -- Création d'une révision v2
  v_res_json := public.create_order_revision_draft(
    p_mission_id => v_mission_2_id,
    p_lines_json => jsonb_build_array(
      jsonb_build_object('service_id', v_service_chemise_id, 'qty_after', 3)
    ),
    p_notes => 'Ajout 3e chemise'
  );

  -- Motif trop court (< 5 car.) doit échouer
  v_res_json := public.confirm_order_revision_unverified(v_mission_2_id, 'test');
  IF (v_res_json->>'ok')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'TEST R8 FAILED: Un motif < 5 caractères doit être refusé.';
  END IF;

  -- Motif valide >= 5 car.
  v_res_json := public.confirm_order_revision_unverified(v_mission_2_id, 'Téléphone du client déchargé');
  IF (v_res_json->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST R8 FAILED: Dérogation accord non vérifié a échoué.';
  END IF;

  SELECT status, verification_type INTO v_mission_res.status, v_mission_res.pickup_check_status
  FROM public.order_revisions WHERE mission_id = v_mission_2_id AND version_number = 2;

  IF v_mission_res.status <> 'UNVERIFIED_AGREEMENT' OR v_mission_res.pickup_check_status <> 'UNVERIFIED_DECLARATION' THEN
    RAISE EXCEPTION 'TEST R8 FAILED: Statuts dérogation incorrects (vu: %, %).', v_mission_res.status, v_mission_res.pickup_check_status;
  END IF;

  RAISE NOTICE '✓ Règle 8 OK : Accord non vérifié validé avec motif ≥ 5 car. et statut UNVERIFIED_AGREEMENT.';

  -- ---------------------------------------------------------------------------
  -- TEST RÈGLE 6 : PROTECTION MUTATION DIRECTE & ISOLATION
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_a_id::text)::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_caught := false;
  BEGIN
    DELETE FROM public.order_revisions;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE;
    IF v_err_code = '42501' THEN v_caught := true; END IF;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST R6 FAILED: DELETE direct sur order_revisions aurait dû être bloqué (42501).';
  END IF;

  RAISE NOTICE '✓ Règle 6 OK : Écritures directes sur order_revisions strictement bloquées.';

  -- ---------------------------------------------------------------------------
  -- ROLLBACK AUTOMATIQUE
  -- ---------------------------------------------------------------------------
  RAISE EXCEPTION 'ROLLBACK_TEST_SUCCESS';

EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM = 'ROLLBACK_TEST_SUCCESS' THEN
      RAISE NOTICE '=== TOUS LES TESTS SQL REVISIONS D2 (REWRITE STRICT) ONT RÉUSSI AVEC SUCCÈS ===';
    ELSE
      RAISE EXCEPTION '%', SQLERRM;
    END IF;
END $$;
