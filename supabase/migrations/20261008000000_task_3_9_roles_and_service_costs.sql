-- =============================================================================
-- MIGRATION 20261009000001 (VERSION CORRIGÉE) : DROITS PAR RÔLE & COÛTS INTERNES
-- Tâche 3.9. À appliquer APRÈS la migration du catalogue (20261009000000), car
-- elle réutilise ses fonctions catalog_is_member() et catalog_has_role().
--
-- Corrections par rapport à la version de Jules :
--  1. Fonctions inexistantes auth.get_user_org_id() / auth.has_role_in_org() remplacées.
--  2. L'ancienne politique "services_write" (tout membre peut écrire) est SUPPRIMÉE :
--     sinon elle reste active (les politiques s'additionnent) et un caissier pourrait
--     toujours modifier les prix.
--  3. Politique de lecture des membres ajoutée (services inactifs visibles du personnel).
--  4. cost_price de services : plus jamais stocké (trigger), en plus de la mise à NULL.
--  5. Aucun accès anonyme à service_costs.
-- Idempotente : peut être relancée sans erreur ni doublon.
-- =============================================================================

-- 1. TABLE DES COÛTS INTERNES
CREATE TABLE IF NOT EXISTS public.service_costs (
  service_id UUID PRIMARY KEY REFERENCES public.services(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cost_price DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_service_costs_org_id ON public.service_costs(organization_id);

-- 2. RLS : LES COÛTS NE SONT LISIBLES ET MODIFIABLES QUE PAR LE PROPRIÉTAIRE
ALTER TABLE public.service_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_costs_owner_only" ON public.service_costs;
CREATE POLICY "service_costs_owner_only"
  ON public.service_costs FOR ALL
  USING (public.catalog_has_role(organization_id, ARRAY['OWNER']))
  WITH CHECK (public.catalog_has_role(organization_id, ARRAY['OWNER']));

REVOKE ALL ON public.service_costs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_costs TO authenticated;

-- 3. COPIE DES COÛTS EXISTANTS (sans perte) PUIS NEUTRALISATION DANS services
INSERT INTO public.service_costs (service_id, organization_id, cost_price, updated_at)
SELECT id, organization_id, cost_price, NOW()
FROM public.services
WHERE cost_price IS NOT NULL
ON CONFLICT (service_id)
DO UPDATE SET cost_price = EXCLUDED.cost_price, updated_at = NOW();

-- Au cas où la colonne serait NOT NULL (sans effet si elle est déjà facultative)
ALTER TABLE public.services ALTER COLUMN cost_price DROP NOT NULL;

UPDATE public.services
SET cost_price = NULL
WHERE cost_price IS NOT NULL;

-- 4. DROITS D'ÉCRITURE SUR LE CATALOGUE : OWNER ET MANAGER SEULEMENT
-- Suppression de l'ancienne politique trop large (tout membre pouvait modifier les prix)
DROP POLICY IF EXISTS "services_write" ON public.services;

DROP POLICY IF EXISTS "services_owner_manager_write" ON public.services;
CREATE POLICY "services_owner_manager_write"
  ON public.services FOR ALL
  USING (public.catalog_has_role(organization_id, ARRAY['OWNER', 'MANAGER']))
  WITH CHECK (public.catalog_has_role(organization_id, ARRAY['OWNER', 'MANAGER']));

-- Le personnel (tous rôles) peut LIRE les services de son pressing, y compris inactifs
DROP POLICY IF EXISTS "services_read_member" ON public.services;
CREATE POLICY "services_read_member"
  ON public.services FOR SELECT
  USING (public.catalog_is_member(organization_id));

-- 5. cost_price NE DOIT PLUS JAMAIS ÊTRE STOCKÉ DANS services (lisible publiquement)
CREATE OR REPLACE FUNCTION public.services_block_cost_price()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.cost_price := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_services_block_cost_price ON public.services;
CREATE TRIGGER trg_services_block_cost_price
  BEFORE INSERT OR UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.services_block_cost_price();

-- 6. VÉRIFICATION (s'affiche à la fin) : l'ancienne politique services_write doit avoir disparu
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('services', 'service_costs')
ORDER BY tablename, policyname;
