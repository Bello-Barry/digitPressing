-- =============================================================================
-- SEED DATA: LB PRESSING (PREMIER CLIENT MODEL SAAS)
-- =============================================================================

DO $$
DECLARE
  v_lb_org_id UUID := '11111111-1111-1111-1111-111111111111';
BEGIN

  -- 1. INSERT LB PRESSING ORGANIZATION
  INSERT INTO organizations (id, name, slug, country, phone, email, currency, settings)
  VALUES (
    v_lb_org_id,
    'LB Pressing',
    'lb-pressing',
    'CG',
    '+242060000000',
    'contact@lb-pressing.cg',
    'XAF',
    '{
      "currency": "XAF",
      "timezone": "Africa/Brazzaville",
      "taxRate": 0,
      "defaultDiscount": 0,
      "whatsappEnabled": true,
      "businessHours": {
        "monday": {"open": "08:00", "close": "18:00", "closed": false},
        "tuesday": {"open": "08:00", "close": "18:00", "closed": false},
        "wednesday": {"open": "08:00", "close": "18:00", "closed": false},
        "thursday": {"open": "08:00", "close": "18:00", "closed": false},
        "friday": {"open": "08:00", "close": "18:00", "closed": false},
        "saturday": {"open": "08:00", "close": "17:00", "closed": false},
        "sunday": {"open": "08:00", "close": "12:00", "closed": true}
      }
    }'::jsonb
  )
  ON CONFLICT (slug) DO NOTHING;

  -- 2. INSERT DEFAULT SERVICES CATALOG FOR LB PRESSING
  INSERT INTO articles (organization_id, name, category, default_price, estimated_days) VALUES
    (v_lb_org_id, 'Chemise homme', 'vetement', 5000, 2),
    (v_lb_org_id, 'Chemise femme', 'vetement', 5000, 2),
    (v_lb_org_id, 'Pantalon homme', 'vetement', 7000, 2),
    (v_lb_org_id, 'Pantalon femme', 'vetement', 7000, 2),
    (v_lb_org_id, 'Costume 2 pièces', 'vetement', 15000, 3),
    (v_lb_org_id, 'Costume 3 pièces', 'vetement', 18000, 3),
    (v_lb_org_id, 'Robe courte', 'vetement', 8000, 2),
    (v_lb_org_id, 'Robe longue / soirée', 'ceremonie', 15000, 3),
    (v_lb_org_id, 'Robe de mariage', 'ceremonie', 30000, 5),
    (v_lb_org_id, 'Ensemble Bazin', 'traditionnel', 25000, 4),
    (v_lb_org_id, 'Ensemble Pagne', 'traditionnel', 15000, 3),
    (v_lb_org_id, 'Manteau / Veste cuir', 'cuir', 20000, 4),
    (v_lb_org_id, 'Basket / Chaussure ville', 'chaussure', 7000, 2),
    (v_lb_org_id, 'Draps de lit / Couverture', 'maison', 10000, 3),
    (v_lb_org_id, 'Retouche ourlet', 'retouche', 2500, 1)
  ON CONFLICT DO NOTHING;

END $$;
