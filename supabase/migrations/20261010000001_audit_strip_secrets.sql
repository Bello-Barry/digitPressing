-- =============================================================================
-- MIGRATION 20261010000001 : AUCUN SECRET DANS LE JOURNAL D'AUDIT
-- Constat : l'INSERT d'une commande journalisait la ligne complète, y compris
-- invoice_token (jeton qui donne accès public à la facture) et ip_hash.
-- 1. Un déclencheur BEFORE INSERT retire ces clés de toute nouvelle ligne.
-- 2. Les lignes déjà écrites sont nettoyées une seule fois (l'immuabilité est
--    levée le temps du nettoyage, puis rétablie dans la même transaction).
-- Idempotente. Aucune ligne n'est supprimée.
-- =============================================================================

-- 1. Retrait des clés secrètes à l'écriture
CREATE OR REPLACE FUNCTION public.audit_strip_secrets()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_keys text[] := ARRAY['invoice_token', 'ip_hash'];
BEGIN
  NEW."before"   := NEW."before"   - v_keys;
  NEW."after"    := NEW."after"    - v_keys;
  NEW.old_values := NEW.old_values - v_keys;
  NEW.new_values := NEW.new_values - v_keys;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_strip_secrets ON public.audit_logs;
CREATE TRIGGER trg_audit_strip_secrets
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_strip_secrets();

-- 2. Nettoyage unique des anciennes lignes
DROP TRIGGER IF EXISTS trg_prevent_audit_mutation ON public.audit_logs;
DROP TRIGGER IF EXISTS trg_prevent_audit_truncate ON public.audit_logs;

UPDATE public.audit_logs
SET "before"   = "before"   - ARRAY['invoice_token', 'ip_hash'],
    "after"    = "after"    - ARRAY['invoice_token', 'ip_hash'],
    old_values = old_values - ARRAY['invoice_token', 'ip_hash'],
    new_values = new_values - ARRAY['invoice_token', 'ip_hash']
WHERE "before"   ?| ARRAY['invoice_token', 'ip_hash']
   OR "after"    ?| ARRAY['invoice_token', 'ip_hash']
   OR old_values ?| ARRAY['invoice_token', 'ip_hash']
   OR new_values ?| ARRAY['invoice_token', 'ip_hash'];

-- 3. Immuabilité rétablie
CREATE TRIGGER trg_prevent_audit_mutation
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_logs_mutation();

CREATE TRIGGER trg_prevent_audit_truncate
  BEFORE TRUNCATE ON public.audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_audit_logs_mutation();

-- 4. VÉRIFICATION : lignes_avec_secret doit valoir 0 ; les 3 déclencheurs doivent exister
SELECT
  (SELECT count(*) FROM public.audit_logs
    WHERE "before"   ?| ARRAY['invoice_token', 'ip_hash']
       OR "after"    ?| ARRAY['invoice_token', 'ip_hash']
       OR old_values ?| ARRAY['invoice_token', 'ip_hash']
       OR new_values ?| ARRAY['invoice_token', 'ip_hash']) AS lignes_avec_secret,
  (SELECT count(*) FROM pg_trigger
    WHERE tgrelid = 'public.audit_logs'::regclass
      AND tgname IN ('trg_audit_strip_secrets', 'trg_prevent_audit_mutation', 'trg_prevent_audit_truncate')
      AND NOT tgisinternal) AS declencheurs_en_place;
