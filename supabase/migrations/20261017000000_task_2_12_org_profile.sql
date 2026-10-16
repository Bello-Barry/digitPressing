-- =============================================================================
-- MIGRATION TASK 2.12 : CHAMPS DU PROFIL DU PRESSING (ORGANIZATION PROFILE)
-- Fichier additif et idempotent. Ne pas exécuter directement.
-- =============================================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS niu VARCHAR(50),
  ADD COLUMN IF NOT EXISTS rccm VARCHAR(50);

COMMENT ON COLUMN public.organizations.niu IS 'Numéro d''Identifiant Unique fiscal';
COMMENT ON COLUMN public.organizations.rccm IS 'Registre du Commerce et du Crédit Mobilier';
