-- =============================================================================
-- MIGRATION TASK 4.3 : LINGE PRÊT NON RÉCUPÉRÉ & RAPPELS WHATSAPP
-- =============================================================================

-- 1. COLONNE ready_at SUR ORDERS ET DÉCLENCHEUR DE DATE DE PASSAGE À 'READY'
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.set_orders_ready_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'READY' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'READY' OR NEW.ready_at IS NULL) THEN
    NEW.ready_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_set_ready_at ON public.orders;
CREATE TRIGGER trg_orders_set_ready_at
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_orders_ready_at();

-- Remplissage rétroactif de ready_at pour les commandes READY existantes
UPDATE public.orders o
SET ready_at = COALESCE(
  (
    SELECT a.created_at
    FROM public.audit_logs a
    WHERE a.object_type = 'orders'
      AND a.object_id = o.id::text
      AND a.after->>'status' = 'READY'
    ORDER BY a.created_at ASC
    LIMIT 1
  ),
  o.updated_at,
  o.created_at,
  NOW()
)
WHERE o.status = 'READY' AND o.ready_at IS NULL;

-- 2. TABLE customer_reminders ET POLITIQUES RLS
CREATE TABLE IF NOT EXISTS public.customer_reminders (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id     UUID        REFERENCES public.customers(id) ON DELETE SET NULL,
  order_id        UUID        REFERENCES public.orders(id) ON DELETE SET NULL,
  kind            TEXT        NOT NULL DEFAULT 'READY_PICKUP' CHECK (kind IN ('READY_PICKUP')),
  created_by      UUID        REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.customer_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_reminders_member_select" ON public.customer_reminders;
CREATE POLICY "customer_reminders_member_select"
  ON public.customer_reminders FOR SELECT
  USING (public.catalog_is_member(organization_id));

-- Note : Aucun UPDATE ni DELETE possible pour les utilisateurs (pas de politique).

-- 3. RPC DE LOG DES RAPPELS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.log_reminder(
  p_order_id UUID,
  p_kind TEXT DEFAULT 'READY_PICKUP'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_order RECORD;
  v_reminder_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié' USING ERRCODE = '42501';
  END IF;

  SELECT id, organization_id, customer_id, status
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande non trouvée' USING ERRCODE = 'P0002';
  END IF;

  IF v_order.status != 'READY' THEN
    RAISE EXCEPTION 'La commande doit être prête pour enregistrer un rappel' USING ERRCODE = '42501';
  END IF;

  IF NOT public.catalog_has_role(v_order.organization_id, ARRAY['OWNER', 'MANAGER', 'CASHIER']) THEN
    RAISE EXCEPTION 'Accès refusé pour ce rôle' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.customer_reminders (
    organization_id,
    customer_id,
    order_id,
    kind,
    created_by
  )
  VALUES (
    v_order.organization_id,
    v_order.customer_id,
    p_order_id,
    p_kind,
    v_user_id
  )
  RETURNING id INTO v_reminder_id;

  RETURN v_reminder_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_reminder(UUID, TEXT) TO authenticated;

-- 4. DÉCLENCHEUR D'AUDIT SUR customer_reminders
DROP TRIGGER IF EXISTS trg_audit_customer_reminders ON public.customer_reminders;
CREATE TRIGGER trg_audit_customer_reminders
  AFTER INSERT OR UPDATE OR DELETE ON public.customer_reminders
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generic_audit_log();

-- 5. PARAMÈTRE DE DÉLAI SUR ORGANIZATIONS
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS pickup_reminder_days INT NOT NULL DEFAULT 3 CHECK (pickup_reminder_days BETWEEN 1 AND 60);
