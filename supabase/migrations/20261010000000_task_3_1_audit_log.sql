-- =============================================================================
-- MIGRATION 20261010000000: JOURNAL D'AUDIT COMPLET (TÂCHE 3.1)
-- Triggers AFTER, Immutabilité stricte (UPDATE/DELETE interdit) et RLS OWNER/MANAGER
-- =============================================================================

-- 1. ÉVOLUTION D'AUDIT_LOGS POUR ALIGNEMENT DES COLONNES
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS object_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS object_id UUID,
  ADD COLUMN IF NOT EXISTS before JSONB,
  ADD COLUMN IF NOT EXISTS after JSONB;

-- Remplissage/synchronisation des anciennes colonnes vers les nouvelles si nécessaire
UPDATE public.audit_logs
SET
  user_id = COALESCE(user_id, changed_by),
  object_type = COALESCE(object_type, table_name),
  object_id = COALESCE(object_id, record_id),
  before = COALESCE(before, old_values),
  after = COALESCE(after, new_values)
WHERE object_type IS NULL;

-- 2. INDEXES REQUIS
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created
  ON public.audit_logs (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_object
  ON public.audit_logs (organization_id, object_type, object_id);

-- 3. FONCTIONS UTILITAIRES DE SÉCURITÉ DE VÉRIFICATION DE RÔLE SI NON ENCORE DÉFINIES
CREATE OR REPLACE FUNCTION public.catalog_is_member(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE organization_id = p_org_id
      AND user_id = auth.uid()
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.catalog_has_role(p_org_id UUID, p_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE organization_id = p_org_id
      AND user_id = auth.uid()
      AND is_active = true
      AND role = ANY(p_roles)
  );
$$;

-- 4. FONCTION DE COMPARAISON ET DIFF MINIMAL DE DEUX JSONB
CREATE OR REPLACE FUNCTION public.jsonb_diff_minimal(p_old jsonb, p_new jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_old_diff jsonb := '{}'::jsonb;
  v_new_diff jsonb := '{}'::jsonb;
  v_key text;
  v_val jsonb;
BEGIN
  IF p_old IS NULL OR p_new IS NULL THEN
    RETURN jsonb_build_object('old', p_old, 'new', p_new);
  END IF;

  FOR v_key, v_val IN SELECT * FROM jsonb_each(p_new) LOOP
    -- On exclut les champs système / horodatages de bruit
    IF v_key IN ('updated_at', 'created_at', 'updated_by') THEN
      CONTINUE;
    END IF;

    IF NOT (p_old ? v_key) OR (p_old -> v_key) IS DISTINCT FROM v_val THEN
      v_old_diff := v_old_diff || jsonb_build_object(v_key, p_old -> v_key);
      v_new_diff := v_new_diff || jsonb_build_object(v_key, v_val);
    END IF;
  END LOOP;

  IF v_old_diff = '{}'::jsonb AND v_new_diff = '{}'::jsonb THEN
    RETURN '{}'::jsonb;
  END IF;

  RETURN jsonb_build_object('old', v_old_diff, 'new', v_new_diff);
END;
$$;

-- 5. FONCTION TRIGGER DE JOURNALISATION AUTOMATIQUE
CREATE OR REPLACE FUNCTION public.trigger_generic_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_action VARCHAR(20);
  v_object_type VARCHAR(100);
  v_object_id UUID;
  v_old_data JSONB := NULL;
  v_new_data JSONB := NULL;
  v_diff JSONB := NULL;
BEGIN
  v_action := TG_OP;
  v_object_type := TG_TABLE_NAME;

  -- Détermination de l'ID de l'enregistrement et de l'organisation
  IF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_object_id := COALESCE(
      NULLIF(v_old_data ->> 'id', '')::UUID,
      NULLIF(v_old_data ->> 'service_id', '')::UUID
    );
    IF (v_old_data ? 'organization_id') THEN
      v_org_id := (v_old_data ->> 'organization_id')::UUID;
    ELSIF TG_TABLE_NAME = 'organizations' THEN
      v_org_id := OLD.id;
    END IF;
  ELSE
    v_new_data := to_jsonb(NEW);
    v_object_id := COALESCE(
      NULLIF(v_new_data ->> 'id', '')::UUID,
      NULLIF(v_new_data ->> 'service_id', '')::UUID
    );
    IF (v_new_data ? 'organization_id') THEN
      v_org_id := (v_new_data ->> 'organization_id')::UUID;
    ELSIF TG_TABLE_NAME = 'organizations' THEN
      v_org_id := NEW.id;
    END IF;
    IF TG_OP = 'UPDATE' THEN
      v_old_data := to_jsonb(OLD);
    END IF;
  END IF;

  -- Cas des tables filles (ex: order_items, service_costs)
  IF v_org_id IS NULL AND TG_TABLE_NAME = 'order_items' THEN
    SELECT organization_id INTO v_org_id FROM public.orders WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  ELSIF v_org_id IS NULL AND TG_TABLE_NAME = 'service_costs' THEN
    SELECT organization_id INTO v_org_id FROM public.services WHERE id = COALESCE(NEW.service_id, OLD.service_id);
  END IF;

  -- Auteur réel : auth.uid() ou paramètre de session audit.current_user_id
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    BEGIN
      v_user_id := NULLIF(current_setting('audit.current_user_id', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_user_id := NULL;
    END;
  END IF;

  -- Calcul du diff minimal pour les UPDATE
  IF TG_OP = 'UPDATE' THEN
    v_diff := public.jsonb_diff_minimal(v_old_data, v_new_data);
    -- Si aucun champ pertinent n'a changé, ne pas insérer de log inutile
    IF v_diff = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.audit_logs (
    organization_id,
    user_id,
    changed_by,
    object_type,
    table_name,
    object_id,
    record_id,
    action,
    before,
    old_values,
    after,
    new_values,
    created_at
  ) VALUES (
    v_org_id,
    v_user_id,
    v_user_id,
    v_object_type,
    v_object_type,
    v_object_id,
    v_object_id,
    v_action,
    CASE WHEN v_action = 'UPDATE' THEN v_diff -> 'old' ELSE v_old_data END,
    v_old_data,
    CASE WHEN v_action = 'UPDATE' THEN v_diff -> 'new' ELSE v_new_data END,
    v_new_data,
    NOW()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- 6. ATTACHEMENT DES TRIGGERS AFTER SUR TOUTES LES TABLES
DROP TRIGGER IF EXISTS trg_audit_orders ON public.orders;
CREATE TRIGGER trg_audit_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generic_audit_log();

DROP TRIGGER IF EXISTS trg_audit_order_items ON public.order_items;
CREATE TRIGGER trg_audit_order_items
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generic_audit_log();

DROP TRIGGER IF EXISTS trg_audit_payments ON public.payments;
CREATE TRIGGER trg_audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generic_audit_log();

DROP TRIGGER IF EXISTS trg_audit_services ON public.services;
CREATE TRIGGER trg_audit_services
  AFTER INSERT OR UPDATE OR DELETE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generic_audit_log();

DROP TRIGGER IF EXISTS trg_audit_service_costs ON public.service_costs;
CREATE TRIGGER trg_audit_service_costs
  AFTER INSERT OR UPDATE OR DELETE ON public.service_costs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generic_audit_log();

DROP TRIGGER IF EXISTS trg_audit_service_categories ON public.service_categories;
CREATE TRIGGER trg_audit_service_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.service_categories
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generic_audit_log();

DROP TRIGGER IF EXISTS trg_audit_garment_types ON public.garment_types;
CREATE TRIGGER trg_audit_garment_types
  AFTER INSERT OR UPDATE OR DELETE ON public.garment_types
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generic_audit_log();

DROP TRIGGER IF EXISTS trg_audit_memberships ON public.memberships;
CREATE TRIGGER trg_audit_memberships
  AFTER INSERT OR UPDATE OR DELETE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generic_audit_log();

DROP TRIGGER IF EXISTS trg_audit_organizations ON public.organizations;
CREATE TRIGGER trg_audit_organizations
  AFTER UPDATE OR DELETE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generic_audit_log();

-- 7. IMMUABILITÉ STRICTE D'AUDIT_LOGS : INTERDICTION DES UPDATE ET DELETE
CREATE OR REPLACE FUNCTION public.prevent_audit_logs_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Les lignes du journal d''audit sont immuables et ne peuvent être ni modifiées ni supprimées (SQLSTATE 42501).'
    USING ERRCODE = '42501';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_mutation ON public.audit_logs;
CREATE TRIGGER trg_prevent_audit_mutation
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_logs_mutation();

-- 8. DROITS ET POLITIQUES RLS SUR AUDIT_LOGS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.audit_logs TO authenticated;

DROP POLICY IF EXISTS "audit_owner_manager_read" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_trigger_insert" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_owner_manager_select" ON public.audit_logs;

-- Politiques de lecture sélective
CREATE POLICY "audit_logs_owner_manager_select"
  ON public.audit_logs FOR SELECT
  USING (
    public.catalog_is_member(organization_id)
    AND public.catalog_has_role(organization_id, ARRAY['OWNER', 'MANAGER'])
    AND (
      COALESCE(object_type, table_name) <> 'service_costs'
      OR public.catalog_has_role(organization_id, ARRAY['OWNER'])
    )
  );

GRANT EXECUTE ON FUNCTION public.catalog_is_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_has_role(UUID, TEXT[]) TO authenticated;
