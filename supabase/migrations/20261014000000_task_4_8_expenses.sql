-- =============================================================================
-- MIGRATION 20261014000000: DÉPENSES DU PRESSING & IMPACT CAISSE/RÉSULTAT (TÂCHE 4.8)
-- Migration unique, additive, idempotente
-- =============================================================================

-- 1. EXTENSION DE LA TABLE ORGANIZATIONS (Plafond de dépense du caissier)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS cashier_expense_limit NUMERIC NOT NULL DEFAULT 10000 CHECK (cashier_expense_limit >= 0);

-- 2. TABLE EXPENSE_CATEGORIES (Catégories de dépenses configurables)
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID         NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name                TEXT         NOT NULL,
  kind                TEXT         NOT NULL CHECK (kind IN ('DAILY', 'FIXED', 'TAX', 'TRANSFER', 'OTHER')),
  counts_in_result    BOOLEAN      NOT NULL DEFAULT true,
  owner_only          BOOLEAN      NOT NULL DEFAULT false,
  cashier_allowed     BOOLEAN      NOT NULL DEFAULT false,
  note_required       BOOLEAN      NOT NULL DEFAULT false,
  sort_order          INT          NOT NULL DEFAULT 0,
  is_active           BOOLEAN      NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Index d'unicité par organisation sur le nom normalisé
CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_categories_unique_name
  ON public.expense_categories (organization_id, public.normalize_catalog_name(name));

CREATE INDEX IF NOT EXISTS idx_expense_categories_org_kind
  ON public.expense_categories (organization_id, kind, is_active);

-- 3. FONCTION DE SEED DES CATÉGORIES PAR DÉFAUT
CREATE OR REPLACE FUNCTION public.seed_default_expense_categories(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- DAILY (Autorisées aux caissiers)
  INSERT INTO public.expense_categories (organization_id, name, kind, counts_in_result, owner_only, cashier_allowed, note_required, sort_order)
  VALUES
    (p_org_id, 'Ration journalière des employés', 'DAILY', true, false, true, false, 10),
    (p_org_id, 'Produits de lavage et d''entretien', 'DAILY', true, false, true, false, 20),
    (p_org_id, 'Carburant (groupe électrogène en cas de coupure)', 'DAILY', true, false, true, false, 30),
    (p_org_id, 'Transport et déplacements', 'DAILY', true, false, true, false, 40),
    (p_org_id, 'Emballages et fournitures (cintres, sachets)', 'DAILY', true, false, true, false, 50),
    (p_org_id, 'Petites réparations et entretien', 'DAILY', true, false, true, false, 60),
    (p_org_id, 'Eau', 'DAILY', true, false, true, false, 70),
    (p_org_id, 'Autres dépenses courantes', 'DAILY', true, false, true, true, 80)
  ON CONFLICT DO NOTHING;

  -- FIXED (Charges fixes)
  INSERT INTO public.expense_categories (organization_id, name, kind, counts_in_result, owner_only, cashier_allowed, note_required, sort_order)
  VALUES
    (p_org_id, 'Loyer', 'FIXED', true, false, false, false, 110),
    (p_org_id, 'Salaires', 'FIXED', true, true, false, false, 120),
    (p_org_id, 'Électricité', 'FIXED', true, false, false, false, 130),
    (p_org_id, 'Téléphone et internet', 'FIXED', true, false, false, false, 140)
  ON CONFLICT DO NOTHING;

  -- TAX (Impôts et taxes)
  INSERT INTO public.expense_categories (organization_id, name, kind, counts_in_result, owner_only, cashier_allowed, note_required, sort_order)
  VALUES
    (p_org_id, 'Patente', 'TAX', true, false, false, false, 210),
    (p_org_id, 'Contrat de bail (frais d''enregistrement)', 'TAX', true, false, false, false, 220),
    (p_org_id, 'Taxes de la mairie', 'TAX', true, false, false, false, 230),
    (p_org_id, 'Autres impôts et taxes', 'TAX', true, false, false, false, 240)
  ON CONFLICT DO NOTHING;

  -- TRANSFER (Mouvements de trésorerie non comptabilisés dans le résultat)
  INSERT INTO public.expense_categories (organization_id, name, kind, counts_in_result, owner_only, cashier_allowed, note_required, sort_order)
  VALUES
    (p_org_id, 'Retrait du propriétaire', 'TRANSFER', false, true, false, false, 310),
    (p_org_id, 'Versement en banque ou Mobile Money', 'TRANSFER', false, false, false, false, 320)
  ON CONFLICT DO NOTHING;

  -- OTHER (Autres charges)
  INSERT INTO public.expense_categories (organization_id, name, kind, counts_in_result, owner_only, cashier_allowed, note_required, sort_order)
  VALUES
    (p_org_id, 'Autres charges', 'OTHER', true, false, false, true, 410)
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_default_expense_categories(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_default_expense_categories(UUID) TO authenticated;

-- Exécution pour toutes les organisations existantes
DO $$
DECLARE
  v_org RECORD;
BEGIN
  FOR v_org IN SELECT id FROM public.organizations LOOP
    PERFORM public.seed_default_expense_categories(v_org.id);
  END LOOP;
END $$;

-- 4. TABLE EXPENSES (Registre des dépenses)
CREATE TABLE IF NOT EXISTS public.expenses (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID         NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category_id      UUID         NOT NULL REFERENCES public.expense_categories(id) ON DELETE RESTRICT,
  amount           NUMERIC      NOT NULL CHECK (amount > 0 AND amount = trunc(amount)),
  expense_date     DATE         NOT NULL CHECK (expense_date <= CURRENT_DATE),
  method           TEXT         NOT NULL CHECK (method IN ('CASH', 'MTN_MOMO', 'AIRTEL_MONEY', 'BANK', 'OTHER')),
  from_till        BOOLEAN      NOT NULL DEFAULT false,
  payee            TEXT         CHECK (payee IS NULL OR char_length(payee) <= 100),
  reference        TEXT         CHECK (reference IS NULL OR char_length(reference) <= 100),
  note             TEXT         CHECK (note IS NULL OR char_length(note) <= 300),
  period_start     DATE,
  period_end       DATE,
  created_by       UUID,        -- Sans FK vers auth.users pour survivre à la suppression d'utilisateur
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  voided_at        TIMESTAMPTZ,
  voided_by        UUID,
  void_reason      TEXT,
  CONSTRAINT chk_expense_till_method CHECK (from_till = false OR method = 'CASH'),
  CONSTRAINT chk_expense_period CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start),
  CONSTRAINT chk_expense_void CHECK (voided_at IS NULL OR (void_reason IS NOT NULL AND char_length(trim(void_reason)) >= 5))
);

CREATE INDEX IF NOT EXISTS idx_expenses_org_date
  ON public.expenses (organization_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_category
  ON public.expenses (category_id);

-- 5. TRIGGER BEFORE UPDATE ET DELETE : IMMUABILITÉ STRICTE DES DÉPENSES
CREATE OR REPLACE FUNCTION public.prevent_expense_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Les lignes de dépenses ne peuvent pas être supprimées (SQLSTATE 42501).'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Refuser toute modification sur une dépense déjà annulée
    IF OLD.voided_at IS NOT NULL THEN
      RAISE EXCEPTION 'Une dépense déjà annulée ne peut plus être modifiée (SQLSTATE 42501).'
        USING ERRCODE = '42501';
    END IF;

    -- Vérifier que les colonnes métier ne sont PAS modifiées
    IF NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.category_id IS DISTINCT FROM OLD.category_id
       OR NEW.expense_date IS DISTINCT FROM OLD.expense_date
       OR NEW.method IS DISTINCT FROM OLD.method
       OR NEW.from_till IS DISTINCT FROM OLD.from_till
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
      RAISE EXCEPTION 'Les informations d''une dépense enregistrée sont immuables. Seule l''annulation avec motif est autorisée (SQLSTATE 42501).'
        USING ERRCODE = '42501';
    END IF;

    -- Seules les colonnes d'annulation peuvent passer de NULL à renseigné
    IF NEW.voided_at IS NULL THEN
      RAISE EXCEPTION 'L''annulation d''une dépense exige de renseigner voided_at (SQLSTATE 42501).'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_expense_mutation ON public.expenses;
CREATE TRIGGER trg_prevent_expense_mutation
  BEFORE UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.prevent_expense_mutation();

-- 6. FONCTION DE SAISIE SÉCURISÉE : RECORD_EXPENSE
CREATE OR REPLACE FUNCTION public.record_expense(
  p_org_id        UUID,
  p_category_id   UUID,
  p_amount        NUMERIC,
  p_expense_date  DATE,
  p_method        TEXT,
  p_from_till     BOOLEAN,
  p_payee         TEXT DEFAULT NULL,
  p_reference     TEXT DEFAULT NULL,
  p_note          TEXT DEFAULT NULL,
  p_period_start  DATE DEFAULT NULL,
  p_period_end    DATE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID := auth.uid();
  v_role         TEXT;
  v_cat          RECORD;
  v_limit        NUMERIC;
  v_expense_id   UUID;
  v_is_closed    BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié.' USING ERRCODE = '42501';
  END IF;

  -- 1. Détermination du rôle dans l'organisation
  SELECT role::text INTO v_role
  FROM public.memberships
  WHERE organization_id = p_org_id
    AND user_id = v_user_id
    AND is_active = true;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Accès refusé : vous n''êtes pas membre actif de cette organisation.' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'DELIVERY' THEN
    RAISE EXCEPTION 'Accès refusé : le rôle LIVREUR ne peut pas enregistrer de dépenses.' USING ERRCODE = '42501';
  END IF;

  -- 2. Validation de la catégorie
  SELECT id, name, owner_only, cashier_allowed, note_required, is_active
  INTO v_cat
  FROM public.expense_categories
  WHERE id = p_category_id AND organization_id = p_org_id;

  IF v_cat.id IS NULL OR NOT v_cat.is_active THEN
    RAISE EXCEPTION 'Catégorie de dépense invalide ou inactive.' USING ERRCODE = '42501';
  END IF;

  -- 3. Vérification des autorisations spécifiques par rôle
  IF v_role = 'MANAGER' AND v_cat.owner_only THEN
    RAISE EXCEPTION 'Accès refusé : la catégorie "%" est réservée au propriétaire (OWNER).', v_cat.name USING ERRCODE = '42501';
  END IF;

  IF v_role = 'CASHIER' THEN
    IF NOT v_cat.cashier_allowed THEN
      RAISE EXCEPTION 'Accès refusé : la catégorie "%" n''est pas autorisée aux caissiers.', v_cat.name USING ERRCODE = '42501';
    END IF;

    -- Récupération du plafond caissier de l'organisation
    SELECT cashier_expense_limit INTO v_limit
    FROM public.organizations
    WHERE id = p_org_id;

    IF p_amount > v_limit THEN
      RAISE EXCEPTION 'Montant supérieur à votre plafond autorisé (Plafond : % FCFA). Veuillez demander au gérant.', v_limit USING ERRCODE = '42501';
    END IF;

    -- Contrôle de la date (aujourd'hui ou hier uniquement pour le caissier)
    IF p_expense_date < CURRENT_DATE - 1 OR p_expense_date > CURRENT_DATE THEN
      RAISE EXCEPTION 'Un caissier ne peut enregistrer des dépenses que pour aujourd''hui ou hier.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 4. Contrôle de date globale (pas dans le futur)
  IF p_expense_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'La date de la dépense ne peut pas être située dans le futur.' USING ERRCODE = '42501';
  END IF;

  -- 5. Note obligatoire si exigée par la catégorie
  IF v_cat.note_required AND (p_note IS NULL OR char_length(trim(p_note)) < 5) THEN
    RAISE EXCEPTION 'Une note explicative détaillée (au moins 5 caractères) est obligatoire pour cette catégorie.' USING ERRCODE = '42501';
  END IF;

  -- 6. Dépense sur caisse : vérification de la fermeture de caisse
  IF p_from_till THEN
    IF p_method <> 'CASH' THEN
      RAISE EXCEPTION 'Une dépense payée depuis la caisse doit obligatoirement être en espèces (CASH).' USING ERRCODE = '42501';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.cash_closings
      WHERE organization_id = p_org_id
        AND date = p_expense_date
        AND status = 'CLOSED'
    ) INTO v_is_closed;

    IF v_is_closed THEN
      RAISE EXCEPTION 'Impossible d''enregistrer une dépense en caisse pour une journée déjà clôturée.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 7. Insertion de la dépense
  INSERT INTO public.expenses (
    organization_id,
    category_id,
    amount,
    expense_date,
    method,
    from_till,
    payee,
    reference,
    note,
    period_start,
    period_end,
    created_by
  ) VALUES (
    p_org_id,
    p_category_id,
    p_amount,
    p_expense_date,
    p_method,
    p_from_till,
    NULLIF(trim(p_payee), ''),
    NULLIF(trim(p_reference), ''),
    NULLIF(trim(p_note), ''),
    p_period_start,
    p_period_end,
    v_user_id
  )
  RETURNING id INTO v_expense_id;

  RETURN v_expense_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_expense FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_expense TO authenticated;

-- 7. FONCTION D'ANNULATION SÉCURISÉE : VOID_EXPENSE
CREATE OR REPLACE FUNCTION public.void_expense(
  p_id      UUID,
  p_reason  TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID := auth.uid();
  v_role       TEXT;
  v_exp        RECORD;
  v_is_closed  BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié.' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR char_length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Un motif d''annulation détaillé (au moins 5 caractères) est obligatoire.' USING ERRCODE = '42501';
  END IF;

  -- Chargement de la dépense
  SELECT e.*, c.owner_only
  INTO v_exp
  FROM public.expenses e
  JOIN public.expense_categories c ON c.id = e.category_id
  WHERE e.id = p_id;

  IF v_exp.id IS NULL THEN
    RAISE EXCEPTION 'Dépense introuvable.' USING ERRCODE = '42501';
  END IF;

  IF v_exp.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cette dépense est déjà annulée.' USING ERRCODE = '42501';
  END IF;

  -- Détermination du rôle
  SELECT role::text INTO v_role
  FROM public.memberships
  WHERE organization_id = v_exp.organization_id
    AND user_id = v_user_id
    AND is_active = true;

  IF v_role IS NULL OR v_role NOT IN ('OWNER', 'MANAGER') THEN
    RAISE EXCEPTION 'L''annulation d''une dépense est réservée aux rôles OWNER et MANAGER.' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'MANAGER' AND v_exp.owner_only THEN
    RAISE EXCEPTION 'Accès refusé : le gérant ne peut pas annuler une dépense réservée au propriétaire.' USING ERRCODE = '42501';
  END IF;

  -- Si payée sur la caisse, vérifier que la journée de caisse n'est pas déjà clôturée
  IF v_exp.from_till THEN
    SELECT EXISTS (
      SELECT 1 FROM public.cash_closings
      WHERE organization_id = v_exp.organization_id
        AND date = v_exp.expense_date
        AND status = 'CLOSED'
    ) INTO v_is_closed;

    IF v_is_closed THEN
      RAISE EXCEPTION 'Impossible d''annuler une dépense en caisse pour une journée déjà clôturée.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Annulation effectuant la mise à jour
  UPDATE public.expenses
  SET
    voided_at = NOW(),
    voided_by = v_user_id,
    void_reason = trim(p_reason)
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.void_expense FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_expense TO authenticated;

-- 8. RLS ET POLITIQUES DE SÉCURITÉ SUR EXPENSE_CATEGORIES ET EXPENSES
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.expense_categories FROM anon, PUBLIC;
REVOKE ALL ON public.expenses FROM anon, PUBLIC;

GRANT SELECT ON public.expense_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;

GRANT SELECT ON public.expenses TO authenticated;
-- L'écriture sur expenses se fait STRICTEMENT via les fonctions SECURITY DEFINER

DROP POLICY IF EXISTS "expense_categories_select" ON public.expense_categories;
CREATE POLICY "expense_categories_select"
  ON public.expense_categories FOR SELECT
  USING (
    public.catalog_is_member(organization_id)
    AND (
      public.catalog_has_role(organization_id, ARRAY['OWNER', 'CASHIER'])
      OR (public.catalog_has_role(organization_id, ARRAY['MANAGER']) AND owner_only = false)
    )
  );

DROP POLICY IF EXISTS "expense_categories_write" ON public.expense_categories;
CREATE POLICY "expense_categories_write"
  ON public.expense_categories FOR ALL
  USING (
    public.catalog_is_member(organization_id)
    AND (
      public.catalog_has_role(organization_id, ARRAY['OWNER'])
      OR (public.catalog_has_role(organization_id, ARRAY['MANAGER']) AND owner_only = false)
    )
  )
  WITH CHECK (
    public.catalog_is_member(organization_id)
    AND (
      public.catalog_has_role(organization_id, ARRAY['OWNER'])
      OR (public.catalog_has_role(organization_id, ARRAY['MANAGER']) AND owner_only = false)
    )
  );

DROP POLICY IF EXISTS "expenses_select" ON public.expenses;
CREATE POLICY "expenses_select"
  ON public.expenses FOR SELECT
  USING (
    public.catalog_is_member(organization_id)
    AND (
      -- OWNER voit tout dans son organisation
      public.catalog_has_role(organization_id, ARRAY['OWNER'])
      OR
      -- MANAGER voit tout sauf les catégories owner_only
      (
        public.catalog_has_role(organization_id, ARRAY['MANAGER'])
        AND EXISTS (
          SELECT 1 FROM public.expense_categories c
          WHERE c.id = category_id AND c.owner_only = false
        )
      )
      OR
      -- CASHIER voit seulement SES dépenses des 2 derniers jours
      (
        public.catalog_has_role(organization_id, ARRAY['CASHIER'])
        AND created_by = auth.uid()
        AND expense_date >= CURRENT_DATE - 1
      )
    )
  );

-- 9. TRIGGERS D'AUDIT SUR EXPENSES ET EXPENSE_CATEGORIES
DROP TRIGGER IF EXISTS trg_audit_expenses ON public.expenses;
CREATE TRIGGER trg_audit_expenses
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generic_audit_log();

DROP TRIGGER IF EXISTS trg_audit_expense_categories ON public.expense_categories;
CREATE TRIGGER trg_audit_expense_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generic_audit_log();

-- Mise à jour de la politique de lecture sur audit_logs pour masquer les dépenses owner_only aux gérants
DROP POLICY IF EXISTS "audit_logs_owner_manager_select" ON public.audit_logs;
CREATE POLICY "audit_logs_owner_manager_select"
  ON public.audit_logs FOR SELECT
  USING (
    public.catalog_is_member(organization_id)
    AND public.catalog_has_role(organization_id, ARRAY['OWNER', 'MANAGER'])
    AND (
      -- Exclure les modules sensibles si non-OWNER
      COALESCE(object_type, table_name) NOT IN ('service_costs', 'expenses', 'expense_categories')
      OR (
        COALESCE(object_type, table_name) = 'service_costs'
        AND public.catalog_has_role(organization_id, ARRAY['OWNER'])
      )
      OR (
        COALESCE(object_type, table_name) = 'expense_categories'
        AND (
          NOT COALESCE((after->>'owner_only')::boolean, (before->>'owner_only')::boolean, false)
          OR public.catalog_has_role(organization_id, ARRAY['OWNER'])
        )
      )
      OR (
        COALESCE(object_type, table_name) = 'expenses'
        AND (
          NOT EXISTS (
            SELECT 1 FROM public.expense_categories c
            WHERE c.id = COALESCE(NULLIF(after->>'category_id', '')::uuid, NULLIF(before->>'category_id', '')::uuid)
              AND c.owner_only = true
          )
          OR public.catalog_has_role(organization_id, ARRAY['OWNER'])
        )
      )
    )
  );

-- 10. VUE DE CALCUL DE LA CAISSE ATTENDUE D'UNE JOURNÉE (Intégrant les dépenses en caisse)
CREATE OR REPLACE VIEW public.v_daily_cash_summary
WITH (security_invoker = true)
AS
SELECT
  p.organization_id,
  p.collected_at::date AS date,
  COALESCE(SUM(p.amount), 0) AS total_cash_collected,
  COALESCE((
    SELECT SUM(e.amount)
    FROM public.expenses e
    WHERE e.organization_id = p.organization_id
      AND e.expense_date = p.collected_at::date
      AND e.method = 'CASH'
      AND e.from_till = true
      AND e.voided_at IS NULL
  ), 0) AS total_cash_expenses,
  COALESCE(SUM(p.amount), 0) - COALESCE((
    SELECT SUM(e.amount)
    FROM public.expenses e
    WHERE e.organization_id = p.organization_id
      AND e.expense_date = p.collected_at::date
      AND e.method = 'CASH'
      AND e.from_till = true
      AND e.voided_at IS NULL
  ), 0) AS expected_cash_balance
FROM public.payments p
WHERE p.method = 'CASH'
GROUP BY p.organization_id, p.collected_at::date;
