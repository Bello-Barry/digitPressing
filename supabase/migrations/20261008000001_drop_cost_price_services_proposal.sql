-- =============================================================================
-- MIGRATION 20261008000001 (PROPOSITION DE SUPPRESSION DE COLONNE)
-- Supprime la colonne cost_price obsolète de la table services.
-- Ne doit être appliquée qu'après vérification complète de la migration 3.9.
-- =============================================================================

-- ALTER TABLE services DROP COLUMN IF EXISTS cost_price;
