-- =============================================================================
-- MIGRATION 20261009000000: CATALOGUE NORMALISÉ (TÂCHE 2.10)
-- Catégories, types de vêtements (articles) et traitements normalisés
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

-- 1. FONCTION IMMUABLE DE NORMALISATION DU TEXTE
CREATE OR REPLACE FUNCTION public.normalize_catalog_name(p_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  v_str text;
BEGIN
  v_str := lower(trim(p_text));
  v_str := translate(
    v_str,
    'àáâãäåàáâãäåèéêëèéêëìíîïìíîïòóôõöøòóôõöøùúûüùúûüýÿñç',
    'aaaaaaaaaaaaeeeeeeeeiiiiiiiioooooooooooouuuuuuuuync'
  );
  v_str := regexp_replace(v_str, '\s+', ' ', 'g');
  RETURN v_str;
END;
$$;

-- 2. TABLE SERVICE_CATEGORIES
CREATE TABLE IF NOT EXISTS public.service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_categories_org_norm_name
  ON public.service_categories (organization_id, public.normalize_catalog_name(name));

-- 3. TABLE GARMENT_TYPES (Catalogue d'articles)
CREATE TABLE IF NOT EXISTS public.garment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_garment_types_org_norm_name
  ON public.garment_types (organization_id, public.normalize_catalog_name(name));

-- 4. EVOLUTION DE LA TABLE SERVICES
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS garment_type_id UUID REFERENCES public.garment_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS treatment VARCHAR(30),
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false;

-- Contrainte CHECK sur le traitement
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_services_treatment'
  ) THEN
    ALTER TABLE public.services
      ADD CONSTRAINT chk_services_treatment
      CHECK (treatment IS NULL OR treatment IN ('WASH', 'IRON', 'WASH_IRON', 'DRY_CLEAN', 'STAIN_REMOVAL'));
  END IF;
END $$;

-- Unicité (organization_id, garment_type_id, treatment)
CREATE UNIQUE INDEX IF NOT EXISTS idx_services_org_garment_treatment
  ON public.services (organization_id, garment_type_id, treatment)
  WHERE garment_type_id IS NOT NULL AND treatment IS NOT NULL;


-- 5. FONCTION SEED_DEFAULT_CATALOG(organization_id)
CREATE OR REPLACE FUNCTION public.seed_default_catalog(p_org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cat_vetement UUID;
  v_cat_ceremonie UUID;
  v_cat_maison UUID;
  v_cat_pro UUID;
  v_cat_autres UUID;
BEGIN
  -- Catégorie 1: Vêtements
  INSERT INTO public.service_categories (organization_id, name, sort_order, is_active)
  VALUES (p_org_id, 'Vêtements', 1, true)
  ON CONFLICT (organization_id, public.normalize_catalog_name(name))
  DO UPDATE SET is_active = true
  RETURNING id INTO v_cat_vetement;

  IF v_cat_vetement IS NULL THEN
    SELECT id INTO v_cat_vetement FROM public.service_categories
    WHERE organization_id = p_org_id AND public.normalize_catalog_name(name) = public.normalize_catalog_name('Vêtements');
  END IF;

  INSERT INTO public.garment_types (organization_id, category_id, name, is_active)
  VALUES
    (p_org_id, v_cat_vetement, 'Chemise', true),
    (p_org_id, v_cat_vetement, 'T-shirt / polo', true),
    (p_org_id, v_cat_vetement, 'Pantalon', true),
    (p_org_id, v_cat_vetement, 'Jean', true),
    (p_org_id, v_cat_vetement, 'Robe', true),
    (p_org_id, v_cat_vetement, 'Jupe', true),
    (p_org_id, v_cat_vetement, 'Veste', true),
    (p_org_id, v_cat_vetement, 'Manteau', true),
    (p_org_id, v_cat_vetement, 'Boubou', true),
    (p_org_id, v_cat_vetement, 'Pagne', true),
    (p_org_id, v_cat_vetement, 'Tenue traditionnelle', true)
  ON CONFLICT (organization_id, public.normalize_catalog_name(name)) DO NOTHING;

  -- Catégorie 2: Costumes et cérémonie
  INSERT INTO public.service_categories (organization_id, name, sort_order, is_active)
  VALUES (p_org_id, 'Costumes et cérémonie', 2, true)
  ON CONFLICT (organization_id, public.normalize_catalog_name(name))
  DO UPDATE SET is_active = true
  RETURNING id INTO v_cat_ceremonie;

  IF v_cat_ceremonie IS NULL THEN
    SELECT id INTO v_cat_ceremonie FROM public.service_categories
    WHERE organization_id = p_org_id AND public.normalize_catalog_name(name) = public.normalize_catalog_name('Costumes et cérémonie');
  END IF;

  INSERT INTO public.garment_types (organization_id, category_id, name, is_active)
  VALUES
    (p_org_id, v_cat_ceremonie, 'Costume 2 pièces', true),
    (p_org_id, v_cat_ceremonie, 'Costume 3 pièces', true),
    (p_org_id, v_cat_ceremonie, 'Robe de soirée', true),
    (p_org_id, v_cat_ceremonie, 'Robe de mariée', true)
  ON CONFLICT (organization_id, public.normalize_catalog_name(name)) DO NOTHING;

  -- Catégorie 3: Linge de maison
  INSERT INTO public.service_categories (organization_id, name, sort_order, is_active)
  VALUES (p_org_id, 'Linge de maison', 3, true)
  ON CONFLICT (organization_id, public.normalize_catalog_name(name))
  DO UPDATE SET is_active = true
  RETURNING id INTO v_cat_maison;

  IF v_cat_maison IS NULL THEN
    SELECT id INTO v_cat_maison FROM public.service_categories
    WHERE organization_id = p_org_id AND public.normalize_catalog_name(name) = public.normalize_catalog_name('Linge de maison');
  END IF;

  INSERT INTO public.garment_types (organization_id, category_id, name, is_active)
  VALUES
    (p_org_id, v_cat_maison, 'Drap', true),
    (p_org_id, v_cat_maison, 'Housse de couette', true),
    (p_org_id, v_cat_maison, 'Couette', true),
    (p_org_id, v_cat_maison, 'Couverture', true),
    (p_org_id, v_cat_maison, 'Rideau', true),
    (p_org_id, v_cat_maison, 'Serviette', true),
    (p_org_id, v_cat_maison, 'Nappe', true),
    (p_org_id, v_cat_maison, 'Petit tapis', true)
  ON CONFLICT (organization_id, public.normalize_catalog_name(name)) DO NOTHING;

  -- Catégorie 4: Professionnel et uniformes
  INSERT INTO public.service_categories (organization_id, name, sort_order, is_active)
  VALUES (p_org_id, 'Professionnel et uniformes', 4, true)
  ON CONFLICT (organization_id, public.normalize_catalog_name(name))
  DO UPDATE SET is_active = true
  RETURNING id INTO v_cat_pro;

  IF v_cat_pro IS NULL THEN
    SELECT id INTO v_cat_pro FROM public.service_categories
    WHERE organization_id = p_org_id AND public.normalize_catalog_name(name) = public.normalize_catalog_name('Professionnel et uniformes');
  END IF;

  INSERT INTO public.garment_types (organization_id, category_id, name, is_active)
  VALUES
    (p_org_id, v_cat_pro, 'Uniforme', true),
    (p_org_id, v_cat_pro, 'Blouse', true),
    (p_org_id, v_cat_pro, 'Tablier', true)
  ON CONFLICT (organization_id, public.normalize_catalog_name(name)) DO NOTHING;

  -- Catégorie 5: Autres
  INSERT INTO public.service_categories (organization_id, name, sort_order, is_active)
  VALUES (p_org_id, 'Autres', 5, true)
  ON CONFLICT (organization_id, public.normalize_catalog_name(name))
  DO UPDATE SET is_active = true
  RETURNING id INTO v_cat_autres;

  IF v_cat_autres IS NULL THEN
    SELECT id INTO v_cat_autres FROM public.service_categories
    WHERE organization_id = p_org_id AND public.normalize_catalog_name(name) = public.normalize_catalog_name('Autres');
  END IF;

  INSERT INTO public.garment_types (organization_id, category_id, name, is_active)
  VALUES
    (p_org_id, v_cat_autres, 'Autre article', true)
  ON CONFLICT (organization_id, public.normalize_catalog_name(name)) DO NOTHING;

END;
$$;


-- 6. MIGRATION ET RAPPROCHEMENT DES SERVICES EXISTANTS SANS PERTE
DO $$
DECLARE
  v_org RECORD;
  v_service RECORD;
  v_garment RECORD;
  v_treatment VARCHAR(30);
  v_norm_service_name TEXT;
  v_matched BOOLEAN;
BEGIN
  -- Seed du catalogue par défaut pour chaque organisation existante
  FOR v_org IN SELECT id FROM public.organizations LOOP
    PERFORM public.seed_default_catalog(v_org.id);
  END LOOP;

  -- Migration des catégories existantes si non répertoriées
  FOR v_service IN
    SELECT DISTINCT organization_id, category FROM public.services WHERE category IS NOT NULL AND category <> ''
  LOOP
    INSERT INTO public.service_categories (organization_id, name, sort_order)
    VALUES (v_service.organization_id, v_service.category, 10)
    ON CONFLICT (organization_id, public.normalize_catalog_name(name)) DO NOTHING;
  END LOOP;

  -- Rattachement des services à leur category_id
  UPDATE public.services s
  SET category_id = sc.id
  FROM public.service_categories sc
  WHERE sc.organization_id = s.organization_id
    AND public.normalize_catalog_name(sc.name) = public.normalize_catalog_name(COALESCE(s.category, 'Vêtements'))
    AND s.category_id IS NULL;

  -- Rapprochement des articles (garment_types) et traitements
  FOR v_service IN
    SELECT id, organization_id, category_id, name FROM public.services WHERE garment_type_id IS NULL OR treatment IS NULL
  LOOP
    v_norm_service_name := public.normalize_catalog_name(v_service.name);
    v_matched := false;
    v_treatment := NULL;

    -- Détection du traitement depuis le nom
    IF v_norm_service_name LIKE '%lavage%' AND v_norm_service_name LIKE '%repassage%' THEN
      v_treatment := 'WASH_IRON';
    ELSIF v_norm_service_name LIKE '%lavage%' THEN
      v_treatment := 'WASH';
    ELSIF v_norm_service_name LIKE '%repassage%' THEN
      v_treatment := 'IRON';
    ELSIF v_norm_service_name LIKE '%nettoyage a sec%' OR v_norm_service_name LIKE '%pressage%' THEN
      v_treatment := 'DRY_CLEAN';
    ELSIF v_norm_service_name LIKE '%detachage%' THEN
      v_treatment := 'STAIN_REMOVAL';
    ELSE
      v_treatment := 'WASH_IRON'; -- Traitement par défaut
    END IF;

    -- Recherche de l'article dans la catégorie/organisation
    FOR v_garment IN
      SELECT gt.id, gt.name
      FROM public.garment_types gt
      WHERE gt.organization_id = v_service.organization_id
      ORDER BY length(gt.name) DESC
    LOOP
      IF v_norm_service_name LIKE '%' || public.normalize_catalog_name(v_garment.name) || '%' THEN
        -- Vérification d'absence de collision avec une autre prestation de la même organisation
        IF NOT EXISTS (
          SELECT 1 FROM public.services
          WHERE organization_id = v_service.organization_id
            AND garment_type_id = v_garment.id
            AND treatment = v_treatment
            AND id <> v_service.id
        ) THEN
          UPDATE public.services
          SET garment_type_id = v_garment.id,
              treatment = v_treatment,
              needs_review = false
          WHERE id = v_service.id;
          v_matched := true;
        END IF;
        -- En cas de match sur l'article le plus spécifique, stopper la recherche
        -- (Si collision, la prestation n'est pas mise à jour et restera marquée needs_review = true)
        EXIT;
      END IF;
    END LOOP;

    -- Si non rapproché, marquer needs_review = true
    IF NOT v_matched THEN
      UPDATE public.services
      SET needs_review = true
      WHERE id = v_service.id;
    END IF;
  END LOOP;
END $$;


-- 7. ACTIVATION ET STRATÉGIES RLS
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garment_types ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour service_categories
DROP POLICY IF EXISTS "service_categories_read_member" ON public.service_categories;
CREATE POLICY "service_categories_read_member"
  ON public.service_categories FOR SELECT
  USING (organization_id = auth.get_user_org_id());

DROP POLICY IF EXISTS "service_categories_read_public" ON public.service_categories;
CREATE POLICY "service_categories_read_public"
  ON public.service_categories FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "service_categories_owner_manager_write" ON public.service_categories;
CREATE POLICY "service_categories_owner_manager_write"
  ON public.service_categories FOR ALL
  USING (
    organization_id = auth.get_user_org_id()
    AND auth.has_role_in_org(organization_id, 'OWNER', 'MANAGER')
  )
  WITH CHECK (
    organization_id = auth.get_user_org_id()
    AND auth.has_role_in_org(organization_id, 'OWNER', 'MANAGER')
  );

-- Politiques RLS pour garment_types
DROP POLICY IF EXISTS "garment_types_read_member" ON public.garment_types;
CREATE POLICY "garment_types_read_member"
  ON public.garment_types FOR SELECT
  USING (organization_id = auth.get_user_org_id());

DROP POLICY IF EXISTS "garment_types_read_public" ON public.garment_types;
CREATE POLICY "garment_types_read_public"
  ON public.garment_types FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "garment_types_owner_manager_write" ON public.garment_types;
CREATE POLICY "garment_types_owner_manager_write"
  ON public.garment_types FOR ALL
  USING (
    organization_id = auth.get_user_org_id()
    AND auth.has_role_in_org(organization_id, 'OWNER', 'MANAGER')
  )
  WITH CHECK (
    organization_id = auth.get_user_org_id()
    AND auth.has_role_in_org(organization_id, 'OWNER', 'MANAGER')
  );

-- 8. GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_categories TO authenticated;
GRANT SELECT ON public.service_categories TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.garment_types TO authenticated;
GRANT SELECT ON public.garment_types TO anon;
