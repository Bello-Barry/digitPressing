-- =============================================================================
-- MIGRATION v2 - digit-pressing (Afrique centrale)
-- Corrections majeures:
-- - GRANT resserrés (plus de GRANT ALL global)
-- - Enum article_category aligné avec les données (sans accents)
-- - Regex téléphone (CG/CD/FR/GB) sur pressings/users/clients
-- - user_preferences.language étendu ('sw','pt')
-- - Soft-delete sur articles & clients (is_deleted)
-- - RLS mis à jour pour filtrer is_deleted
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_crypto";

-- =============================================================================
-- ENUMS
-- =============================================================================

-- user_role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('owner', 'employee');
  END IF;
END$$;

-- invoice_status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE invoice_status AS ENUM ('active', 'cancelled');
  END IF;
END$$;

-- urgency_level
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'urgency_level') THEN
    CREATE TYPE urgency_level AS ENUM ('normal', 'express', 'urgent');
  END IF;
END$$;

-- payment_method
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE payment_method AS ENUM ('cash', 'card', 'check', 'transfer', 'mobile_money');
  END IF;
END$$;

-- article_category (corrigé, sans accents, couvre toutes les catégories utilisées)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'article_category') THEN
    CREATE TYPE article_category AS ENUM (
      'vetement','accessoire','special','cuir','retouche',
      'chaussure','maison','traditionnel','delicat','ceremonie','enfant','uniforme'
    );
  END IF;
END$$;

-- discount_type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discount_type') THEN
    CREATE TYPE discount_type AS ENUM ('amount', 'percentage');
  END IF;
END$$;

-- audit_action
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_action') THEN
    CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete', 'cancel');
  END IF;
END$$;

-- country_code
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'country_code') THEN
    CREATE TYPE country_code AS ENUM ('CG', 'CD', 'FR', 'GB');
  END IF;
END$$;

-- =============================================================================
-- TABLES
-- =============================================================================

-- pressings
CREATE TABLE IF NOT EXISTS pressings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  logo TEXT,
  country country_code DEFAULT 'CG',
  settings JSONB DEFAULT '{
    "currency": "XAF",
    "timezone": "Africa/Brazzaville",
    "taxRate": 0,
    "defaultDiscount": 0,
    "businessHours": {
      "monday": {"open": "08:00", "close": "18:00", "closed": false},
      "tuesday": {"open": "08:00", "close": "18:00", "closed": false},
      "wednesday": {"open": "08:00", "close": "18:00", "closed": false},
      "thursday": {"open": "08:00", "close": "18:00", "closed": false},
      "friday": {"open": "08:00", "close": "18:00", "closed": false},
      "saturday": {"open": "08:00", "close": "17:00", "closed": false},
      "sunday": {"open": "08:00", "close": "12:00", "closed": true}
    },
    "notifications": {
      "emailNotifications": true,
      "pushNotifications": true,
      "smsNotifications": false
    },
    "phoneFormat": "CG"
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT pressing_name_check CHECK (char_length(name) >= 2),
  CONSTRAINT pressing_email_check CHECK (email IS NULL OR email ~* '^[^@]+@[^@]+\.[^@]+$'),
  -- Regex simple: indicatifs 242/243/33/44 (+ optionnel), 6 à 12 chiffres
  CONSTRAINT pressing_phone_check CHECK (
    phone IS NULL OR phone ~* '^\+?(242|243|33|44)[0-9]{6,12}$'
  )
);

-- users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pressing_id UUID NOT NULL REFERENCES pressings(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'employee',
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20),
  permissions JSONB DEFAULT '[
    {"action": "create_invoice", "granted": true},
    {"action": "cancel_invoice", "granted": false},
    {"action": "view_revenue", "granted": false},
    {"action": "manage_users", "granted": false},
    {"action": "modify_prices", "granted": false},
    {"action": "export_data", "granted": false}
  ]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT user_name_check CHECK (char_length(full_name) >= 2),
  CONSTRAINT user_email_check CHECK (email ~* '^[^@]+@[^@]+\.[^@]+$'),
  CONSTRAINT user_phone_check CHECK (
    phone IS NULL OR phone ~* '^\+?(242|243|33|44)[0-9]{6,12}$'
  )
);

-- user_preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  theme VARCHAR(10) DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  language VARCHAR(5) DEFAULT 'fr' CHECK (language IN ('fr','en','ln','kg','sw','pt')), -- étendu
  currency VARCHAR(5) DEFAULT 'XAF',
  timezone VARCHAR(50) DEFAULT 'Africa/Brazzaville',
  notifications JSONB DEFAULT '{
    "email": true,
    "push": true,
    "sound": true
  }'::jsonb,
  dashboard JSONB DEFAULT '{
    "defaultView": "today",
    "showQuickStats": true,
    "showRecentInvoices": true
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- articles (+ soft-delete)
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pressing_id UUID NOT NULL REFERENCES pressings(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category article_category NOT NULL,
  default_price DECIMAL(10,2) NOT NULL CHECK (default_price >= 0),
  is_active BOOLEAN DEFAULT true,
  is_deleted BOOLEAN NOT NULL DEFAULT false, -- soft delete
  description TEXT,
  estimated_days INTEGER DEFAULT 3 CHECK (estimated_days > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT article_name_check CHECK (char_length(name) >= 1),
  UNIQUE(pressing_id, name)
);

-- invoices (on conserve la logique existante de cancel)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pressing_id UUID NOT NULL REFERENCES pressings(id) ON DELETE CASCADE,
  number VARCHAR(50) NOT NULL,

  client_name VARCHAR(255) NOT NULL,
  client_phone VARCHAR(20),
  client_email VARCHAR(255),
  client_address TEXT,

  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
  discount DECIMAL(10,2) DEFAULT 0 CHECK (discount >= 0),
  discount_type discount_type DEFAULT 'amount',
  tax DECIMAL(10,2) DEFAULT 0 CHECK (tax >= 0),
  total DECIMAL(10,2) NOT NULL CHECK (total >= 0),

  status invoice_status DEFAULT 'active',
  paid BOOLEAN DEFAULT false,
  withdrawn BOOLEAN DEFAULT false,
  payment_method payment_method,
  deposit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_date DATE,
  withdrawal_date DATE,
  estimated_ready_date DATE,

  created_by UUID NOT NULL REFERENCES users(id),
  created_by_name VARCHAR(255) NOT NULL,
  modified_by UUID REFERENCES users(id),
  modified_by_name VARCHAR(255),
  modified_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  cancelled_by UUID REFERENCES users(id),
  cancelled_at TIMESTAMP WITH TIME ZONE,

  notes TEXT,
  urgency urgency_level DEFAULT 'normal',
  tags TEXT[] DEFAULT '{}',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT invoice_number_check CHECK (char_length(number) >= 1),
  CONSTRAINT invoice_client_name_check CHECK (char_length(client_name) >= 1),
  CONSTRAINT invoice_client_email_check CHECK (client_email IS NULL OR client_email ~* '^[^@]+@[^@]+\.[^@]+$'),
  CONSTRAINT invoice_client_phone_check CHECK (
    client_phone IS NULL OR client_phone ~* '^\+?(242|243|33|44)[0-9]{6,12}$'
  ),
  CONSTRAINT invoice_payment_logic CHECK (
    (paid = false AND payment_method IS NULL AND payment_date IS NULL) OR
    (paid = true AND payment_method IS NOT NULL)
  ),
  CONSTRAINT invoice_withdrawal_logic CHECK (
    (withdrawn = false AND withdrawal_date IS NULL) OR
    (withdrawn = true AND withdrawal_date IS NOT NULL AND paid = true)
  ),
  CONSTRAINT invoice_cancellation_logic CHECK (
    (status = 'active' AND cancellation_reason IS NULL AND cancelled_by IS NULL AND cancelled_at IS NULL) OR
    (status = 'cancelled' AND cancellation_reason IS NOT NULL AND cancelled_by IS NOT NULL AND cancelled_at IS NOT NULL)
  ),
  UNIQUE(pressing_id, number)
);

-- clients (+ soft-delete)
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pressing_id UUID NOT NULL REFERENCES pressings(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  total_invoices INTEGER DEFAULT 0 CHECK (total_invoices >= 0),
  total_spent DECIMAL(10,2) DEFAULT 0 CHECK (total_spent >= 0),
  last_visit DATE,
  notes TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false, -- soft delete
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT client_name_check CHECK (char_length(name) >= 1),
  CONSTRAINT client_email_check CHECK (email IS NULL OR email ~* '^[^@]+@[^@]+\.[^@]+$'),
  CONSTRAINT client_phone_check CHECK (
    phone IS NULL OR phone ~* '^\+?(242|243|33|44)[0-9]{6,12}$'
  ),
  UNIQUE(pressing_id, name, phone)
);

-- revenue_daily
CREATE TABLE IF NOT EXISTS revenue_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pressing_id UUID NOT NULL REFERENCES pressings(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  deposit_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  withdrawal_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  daily_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_transactions INTEGER NOT NULL DEFAULT 0,
  average_ticket DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_methods JSONB DEFAULT '{}'::jsonb,
  categories JSONB DEFAULT '{}'::jsonb,
  employees JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pressing_id, date)
);

-- audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(50) NOT NULL,
  record_id UUID NOT NULL,
  action audit_action NOT NULL,
  old_values JSONB,
  new_values JSONB,
  user_id UUID REFERENCES users(id),
  user_name VARCHAR(255),
  user_role user_role,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT audit_table_name_check CHECK (char_length(table_name) >= 1)
);

-- offline_queue
CREATE TABLE IF NOT EXISTS offline_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('create','update','delete')),
  endpoint VARCHAR(255) NOT NULL,
  data JSONB NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  retry_count INTEGER DEFAULT 0 CHECK (retry_count >= 0),
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT offline_queue_endpoint_check CHECK (char_length(endpoint) >= 1)
);

-- =============================================================================
-- HELPER FUNCTIONS (auth.* & util)
-- =============================================================================

CREATE OR REPLACE FUNCTION auth.user_pressing_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT pressing_id FROM users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth.is_owner()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT role = 'owner' FROM users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth.has_permission(permission_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT CASE
      WHEN role = 'owner' THEN true
      ELSE EXISTS (
        SELECT 1
        FROM jsonb_array_elements(permissions) AS perm
        WHERE perm->>'action' = permission_name
          AND (perm->>'granted')::boolean = true
      )
    END
    FROM users WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth.is_active_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT is_active = true FROM users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Génère number (préfixe pays)
CREATE OR REPLACE FUNCTION generate_invoice_number(pressing_id UUID)
RETURNS TEXT AS $$
DECLARE
  date_prefix TEXT;
  sequence_num INTEGER;
  invoice_number TEXT;
  country_code TEXT;
BEGIN
  SELECT country INTO country_code FROM pressings WHERE id = pressing_id;
  date_prefix := to_char(CURRENT_DATE, 'YYYYMMDD');

  SELECT COALESCE(
    MAX(
      CASE
        WHEN number LIKE date_prefix || '-%' THEN
          (regexp_match(number, date_prefix || '-(\d+)$'))[1]::integer
        ELSE 0
      END
    ), 0
  ) + 1
  INTO sequence_num
  FROM invoices
  WHERE pressing_id = generate_invoice_number.pressing_id
    AND number LIKE date_prefix || '-%';

  IF country_code = 'CD' THEN
    invoice_number := 'RDC-' || date_prefix || '-' || lpad(sequence_num::text, 4, '0');
  ELSIF country_code = 'CG' THEN
    invoice_number := 'CG-' || date_prefix || '-' || lpad(sequence_num::text, 4, '0');
  ELSE
    invoice_number := date_prefix || '-' || lpad(sequence_num::text, 4, '0');
  END IF;

  RETURN invoice_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crée articles par défaut (catégories corrigées sans accents)
CREATE OR REPLACE FUNCTION create_default_articles(pressing_id UUID)
RETURNS VOID AS $$
DECLARE
  default_articles JSON := '[
    {"name":"Chemise homme","category":"vetement","price":5000},
    {"name":"Chemise femme","category":"vetement","price":5000},
    {"name":"Pantalon homme","category":"vetement","price":7000},
    {"name":"Pantalon femme","category":"vetement","price":7000},
    {"name":"Jean","category":"vetement","price":6000},
    {"name":"Robe courte","category":"vetement","price":8000},
    {"name":"Robe longue","category":"vetement","price":10000},
    {"name":"Veste/Blazer","category":"vetement","price":9000},
    {"name":"T-shirt","category":"vetement","price":3500},
    {"name":"Ensemble jogging","category":"vetement","price":10000},
    {"name":"Ensemble tunique","category":"vetement","price":12000},
    {"name":"Veste","category":"vetement","price":8000},
    {"name":"Costume 2 pieces","category":"vetement","price":15000},
    {"name":"Costume 3 pieces","category":"vetement","price":18000},
    {"name":"Manteau court","category":"vetement","price":12000},
    {"name":"Manteau long","category":"vetement","price":15000},
    {"name":"Pardessus","category":"vetement","price":16000},
    {"name":"Pull/Gilet","category":"vetement","price":6000},

    {"name":"Basket","category":"chaussure","price":7000},
    {"name":"Chaussure ville","category":"chaussure","price":6000},

    {"name":"Cravate","category":"accessoire","price":3000},
    {"name":"Echarpe","category":"accessoire","price":4000},
    {"name":"Foulard","category":"accessoire","price":3500},
    {"name":"Casquette","category":"accessoire","price":2000},

    {"name":"Serviette","category":"maison","price":3000},
    {"name":"Couverture","category":"maison","price":10000},
    {"name":"Draps de lit","category":"maison","price":7000},

    {"name":"Ensemble Bazin homme","category":"traditionnel","price":25000},
    {"name":"Ensemble Bazin femme","category":"traditionnel","price":25000},
    {"name":"Ensemble pagne homme","category":"traditionnel","price":15000},
    {"name":"Ensemble pagne femme","category":"traditionnel","price":15000},

    {"name":"Sous-vetements (paire)","category":"delicat","price":1500},
    {"name":"Culotte","category":"delicat","price":1500},

    {"name":"Robe de mariage","category":"ceremonie","price":30000},
    {"name":"Jupe de mariage","category":"ceremonie","price":20000},
    {"name":"Robe de soiree","category":"ceremonie","price":18000},

    {"name":"Robe simple","category":"vetement","price":7000},
    {"name":"Robe enfant","category":"enfant","price":5000},
    {"name":"Vetement enfant","category":"enfant","price":4000},

    {"name":"Tenue scolaire","category":"uniforme","price":8000},
    {"name":"Tenue universitaire","category":"uniforme","price":9000},
    {"name":"Tenue de travail","category":"uniforme","price":10000},
    {"name":"Tenue de la police","category":"uniforme","price":12000},
    {"name":"Tenue de la gendarmerie","category":"uniforme","price":12000},
    {"name":"Tenue de fonctionnaire","category":"uniforme","price":11000},

    {"name":"Veste en cuir","category":"cuir","price":20000},
    {"name":"Pantalon en cuir","category":"cuir","price":18000},
    {"name":"Sac en cuir","category":"cuir","price":15000},

    {"name":"Retouche ourlet","category":"retouche","price":2500},
    {"name":"Retouche taille","category":"retouche","price":4000},

    {"name":"Nettoyage delicat","category":"special","price":12000},
    {"name":"Detachage specialise","category":"special","price":8000}
  ]'::JSON;
  article JSON;
BEGIN
  FOR article IN SELECT * FROM json_array_elements(default_articles)
  LOOP
    INSERT INTO articles (pressing_id, name, category, default_price)
    VALUES (
      create_default_articles.pressing_id,
      article->>'name',
      (article->>'category')::article_category,
      (article->>'price')::decimal
    )
    ON CONFLICT (pressing_id, name) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crée un pressing par défaut (devise/zone par pays)
CREATE OR REPLACE FUNCTION create_default_pressing(
  pressing_name VARCHAR(255),
  country_val country_code DEFAULT 'CG'
) RETURNS UUID AS $$
DECLARE
  new_pressing_id UUID;
  currency_val TEXT;
  timezone_val TEXT;
BEGIN
  IF country_val = 'CD' THEN
    currency_val := 'CDF'; timezone_val := 'Africa/Lubumbashi';
  ELSE
    currency_val := 'XAF'; timezone_val := 'Africa/Brazzaville';
  END IF;

  INSERT INTO pressings (name, country, settings)
  VALUES (
    pressing_name,
    country_val,
    jsonb_set(
      jsonb_set(
        '{
          "currency": "' || currency_val || '",
          "timezone": "' || timezone_val || '",
          "taxRate": 0,
          "defaultDiscount": 0,
          "businessHours": {
            "monday":{"open":"08:00","close":"18:00","closed":false},
            "tuesday":{"open":"08:00","close":"18:00","closed":false},
            "wednesday":{"open":"08:00","close":"18:00","closed":false},
            "thursday":{"open":"08:00","close":"18:00","closed":false},
            "friday":{"open":"08:00","close":"18:00","closed":false},
            "saturday":{"open":"08:00","close":"17:00","closed":false},
            "sunday":{"open":"08:00","close":"12:00","closed":true}
          },
          "notifications":{"emailNotifications":true,"pushNotifications":true,"smsNotifications":false},
          "phoneFormat":"'
          || country_val || '"
        }'::jsonb,
        '{currency}', to_jsonb(currency_val)
      ),
      '{timezone}', to_jsonb(timezone_val)
    )
  ) RETURNING id INTO new_pressing_id;

  PERFORM create_default_articles(new_pressing_id);
  RETURN new_pressing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- RLS (Row-Level Security)
-- =============================================================================

ALTER TABLE pressings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_queue ENABLE ROW LEVEL SECURITY;

-- PRESSINGS
DROP POLICY IF EXISTS "Users can view their own pressing" ON pressings;
CREATE POLICY "Users can view their own pressing"
  ON pressings FOR SELECT
  USING (id = auth.user_pressing_id() AND auth.is_active_user());

DROP POLICY IF EXISTS "Owners can update their pressing" ON pressings;
CREATE POLICY "Owners can update their pressing"
  ON pressings FOR UPDATE
  USING (id = auth.user_pressing_id() AND auth.is_owner() AND auth.is_active_user());

-- USERS
DROP POLICY IF EXISTS "Users can view pressing members" ON users;
CREATE POLICY "Users can view pressing members"
  ON users FOR SELECT
  USING (pressing_id = auth.user_pressing_id() AND auth.is_active_user());

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (id = auth.uid() AND auth.is_active_user());

DROP POLICY IF EXISTS "Owners can manage users" ON users;
CREATE POLICY "Owners can manage users"
  ON users FOR ALL
  USING (
    pressing_id = auth.user_pressing_id()
    AND auth.is_owner()
    AND auth.has_permission('manage_users')
    AND auth.is_active_user()
  );

DROP POLICY IF EXISTS "Users can insert themselves" ON users;
CREATE POLICY "Users can insert themselves"
  ON users FOR INSERT
  WITH CHECK (id = auth.uid());

-- USER_PREFERENCES
DROP POLICY IF EXISTS "Users can manage own preferences" ON user_preferences;
CREATE POLICY "Users can manage own preferences"
  ON user_preferences FOR ALL
  USING (user_id = auth.uid() AND auth.is_active_user());

-- ARTICLES (filtre soft-delete)
DROP POLICY IF EXISTS "Users can view pressing articles" ON articles;
CREATE POLICY "Users can view pressing articles"
  ON articles FOR SELECT
  USING (
    pressing_id = auth.user_pressing_id()
    AND is_deleted = false
    AND auth.is_active_user()
  );

DROP POLICY IF EXISTS "Authorized users can create articles" ON articles;
CREATE POLICY "Authorized users can create articles"
  ON articles FOR INSERT
  WITH CHECK (
    pressing_id = auth.user_pressing_id()
    AND (auth.is_owner() OR auth.has_permission('modify_prices'))
    AND auth.is_active_user()
  );

DROP POLICY IF EXISTS "Authorized users can update articles" ON articles;
CREATE POLICY "Authorized users can update articles"
  ON articles FOR UPDATE
  USING (
    pressing_id = auth.user_pressing_id()
    AND (auth.is_owner() OR auth.has_permission('modify_prices'))
    AND auth.is_active_user()
  );

-- Recommandation: éviter DELETE physique, utiliser is_deleted=true via UPDATE
DROP POLICY IF EXISTS "Owners can delete articles" ON articles;
CREATE POLICY "Owners can delete articles (soft)" 
  ON articles FOR UPDATE
  USING (
    pressing_id = auth.user_pressing_id()
    AND auth.is_owner()
    AND auth.is_active_user()
  );

-- INVOICES
DROP POLICY IF EXISTS "Users can view pressing invoices" ON invoices;
CREATE POLICY "Users can view pressing invoices"
  ON invoices FOR SELECT
  USING (pressing_id = auth.user_pressing_id() AND auth.is_active_user());

DROP POLICY IF EXISTS "Authorized users can create invoices" ON invoices;
CREATE POLICY "Authorized users can create invoices"
  ON invoices FOR INSERT
  WITH CHECK (
    pressing_id = auth.user_pressing_id()
    AND auth.has_permission('create_invoice')
    AND created_by = auth.uid()
    AND auth.is_active_user()
  );

DROP POLICY IF EXISTS "Users can update invoices based on permissions" ON invoices;
CREATE POLICY "Users can update invoices based on permissions"
  ON invoices FOR UPDATE
  USING (
    pressing_id = auth.user_pressing_id()
    AND (
      (created_by = auth.uid() AND status != 'cancelled')
      OR auth.is_owner()
      OR auth.has_permission('cancel_invoice')
    )
    AND auth.is_active_user()
  );

DROP POLICY IF EXISTS "Owners can cancel invoices" ON invoices;
CREATE POLICY "Owners can cancel invoices"
  ON invoices FOR UPDATE
  USING (
    pressing_id = auth.user_pressing_id()
    AND (auth.is_owner() OR auth.has_permission('cancel_invoice'))
    AND auth.is_active_user()
  );

-- CLIENTS (filtre soft-delete)
DROP POLICY IF EXISTS "Users can view pressing clients" ON clients;
CREATE POLICY "Users can view pressing clients"
  ON clients FOR SELECT
  USING (
    pressing_id = auth.user_pressing_id()
    AND is_deleted = false
    AND auth.is_active_user()
  );

DROP POLICY IF EXISTS "System can manage clients" ON clients;
CREATE POLICY "System can manage clients"
  ON clients FOR ALL
  USING (
    pressing_id = auth.user_pressing_id()
    AND auth.is_active_user()
  );

-- REVENUE_DAILY
DROP POLICY IF EXISTS "Authorized users can view revenue" ON revenue_daily;
CREATE POLICY "Authorized users can view revenue"
  ON revenue_daily FOR SELECT
  USING (
    pressing_id = auth.user_pressing_id()
    AND (auth.is_owner() OR auth.has_permission('view_revenue'))
    AND auth.is_active_user()
  );

DROP POLICY IF EXISTS "System can manage revenue" ON revenue_daily;
CREATE POLICY "System can manage revenue"
  ON revenue_daily FOR ALL
  USING (
    pressing_id = auth.user_pressing_id()
    AND (auth.is_owner() OR auth.has_permission('view_revenue'))
    AND auth.is_active_user()
  );

-- AUDIT_LOGS
DROP POLICY IF EXISTS "Owners can view audit logs" ON audit_logs;
CREATE POLICY "Owners can view audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.pressing_id = (
          SELECT pressing_id FROM users WHERE id = audit_logs.user_id
        )
        AND u.role = 'owner'
        AND u.is_active = true
    )
  );

DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

-- OFFLINE_QUEUE
DROP POLICY IF EXISTS "Users can manage own offline queue" ON offline_queue;
CREATE POLICY "Users can manage own offline queue"
  ON offline_queue FOR ALL
  USING (user_id = auth.uid() AND auth.is_active_user());

-- =============================================================================
-- GRANTS (resserrés)
-- =============================================================================

-- Schéma
GRANT USAGE ON SCHEMA public TO authenticated, anon;

-- Tables: pas de DELETE global
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
-- Sequences: nécessaires pour nextval/currval
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Fonctions: on accorde au cas par cas (ci-dessous déjà fait)
-- Éviter: GRANT ALL ON ALL FUNCTIONS ...

-- Fonctions métiers
GRANT EXECUTE ON FUNCTION generate_invoice_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_default_articles(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_default_pressing(VARCHAR, country_code) TO authenticated;

-- Fonctions d'auth
GRANT EXECUTE ON FUNCTION auth.user_pressing_id() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.has_permission(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_active_user() TO authenticated;

-- Si tu as d'autres fonctions:
-- GRANT EXECUTE ON FUNCTION calculate_daily_revenue TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_invoice_stats TO authenticated;
-- GRANT EXECUTE ON FUNCTION search_invoices TO authenticated;
-- GRANT EXECUTE ON FUNCTION update_client_stats TO authenticated;

-- =============================================================================
-- COMMENTAIRES
-- =============================================================================
COMMENT ON POLICY "Users can view their own pressing" ON pressings IS 'Les utilisateurs ne voient que leur pressing';
COMMENT ON POLICY "Users can view pressing invoices" ON invoices IS 'Les utilisateurs voient les factures de leur pressing';
COMMENT ON POLICY "Authorized users can create invoices" ON invoices IS 'Permission create_invoice requise';
COMMENT ON POLICY "Owners can view audit logs" ON audit_logs IS 'Réservé aux owners du même pressing';
COMMENT ON FUNCTION auth.user_pressing_id() IS 'ID du pressing de l’utilisateur connecté';
COMMENT ON FUNCTION auth.is_owner() IS 'Vérifie si l’utilisateur est owner';
COMMENT ON FUNCTION auth.has_permission(TEXT) IS 'Vérifie une permission JSONB';
COMMENT ON FUNCTION generate_invoice_number IS 'Numéro de facture avec préfixe pays';
COMMENT ON FUNCTION create_default_articles IS 'Seed des articles avec catégories normalisées';
COMMENT ON FUNCTION create_default_pressing IS 'Crée un pressing par défaut (devise/zone)';

-- =============================================================================
-- (Optionnel) TRIGGERS utilitaires pour updated_at auto
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_timestamp') THEN
    CREATE FUNCTION set_timestamp() RETURNS trigger AS $tg$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $tg$ LANGUAGE plpgsql;
  END IF;
END$$;

-- Attach triggers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_pressings'
  ) THEN
    CREATE TRIGGER set_timestamp_pressings
      BEFORE UPDATE ON pressings
      FOR EACH ROW EXECUTE FUNCTION set_timestamp();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_users') THEN
    CREATE TRIGGER set_timestamp_users
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION set_timestamp();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_user_preferences') THEN
    CREATE TRIGGER set_timestamp_user_preferences
      BEFORE UPDATE ON user_preferences
      FOR EACH ROW EXECUTE FUNCTION set_timestamp();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_articles') THEN
    CREATE TRIGGER set_timestamp_articles
      BEFORE UPDATE ON articles
      FOR EACH ROW EXECUTE FUNCTION set_timestamp();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_invoices') THEN
    CREATE TRIGGER set_timestamp_invoices
      BEFORE UPDATE ON invoices
      FOR EACH ROW EXECUTE FUNCTION set_timestamp();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_clients') THEN
    CREATE TRIGGER set_timestamp_clients
      BEFORE UPDATE ON clients
      FOR EACH ROW EXECUTE FUNCTION set_timestamp();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_revenue_daily') THEN
    CREATE TRIGGER set_timestamp_revenue_daily
      BEFORE UPDATE ON revenue_daily
      FOR EACH ROW EXECUTE FUNCTION set_timestamp();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_offline_queue') THEN
    CREATE TRIGGER set_timestamp_offline_queue
      BEFORE UPDATE ON offline_queue
      FOR EACH ROW EXECUTE FUNCTION set_timestamp();
  END IF;
END$$;

-- =============================================================================
-- FIN
-- =============================================================================