-- =============================================================================
-- MIGRATION 20261014000000 (VERSION CORRIGÉE) : DÉPENSES DU PRESSING (TÂCHE 4.8)
-- Corrections par rapport à la version de Jules :
--  1. Vue de caisse : l'erreur "subquery uses ungrouped column p.collected_at"
--     est corrigée (agrégation séparée des paiements et des dépenses).
--  2. Fuseau horaire : les dates se calculent à l'heure de Brazzaville (UTC+1),
--     sinon une dépense saisie entre minuit et 1 h était refusée ou mal datée.
--  3. Politique du journal : la version de Jules supprimait une politique qui
--     n'existe pas (audit_logs_owner_manager_select) et laissait la mienne
--     (audit_logs_select) active EN PLUS : les gérants auraient pu lire les
--     salaires dans le journal. Une seule politique, restreinte, est recréée.
--  4. seed_default_expense_categories n'est plus appelable par un utilisateur
--     connecté (il pouvait écrire dans n'importe quelle organisation).
--  5. Le caissier ne peut enregistrer que des dépenses en espèces payées avec la
--     caisse (imposé dans la base, pas seulement dans l'interface).
--  6. Seul le propriétaire modifie les catégories (un gérant pouvait changer
--     counts_in_result et falsifier le résultat).
--  7. Le caissier ne voit que les catégories qui lui sont autorisées.
--  8. Fonction get_daily_cash_summary : caisse attendue exacte pour tout membre
--     autorisé (la vue seule ne montrerait au caissier que SES dépenses).
--  9. Le contrôle "journée clôturée" est isolé dans une fonction : si la table
--     cash_closings ne correspond pas, la migration échoue tout de suite avec un
--     message clair au lieu d'échouer plus tard en silence.
-- Idempotente. Aucune donnée n'est supprimée.
-- =============================================================================

-- 0. FONCTIONS UTILITAIRES
CREATE OR REPLACE FUNCTION public.local_today()
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT (now() AT TIME ZONE 'Africa/Brazzaville')::date;
$$;

-- Journée de caisse déjà clôturée ? (échoue à la création si cash_closings ou ses colonnes diffèrent)
CREATE OR REPLACE FUNCTION public.expense_day_is_closed(p_org_id uuid, p_date date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cash_closings
    WHERE organization_id = p_org_id
      AND date = p_date
      AND status = 'CLOSED'
  );
$$;
REVOKE ALL ON FUNCTION public.expense_day_is_closed(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expense_day_is_closed(uuid, date) TO authenticated;

-- 1. PLAFOND DE DÉPENSE DU CAISSIER
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS cashier_expense_limit NUMERIC NOT NULL DEFAULT 10000
  CHECK (cashier_expense_limit >= 0);

-- 2. CATÉGORIES DE DÉPENSES
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  kind             TEXT        NOT NULL CHECK (kind IN ('DAILY', 'FIXED', 'TAX', 'TRANSFER', 'OTHER')),
  counts_in_result BOOLEAN     NOT NULL DEFAULT true,
  owner_only       BOOLEAN     NOT NULL DEFAULT false,
  cashier_allowed  BOOLEAN     NOT NULL DEFAULT false,
  note_required    BOOLEAN     NOT NULL DEFAULT false,
  sort_order       INT         NOT NULL DEFAULT 0,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_categories_unique_name
  ON public.expense_categories (organization_id, public.normalize_catalog_name(name));
CREATE INDEX IF NOT EXISTS idx_expense_categories_org_kind
  ON public.expense_categories (organization_id, kind, is_active);

CREATE OR REPLACE FUNCTION public.expense_categories_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_expense_categories_touch ON public.expense_categories;
CREATE TRIGGER trg_expense_categories_touch
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.expense_categories_touch();

-- 3. CATALOGUE PAR DÉFAUT (réservé au serveur, non appelable depuis l'API publique)
CREATE OR REPLACE FUNCTION public.seed_default_expense_categories(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.expense_categories
    (organization_id, name, kind, counts_in_result, owner_only, cashier_allowed, note_required, sort_order)
  VALUES
    -- DAILY : autorisées au caissier
    (p_org_id, 'Ration journalière des employés',                 'DAILY',    true,  false, true,  false, 10),
    (p_org_id, 'Produits de lavage et d''entretien',              'DAILY',    true,  false, true,  false, 20),
    (p_org_id, 'Carburant (groupe électrogène en cas de coupure)', 'DAILY',   true,  false, true,  false, 30),
    (p_org_id, 'Transport et déplacements',                       'DAILY',    true,  false, true,  false, 40),
    (p_org_id, 'Emballages et fournitures (cintres, sachets)',    'DAILY',    true,  false, true,  false, 50),
    (p_org_id, 'Petites réparations et entretien',                'DAILY',    true,  false, true,  false, 60),
    (p_org_id, 'Eau',                                             'DAILY',    true,  false, true,  false, 70),
    (p_org_id, 'Autres dépenses courantes',                       'DAILY',    true,  false, true,  true,  80),
    -- FIXED : charges fixes
    (p_org_id, 'Loyer',                                           'FIXED',    true,  false, false, false, 110),
    (p_org_id, 'Salaires',                                        'FIXED',    true,  true,  false, false, 120),
    (p_org_id, 'Électricité',                                     'FIXED',    true,  false, false, false, 130),
    (p_org_id, 'Téléphone et internet',                           'FIXED',    true,  false, false, false, 140),
    -- TAX : impôts et taxes
    (p_org_id, 'Patente',                                         'TAX',      true,  false, false, false, 210),
    (p_org_id, 'Contrat de bail (frais d''enregistrement)',       'TAX',      true,  false, false, false, 220),
    (p_org_id, 'Taxes de la mairie',                              'TAX',      true,  false, false, false, 230),
    (p_org_id, 'Autres impôts et taxes',                          'TAX',      true,  false, false, false, 240),
    -- TRANSFER : mouvements de trésorerie, hors résultat
    (p_org_id, 'Retrait du propriétaire',                         'TRANSFER', false, true,  false, false, 310),
    (p_org_id, 'Versement en banque ou Mobile Money',             'TRANSFER', false, false, false, false, 320),
    -- OTHER
    (p_org_id, 'Autres charges',                                  'OTHER',    true,  false, false, true,  410)
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_default_expense_categories(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_default_expense_categories(uuid) TO service_role;

DO $$
DECLARE
  v_org record;
BEGIN
  FOR v_org IN SELECT id FROM public.organizations LOOP
    PERFORM public.seed_default_expense_categories(v_org.id);
  END LOOP;
END $$;

-- 4. REGISTRE DES DÉPENSES
CREATE TABLE IF NOT EXISTS public.expenses (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category_id     UUID        NOT NULL REFERENCES public.expense_categories(id) ON DELETE RESTRICT,
  amount          NUMERIC     NOT NULL CHECK (amount > 0 AND amount = trunc(amount) AND amount <= 100000000),
  expense_date    DATE        NOT NULL,
  method          TEXT        NOT NULL CHECK (method IN ('CASH', 'MTN_MOMO', 'AIRTEL_MONEY', 'BANK', 'OTHER')),
  from_till       BOOLEAN     NOT NULL DEFAULT false,
  payee           TEXT        CHECK (payee IS NULL OR char_length(payee) <= 100),
  reference       TEXT        CHECK (reference IS NULL OR char_length(reference) <= 100),
  note            TEXT        CHECK (note IS NULL OR char_length(note) <= 300),
  period_start    DATE,
  period_end      DATE,
  created_by      UUID,       -- pas de clé étrangère : le journal doit survivre à la suppression d'un utilisateur
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  voided_at       TIMESTAMPTZ,
  voided_by       UUID,
  void_reason     TEXT,
  CONSTRAINT chk_expense_till_method CHECK (from_till = false OR method = 'CASH'),
  CONSTRAINT chk_expense_period CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start),
  CONSTRAINT chk_expense_void CHECK (voided_at IS NULL OR (void_reason IS NOT NULL AND char_length(trim(void_reason)) >= 5))
);

CREATE INDEX IF NOT EXISTS idx_expenses_org_date ON public.expenses (organization_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses (category_id);

-- 5. IMMUABILITÉ : seule l'annulation avec motif est possible
CREATE OR REPLACE FUNCTION public.prevent_expense_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'Le registre des dépenses ne peut pas être vidé.' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Une dépense ne peut pas être supprimée : elle s''annule avec un motif.' USING ERRCODE = '42501';
  END IF;

  -- UPDATE
  IF OLD.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Une dépense déjà annulée ne peut plus être modifiée.' USING ERRCODE = '42501';
  END IF;

  IF NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.category_id IS DISTINCT FROM OLD.category_id
     OR NEW.expense_date IS DISTINCT FROM OLD.expense_date
     OR NEW.method IS DISTINCT FROM OLD.method
     OR NEW.from_till IS DISTINCT FROM OLD.from_till
     OR NEW.payee IS DISTINCT FROM OLD.payee
     OR NEW.reference IS DISTINCT FROM OLD.reference
     OR NEW.note IS DISTINCT FROM OLD.note
     OR NEW.period_start IS DISTINCT FROM OLD.period_start
     OR NEW.period_end IS DISTINCT FROM OLD.period_end
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Les informations d''une dépense enregistrée sont immuables : seule l''annulation avec motif est autorisée.' USING ERRCODE = '42501';
  END IF;

  IF NEW.voided_at IS NULL OR NEW.voided_by IS NULL THEN
    RAISE EXCEPTION 'Une modification de dépense doit être une annulation (date, auteur et motif).' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_expense_mutation ON public.expenses;
CREATE TRIGGER trg_prevent_expense_mutation
  BEFORE UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.prevent_expense_mutation();

DROP TRIGGER IF EXISTS trg_prevent_expense_truncate ON public.expenses;
CREATE TRIGGER trg_prevent_expense_truncate
  BEFORE TRUNCATE ON public.expenses
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_expense_mutation();

-- 6. ENREGISTRER UNE DÉPENSE (seule voie d'écriture)
CREATE OR REPLACE FUNCTION public.record_expense(
  p_org_id        uuid,
  p_category_id   uuid,
  p_amount        numeric,
  p_expense_date  date,
  p_method        text,
  p_from_till     boolean,
  p_payee         text DEFAULT NULL,
  p_reference     text DEFAULT NULL,
  p_note          text DEFAULT NULL,
  p_period_start  date DEFAULT NULL,
  p_period_end    date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_role       text;
  v_cat        record;
  v_limit      numeric;
  v_from_till  boolean := COALESCE(p_from_till, false);
  v_expense_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié.' USING ERRCODE = '42501';
  END IF;

  -- Rôle dans l'organisation (vérifié en premier)
  SELECT role::text INTO v_role
  FROM public.memberships
  WHERE organization_id = p_org_id AND user_id = v_user_id AND is_active = true;

  IF v_role IS NULL OR v_role NOT IN ('OWNER', 'MANAGER', 'CASHIER') THEN
    RAISE EXCEPTION 'Accès refusé.' USING ERRCODE = '42501';
  END IF;

  -- Validation générale
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount <> trunc(p_amount) THEN
    RAISE EXCEPTION 'Le montant doit être un nombre entier positif de FCFA.' USING ERRCODE = '42501';
  END IF;
  IF p_expense_date IS NULL OR p_expense_date > public.local_today() THEN
    RAISE EXCEPTION 'La date de la dépense ne peut pas être dans le futur.' USING ERRCODE = '42501';
  END IF;
  IF p_method IS NULL OR p_method NOT IN ('CASH', 'MTN_MOMO', 'AIRTEL_MONEY', 'BANK', 'OTHER') THEN
    RAISE EXCEPTION 'Mode de paiement invalide.' USING ERRCODE = '42501';
  END IF;
  IF v_from_till AND p_method <> 'CASH' THEN
    RAISE EXCEPTION 'Une dépense payée avec la caisse doit être en espèces.' USING ERRCODE = '42501';
  END IF;

  -- Catégorie
  SELECT id, name, owner_only, cashier_allowed, note_required, is_active
  INTO v_cat
  FROM public.expense_categories
  WHERE id = p_category_id AND organization_id = p_org_id;

  IF v_cat.id IS NULL OR NOT v_cat.is_active THEN
    RAISE EXCEPTION 'Catégorie de dépense invalide ou inactive.' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'MANAGER' AND v_cat.owner_only THEN
    RAISE EXCEPTION 'La catégorie « % » est réservée au propriétaire.', v_cat.name USING ERRCODE = '42501';
  END IF;

  IF v_role = 'CASHIER' THEN
    IF NOT v_cat.cashier_allowed THEN
      RAISE EXCEPTION 'La catégorie « % » n''est pas autorisée pour un caissier.', v_cat.name USING ERRCODE = '42501';
    END IF;
    -- Un caissier ne dépense que les espèces de la caisse
    IF p_method <> 'CASH' OR NOT v_from_till THEN
      RAISE EXCEPTION 'Un caissier enregistre uniquement des dépenses en espèces payées avec la caisse.' USING ERRCODE = '42501';
    END IF;
    SELECT cashier_expense_limit INTO v_limit FROM public.organizations WHERE id = p_org_id;
    IF p_amount > v_limit THEN
      RAISE EXCEPTION 'Montant supérieur à votre plafond (% FCFA) : demandez au gérant.', v_limit USING ERRCODE = '42501';
    END IF;
    IF p_expense_date < public.local_today() - 1 THEN
      RAISE EXCEPTION 'Un caissier ne peut enregistrer que les dépenses d''aujourd''hui ou d''hier.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_cat.note_required AND (p_note IS NULL OR char_length(trim(p_note)) < 5) THEN
    RAISE EXCEPTION 'Une note explicative (au moins 5 caractères) est obligatoire pour cette catégorie.' USING ERRCODE = '42501';
  END IF;

  -- Dépense prise sur la caisse : refusée si la journée est clôturée
  IF v_from_till AND public.expense_day_is_closed(p_org_id, p_expense_date) THEN
    RAISE EXCEPTION 'La caisse de cette journée est déjà clôturée.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.expenses (
    organization_id, category_id, amount, expense_date, method, from_till,
    payee, reference, note, period_start, period_end, created_by
  ) VALUES (
    p_org_id, p_category_id, p_amount, p_expense_date, p_method, v_from_till,
    NULLIF(trim(p_payee), ''), NULLIF(trim(p_reference), ''), NULLIF(trim(p_note), ''),
    p_period_start, p_period_end, v_user_id
  )
  RETURNING id INTO v_expense_id;

  RETURN v_expense_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_expense(uuid, uuid, numeric, date, text, boolean, text, text, text, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_expense(uuid, uuid, numeric, date, text, boolean, text, text, text, date, date) TO authenticated;

-- 7. ANNULER UNE DÉPENSE (motif obligatoire)
CREATE OR REPLACE FUNCTION public.void_expense(p_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_exp     record;
  v_role    text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié.' USING ERRCODE = '42501';
  END IF;

  SELECT e.id, e.organization_id, e.from_till, e.expense_date, e.voided_at, c.owner_only
  INTO v_exp
  FROM public.expenses e
  JOIN public.expense_categories c ON c.id = e.category_id
  WHERE e.id = p_id;

  IF v_exp.id IS NOT NULL THEN
    SELECT role::text INTO v_role
    FROM public.memberships
    WHERE organization_id = v_exp.organization_id AND user_id = v_user_id AND is_active = true;
  END IF;

  -- Dépense inconnue, autre organisation ou rôle insuffisant : même réponse
  IF v_exp.id IS NULL OR v_role IS NULL OR v_role NOT IN ('OWNER', 'MANAGER')
     OR (v_role = 'MANAGER' AND v_exp.owner_only) THEN
    RAISE EXCEPTION 'Accès refusé.' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR char_length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Un motif d''annulation (au moins 5 caractères) est obligatoire.' USING ERRCODE = '42501';
  END IF;

  IF v_exp.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cette dépense est déjà annulée.' USING ERRCODE = '42501';
  END IF;

  IF v_exp.from_till AND public.expense_day_is_closed(v_exp.organization_id, v_exp.expense_date) THEN
    RAISE EXCEPTION 'La caisse de cette journée est clôturée : la dépense ne peut plus être annulée.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.expenses
  SET voided_at = NOW(), voided_by = v_user_id, void_reason = trim(p_reason)
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.void_expense(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_expense(uuid, text) TO authenticated;

-- 8. DROITS ET LECTURE (RLS)
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.expense_categories FROM anon, PUBLIC;
REVOKE ALL ON public.expenses FROM anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.expenses FROM authenticated;
GRANT SELECT ON public.expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;

-- Catégories : lecture selon le rôle ; écriture réservée au propriétaire
DROP POLICY IF EXISTS "expense_categories_select" ON public.expense_categories;
CREATE POLICY "expense_categories_select"
  ON public.expense_categories FOR SELECT
  TO authenticated
  USING (
    public.catalog_has_role(organization_id, ARRAY['OWNER'])
    OR (public.catalog_has_role(organization_id, ARRAY['MANAGER']) AND NOT owner_only)
    OR (public.catalog_has_role(organization_id, ARRAY['CASHIER']) AND cashier_allowed)
  );

DROP POLICY IF EXISTS "expense_categories_write" ON public.expense_categories;
CREATE POLICY "expense_categories_write"
  ON public.expense_categories FOR ALL
  TO authenticated
  USING (public.catalog_has_role(organization_id, ARRAY['OWNER']))
  WITH CHECK (public.catalog_has_role(organization_id, ARRAY['OWNER']));

-- Dépenses : propriétaire = tout ; gérant = sauf catégories réservées ; caissier = les siennes (2 derniers jours)
DROP POLICY IF EXISTS "expenses_select" ON public.expenses;
CREATE POLICY "expenses_select"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (
    public.catalog_has_role(organization_id, ARRAY['OWNER'])
    OR (
      public.catalog_has_role(organization_id, ARRAY['MANAGER'])
      AND EXISTS (
        SELECT 1 FROM public.expense_categories c
        WHERE c.id = expenses.category_id AND c.owner_only = false
      )
    )
    OR (
      public.catalog_has_role(organization_id, ARRAY['CASHIER'])
      AND created_by = auth.uid()
      AND expense_date >= public.local_today() - 1
    )
  );

-- 9. JOURNAL D'AUDIT SUR LES DÉPENSES
DROP TRIGGER IF EXISTS trg_audit_expenses ON public.expenses;
CREATE TRIGGER trg_audit_expenses
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generic_audit_log();

DROP TRIGGER IF EXISTS trg_audit_expense_categories ON public.expense_categories;
CREATE TRIGGER trg_audit_expense_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generic_audit_log();

-- Lit une dépense en ignorant la RLS (nécessaire : un gérant ne voit pas les dépenses réservées)
CREATE OR REPLACE FUNCTION public.expense_is_owner_only(p_expense_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT c.owner_only
     FROM public.expenses e
     JOIN public.expense_categories c ON c.id = e.category_id
     WHERE e.id = p_expense_id),
    false);
$$;
REVOKE ALL ON FUNCTION public.expense_is_owner_only(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expense_is_owner_only(uuid) TO authenticated;

-- UNE SEULE politique de lecture du journal (remplace l'ancienne audit_logs_select ET
-- la politique audit_logs_owner_manager_select que Jules tentait de remplacer)
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_owner_manager_select" ON public.audit_logs;
CREATE POLICY "audit_logs_select"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND public.catalog_has_role(organization_id, ARRAY['OWNER', 'MANAGER'])
    AND (
      -- le propriétaire voit tout
      public.catalog_has_role(organization_id, ARRAY['OWNER'])
      -- le gérant : tout sauf coûts internes, catégories de dépenses et dépenses réservées
      OR table_name NOT IN ('service_costs', 'expenses', 'expense_categories')
      OR (table_name = 'expenses' AND NOT public.expense_is_owner_only(object_id))
    )
  );

-- 10. CAISSE ATTENDUE : espèces encaissées - dépenses payées avec la caisse
CREATE OR REPLACE VIEW public.v_daily_cash_summary
WITH (security_invoker = true)
AS
WITH pay AS (
  SELECT p.organization_id,
         (p.collected_at AT TIME ZONE 'Africa/Brazzaville')::date AS d,
         SUM(CASE WHEN p.is_reversal THEN -abs(p.amount) ELSE abs(p.amount) END) AS collected
  FROM public.payments p
  WHERE p.method = 'CASH'
  GROUP BY p.organization_id, (p.collected_at AT TIME ZONE 'Africa/Brazzaville')::date
),
exp AS (
  SELECT e.organization_id, e.expense_date AS d, SUM(e.amount) AS spent
  FROM public.expenses e
  WHERE e.method = 'CASH' AND e.from_till = true AND e.voided_at IS NULL
  GROUP BY e.organization_id, e.expense_date
)
SELECT
  COALESCE(pay.organization_id, exp.organization_id) AS organization_id,
  COALESCE(pay.d, exp.d)                              AS date,
  COALESCE(pay.collected, 0)                          AS total_cash_collected,
  COALESCE(exp.spent, 0)                              AS total_cash_expenses,
  COALESCE(pay.collected, 0) - COALESCE(exp.spent, 0) AS expected_cash_balance
FROM pay
FULL OUTER JOIN exp ON exp.organization_id = pay.organization_id AND exp.d = pay.d;

GRANT SELECT ON public.v_daily_cash_summary TO authenticated;
REVOKE ALL ON public.v_daily_cash_summary FROM anon;

-- Version fiable pour la clôture : totaux exacts pour tout membre autorisé
-- (la vue ci-dessus ne montrerait au caissier que SES dépenses)
CREATE OR REPLACE FUNCTION public.get_daily_cash_summary(p_org_id uuid, p_date date)
RETURNS TABLE (total_cash_collected numeric, total_cash_expenses numeric, expected_cash_balance numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_collected numeric;
  v_spent     numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.catalog_has_role(p_org_id, ARRAY['OWNER', 'MANAGER', 'CASHIER']) THEN
    RAISE EXCEPTION 'Accès refusé.' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(CASE WHEN p.is_reversal THEN -abs(p.amount) ELSE abs(p.amount) END), 0)
  INTO v_collected
  FROM public.payments p
  WHERE p.organization_id = p_org_id
    AND p.method = 'CASH'
    AND (p.collected_at AT TIME ZONE 'Africa/Brazzaville')::date = p_date;

  SELECT COALESCE(SUM(e.amount), 0)
  INTO v_spent
  FROM public.expenses e
  WHERE e.organization_id = p_org_id
    AND e.expense_date = p_date
    AND e.method = 'CASH' AND e.from_till = true AND e.voided_at IS NULL;

  RETURN QUERY SELECT v_collected, v_spent, v_collected - v_spent;
END;
$$;

REVOKE ALL ON FUNCTION public.get_daily_cash_summary(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_daily_cash_summary(uuid, date) TO authenticated;

-- 11. VÉRIFICATION (s'affiche à la fin) :
--     categories = 19 (par pressing) ; politiques_audit = 1 ; fonctions = 8 ; vue_caisse = true
SELECT
  (SELECT count(*) FROM public.expense_categories) AS categories,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'audit_logs') AS politiques_audit,
  (SELECT count(*) FROM pg_proc WHERE proname IN (
     'record_expense', 'void_expense', 'get_daily_cash_summary', 'expense_day_is_closed',
     'expense_is_owner_only', 'local_today', 'seed_default_expense_categories', 'prevent_expense_mutation'
   )) AS fonctions,
  (to_regclass('public.v_daily_cash_summary') IS NOT NULL) AS vue_caisse;
