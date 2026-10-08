-- =============================================================================
-- MIGRATION 20261008000000: DROITS PAR RÔLE & SÉCURISATION DES COÛTS SERVICES
-- Tâche 3.9 : Table service_costs, RLS strictes et migration additive
-- =============================================================================

-- 1. CRÉATION DE LA TABLE SERVICE_COSTS
CREATE TABLE IF NOT EXISTS service_costs (
  service_id UUID PRIMARY KEY REFERENCES services(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cost_price DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index pour accélérer les jointures par organisation
CREATE INDEX IF NOT EXISTS idx_service_costs_org_id ON service_costs(organization_id);

-- 2. ACTIVATION ET CONFIGURATION DES POLITIQUES RLS SUR SERVICE_COSTS
ALTER TABLE service_costs ENABLE ROW LEVEL SECURITY;

-- Seuls les utilisateurs avec le rôle OWNER dans leur organisation peuvent lire/écrire les coûts
DROP POLICY IF EXISTS "service_costs_owner_only" ON service_costs;
CREATE POLICY "service_costs_owner_only"
  ON service_costs FOR ALL
  USING (
    organization_id = auth.get_user_org_id()
    AND auth.has_role_in_org(organization_id, 'OWNER')
  )
  WITH CHECK (
    organization_id = auth.get_user_org_id()
    AND auth.has_role_in_org(organization_id, 'OWNER')
  );

-- 3. MIGRATION ADDITIVE : COPIE DES ANCIENNES VALEURS cost_price PUIS MISE À NULL
INSERT INTO service_costs (service_id, organization_id, cost_price, updated_at)
SELECT id, organization_id, cost_price, NOW()
FROM services
WHERE cost_price IS NOT NULL
ON CONFLICT (service_id)
DO UPDATE SET
  cost_price = EXCLUDED.cost_price,
  updated_at = NOW();

-- Neutralisation de cost_price dans la table services (sans supprimer la colonne)
UPDATE services
SET cost_price = NULL
WHERE cost_price IS NOT NULL;

-- 4. RENFORCEMENT DES POLITIQUES RLS SUR SERVICES
-- Empêcher explicitement CASHIER et DELIVERY de modifier la table services
DROP POLICY IF EXISTS "services_owner_manager_write" ON services;
CREATE POLICY "services_owner_manager_write"
  ON services FOR ALL
  USING (
    organization_id = auth.get_user_org_id()
    AND auth.has_role_in_org(organization_id, 'OWNER', 'MANAGER')
  )
  WITH CHECK (
    organization_id = auth.get_user_org_id()
    AND auth.has_role_in_org(organization_id, 'OWNER', 'MANAGER')
  );

-- 5. GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON service_costs TO authenticated;
