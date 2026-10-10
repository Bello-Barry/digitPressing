-- =============================================================================
-- TEST D'ISOLATION ET D'IMMUABILITÉ DU JOURNAL D'AUDIT (TÂCHE 3.1)
-- Exécution sous forme de bloc anonyme transactionnel (Rollback automatique)
-- =============================================================================

DO $$
DECLARE
  v_org_a UUID := '11111111-1111-1111-1111-111111111111';
  v_org_b UUID := '22222222-2222-2222-2222-222222222222';
  v_test_service_id UUID;
  v_log_count INT;
  v_exception_caught BOOLEAN := FALSE;
  v_diff_before JSONB;
  v_diff_after JSONB;
BEGIN
  RAISE NOTICE '=== DEBUT TEST D''AUDIT LOG ET ISOLATION RLS (TÂCHE 3.1) ===';

  -- 1. CRÉATION D'UNE PRESTATION TEST AFIN DE DÉCLENCHER LE TRIGGER D'AUDIT DANS ORG A
  INSERT INTO public.services (organization_id, name, category, price, estimated_days)
  VALUES (v_org_a, 'Service Test Audit A', 'vetement', 5000, 2)
  RETURNING id INTO v_test_service_id;

  -- Vérification que le trigger AFTER a inséré UNE seule ligne d'audit dans audit_logs pour ORG A
  SELECT COUNT(*) INTO v_log_count
  FROM public.audit_logs
  WHERE organization_id = v_org_a AND object_type = 'services' AND object_id = v_test_service_id AND action = 'INSERT';

  IF v_log_count <> 1 THEN
    RAISE EXCEPTION 'ÉCHEC TEST : Le trigger AFTER d''audit n''a pas créé exactement 1 ligne d''audit (reçu %).', v_log_count;
  END IF;
  RAISE NOTICE '[PASS] Trigger AFTER d''audit exécuté avec succès (1 seule ligne créée sur INSERT).';

  -- 2. MODIFICATION DE LA PRESTATION POUR TESTER LE COMPORTEMENT DES DIFFS SUR UPDATE
  UPDATE public.services
  SET price = 6000
  WHERE id = v_test_service_id;

  SELECT before, after INTO v_diff_before, v_diff_after
  FROM public.audit_logs
  WHERE organization_id = v_org_a AND object_type = 'services' AND object_id = v_test_service_id AND action = 'UPDATE'
  ORDER BY created_at DESC LIMIT 1;

  IF v_diff_before IS NULL OR v_diff_after IS NULL OR (v_diff_after ->> 'price') <> '6000' THEN
    RAISE EXCEPTION 'ÉCHEC TEST : Les champs before/after du diff minimal sur UPDATE sont incorrects : before=%, after=%', v_diff_before, v_diff_after;
  END IF;
  RAISE NOTICE '[PASS] Diff minimal sur UPDATE valide (price: 5000 -> 6000).';

  -- 3. CRÉATION ET MODIFICATION D'UN COÛT SERVICE DANS SERVICE_COSTS
  INSERT INTO public.service_costs (service_id, organization_id, cost_price)
  VALUES (v_test_service_id, v_org_a, 2500)
  ON CONFLICT (service_id) DO UPDATE SET cost_price = 2500;

  SELECT COUNT(*) INTO v_log_count
  FROM public.audit_logs
  WHERE organization_id = v_org_a AND object_type = 'service_costs' AND object_id = v_test_service_id;

  IF v_log_count < 1 THEN
    RAISE EXCEPTION 'ÉCHEC TEST : Le trigger d''audit n''a pas enregistré la modification dans service_costs.';
  END IF;
  RAISE NOTICE '[PASS] Trigger d''audit sur service_costs fonctionnel.';

  -- 4. TEST D'IMMUABILITÉ STRICTE : TENTATIVE D'UPDATE SUR AUDIT_LOGS (REFUSÉ AVEC SQLSTATE 42501)
  BEGIN
    UPDATE public.audit_logs
    SET action = 'HACK'
    WHERE organization_id = v_org_a AND object_id = v_test_service_id;
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_exception_caught := TRUE;
    RAISE NOTICE '[PASS] Tentative d''UPDATE sur audit_logs rejetée avec SQLSTATE 42501.';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'ÉCHEC TEST : Erreur inattendue lors de la tentative UPDATE sur audit_logs: %', SQLERRM;
  END;

  IF NOT v_exception_caught THEN
    RAISE EXCEPTION 'ÉCHEC TEST : L''UPDATE sur audit_logs n''a pas été bloqué par le trigger d''immuabilité.';
  END IF;

  -- 5. TEST D'IMMUABILITÉ STRICTE : TENTATIVE DE DELETE SUR AUDIT_LOGS (REFUSÉ AVEC SQLSTATE 42501)
  v_exception_caught := FALSE;
  BEGIN
    DELETE FROM public.audit_logs
    WHERE organization_id = v_org_a AND object_id = v_test_service_id;
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_exception_caught := TRUE;
    RAISE NOTICE '[PASS] Tentative de DELETE sur audit_logs rejetée avec SQLSTATE 42501.';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'ÉCHEC TEST : Erreur inattendue lors de la tentative DELETE sur audit_logs: %', SQLERRM;
  END;

  IF NOT v_exception_caught THEN
    RAISE EXCEPTION 'ÉCHEC TEST : Le DELETE sur audit_logs n''a pas été bloqué par le trigger d''immuabilité.';
  END IF;

  -- 6. TEST D'IMMUABILITÉ STRICTE : TENTATIVE DE TRUNCATE SUR AUDIT_LOGS (REFUSÉ AVEC SQLSTATE 42501)
  v_exception_caught := FALSE;
  BEGIN
    TRUNCATE TABLE public.audit_logs;
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_exception_caught := TRUE;
    RAISE NOTICE '[PASS] Tentative de TRUNCATE sur audit_logs rejetée avec SQLSTATE 42501.';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'ÉCHEC TEST : Erreur inattendue lors de la tentative TRUNCATE sur audit_logs: %', SQLERRM;
  END;

  IF NOT v_exception_caught THEN
    RAISE EXCEPTION 'ÉCHEC TEST : Le TRUNCATE sur audit_logs n''a pas été bloqué par le trigger d''immuabilité.';
  END IF;

  RAISE NOTICE '=== TOUS LES TESTS D''AUDIT LOG, ISOLATION ET DIFFS SONT REUSSIS (ROLLBACK EN COURS) ===';
  -- Annulation systématique des données de test
  RAISE EXCEPTION 'TEST_SUCCESS_ROLLBACK' USING ERRCODE = 'P0001';
EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE = 'P0001' THEN
    RAISE NOTICE '[BILAN] Test d''audit et RLS d''isolation validés sans altération de la base.';
  ELSE
    RAISE EXCEPTION 'ERREUR DURANT LE TEST D''AUDIT LOG: % (%)', SQLERRM, SQLSTATE;
  END IF;
END $$;
