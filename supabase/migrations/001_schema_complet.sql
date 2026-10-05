-- =============================================================================
-- MIGRATION 001 — DIGIT PRESSING / LB PRESSING SAAS
-- Schéma complet multi-tenant aligné sur copilote.md
-- Base vierge : toutes les tables créées ici
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE order_status AS ENUM (
  'REQUEST',
  'VALIDATED',
  'RECEIVED',
  'PROCESSING',
  'READY',
  'DELIVERED',
  'REJECTED',
  'CANCELLED'
);

CREATE TYPE order_mode AS ENUM (
  'DROP_OFF',      -- dépôt au pressing
  'PICKUP',        -- ramassage à domicile
  'DELIVERY'       -- livraison à domicile
);

CREATE TYPE payment_method AS ENUM (
  'CASH',
  'MTN_MOMO',
  'AIRTEL_MONEY',
  'OTHER'
);

CREATE TYPE member_role AS ENUM (
  'OWNER',
  'MANAGER',
  'CASHIER',
  'DELIVERY'
);

CREATE TYPE cash_register_status AS ENUM (
  'OPEN',
  'CLOSED'
);

-- =============================================================================
-- TABLE: organizations
-- =============================================================================
CREATE TABLE organizations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(255) NOT NULL,
  slug              VARCHAR(100) NOT NULL UNIQUE,
  ticket_prefix     VARCHAR(10)  NOT NULL DEFAULT 'LB',
  country_code      VARCHAR(5)   NOT NULL DEFAULT '242',
  phone_1           VARCHAR(30),
  phone_2           VARCHAR(30),
  email             VARCHAR(255),
  logo_url          TEXT,
  address           TEXT,
  slogan            TEXT,
  footer_text       TEXT,
  currency          VARCHAR(10)  NOT NULL DEFAULT 'XAF',
  plan              VARCHAR(50)  NOT NULL DEFAULT 'trial',
  trial_until       DATE,
  is_active         BOOLEAN      NOT NULL DEFAULT true,
  settings          JSONB        NOT NULL DEFAULT '{
    "timezone": "Africa/Brazzaville",
    "businessHours": {
      "monday":    {"open": "08:00", "close": "18:00", "closed": false},
      "tuesday":   {"open": "08:00", "close": "18:00", "closed": false},
      "wednesday": {"open": "08:00", "close": "18:00", "closed": false},
      "thursday":  {"open": "08:00", "close": "18:00", "closed": false},
      "friday":    {"open": "08:00", "close": "18:00", "closed": false},
      "saturday":  {"open": "08:00", "close": "17:00", "closed": false},
      "sunday":    {"open": "08:00", "close": "12:00", "closed": true}
    }
  }'::jsonb,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT org_name_min CHECK (char_length(name) >= 2),
  CONSTRAINT org_slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

-- =============================================================================
-- TABLE: platform_admins
-- Super-admins créés manuellement par le fondateur
-- =============================================================================
CREATE TABLE platform_admins (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE: memberships
-- Lien user <-> organization avec rôle
-- =============================================================================
CREATE TABLE memberships (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role            member_role NOT NULL DEFAULT 'CASHIER',
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  full_name       VARCHAR(255),
  phone           VARCHAR(30),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

-- =============================================================================
-- TABLE: services (= articles / prestations du pressing)
-- =============================================================================
CREATE TABLE services (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(255)  NOT NULL,
  description     TEXT,
  category        VARCHAR(100),
  price           DECIMAL(12,2) NOT NULL CHECK (price >= 0),
  cost_price      DECIMAL(12,2)           CHECK (cost_price >= 0), -- visible OWNER/MANAGER seulement
  estimated_days  INTEGER       NOT NULL DEFAULT 2 CHECK (estimated_days > 0),
  is_active       BOOLEAN       NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- =============================================================================
-- TABLE: customers
-- Identifiant métier : organization_id + téléphone normalisé
-- Pas un compte, pas une authentification
-- =============================================================================
CREATE TABLE customers (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name         VARCHAR(255) NOT NULL,
  phone_normalized  VARCHAR(30)  NOT NULL,
  phone_display     VARCHAR(30),
  address           TEXT,
  notes             TEXT,
  total_orders      INTEGER      NOT NULL DEFAULT 0 CHECK (total_orders >= 0),
  total_spent       DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (total_spent >= 0),
  last_order_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, phone_normalized)
);

-- =============================================================================
-- TABLE: ticket_sequences
-- Compteur persistant par organisation (ne se réinitialise jamais)
-- Un UPDATE verrouillé dans la transaction pour éviter les trous
-- =============================================================================
CREATE TABLE ticket_sequences (
  organization_id UUID    PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  last_value      INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE: orders
-- Commandes (REQUEST → DELIVERED) + demandes publiques sans compte
-- =============================================================================
CREATE TABLE orders (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identifiants
  request_code        VARCHAR(20),   -- D-0042 : attribué dès REQUEST
  ticket_number       VARCHAR(20),   -- LB-0001 : attribué uniquement à RECEIVED
  invoice_token       TEXT UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'), -- pour /f/{token}

  -- Client (pas de compte)
  customer_id         UUID          REFERENCES customers(id),
  client_name         VARCHAR(255)  NOT NULL,
  client_phone        VARCHAR(30)   NOT NULL,

  -- Statut
  status              order_status  NOT NULL DEFAULT 'REQUEST',
  mode                order_mode    NOT NULL DEFAULT 'DROP_OFF',
  pickup_address      TEXT,
  delivery_address    TEXT,
  requested_at        TIMESTAMPTZ,  -- date/heure souhaitée par le client

  -- Financier (totaux calculés à la création/modification)
  subtotal            DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  delivery_fee        DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  discount_amount     DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  discount_reason     TEXT,
  total_amount        DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  -- paid_amount et balance_due sont dérivés des écritures payments (vue)

  -- Comptage articles
  items_count_in      INTEGER,      -- à la réception
  items_count_out     INTEGER,      -- à la remise
  items_verified      BOOLEAN       NOT NULL DEFAULT false,
  items_discrepancy   TEXT,         -- écart consigné

  -- Motif annulation/rejet
  cancellation_reason TEXT,
  rejection_reason    TEXT,

  -- Dérogation livraison sans paiement
  delivery_override_by   UUID REFERENCES auth.users(id),
  delivery_override_at   TIMESTAMPTZ,
  delivery_override_note TEXT,

  -- Références créateur/modificateur
  created_by          UUID          REFERENCES auth.users(id),
  validated_by        UUID          REFERENCES auth.users(id),
  received_by         UUID          REFERENCES auth.users(id),
  delivered_by        UUID          REFERENCES auth.users(id),
  cancelled_by        UUID          REFERENCES auth.users(id),

  -- Anti-spam (IP hachée)
  ip_hash             TEXT,

  -- Notes
  notes               TEXT,

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE: order_items
-- Lignes de commande, prix figé à la création
-- =============================================================================
CREATE TABLE order_items (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id        UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  service_id      UUID          REFERENCES services(id),
  service_name    VARCHAR(255)  NOT NULL,       -- copié à la création, figé
  unit_price      DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0), -- figé
  quantity        INTEGER       NOT NULL DEFAULT 1 CHECK (quantity > 0),
  line_total      DECIMAL(12,2) NOT NULL CHECK (line_total >= 0),
  notes           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE: payments
-- Écritures immuables — pas de modification directe
-- Correction = écriture inverse avec motif
-- =============================================================================
CREATE TABLE payments (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID           NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id        UUID           NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount          DECIMAL(12,2)  NOT NULL, -- négatif si écriture inverse
  method          payment_method NOT NULL DEFAULT 'CASH',
  reference       VARCHAR(100),            -- référence Mobile Money
  notes           TEXT,
  is_reversal     BOOLEAN        NOT NULL DEFAULT false,
  reversal_reason TEXT,
  collected_by    UUID           NOT NULL REFERENCES auth.users(id),
  collected_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE: cash_closings
-- Clôture de caisse journalière — verrouillée une fois clôturée
-- =============================================================================
CREATE TABLE cash_closings (
  id                  UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID                 NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  opened_by           UUID                 NOT NULL REFERENCES auth.users(id),
  closed_by           UUID                 REFERENCES auth.users(id),
  date                DATE                 NOT NULL,
  opening_balance     DECIMAL(12,2)        NOT NULL DEFAULT 0,
  expected_cash       DECIMAL(12,2),       -- calculé à la clôture
  counted_cash        DECIMAL(12,2),       -- saisi par caissier
  discrepancy         DECIMAL(12,2),       -- écart = counted - expected
  status              cash_register_status NOT NULL DEFAULT 'OPEN',
  opened_at           TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  closed_at           TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, date)  -- une seule caisse par jour par org
);

-- =============================================================================
-- TABLE: message_templates
-- Templates WhatsApp configurables par organisation
-- =============================================================================
CREATE TABLE message_templates (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,  -- 'facture', 'pret', 'rappel', 'ramassage', 'livraison'
  body            TEXT         NOT NULL,
  variables       TEXT[]       DEFAULT '{}',
  is_active       BOOLEAN      NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- =============================================================================
-- TABLE: audit_logs
-- Journal en lecture seule — alimenté uniquement par triggers PostgreSQL
-- =============================================================================
CREATE TABLE audit_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        REFERENCES organizations(id),
  table_name      VARCHAR(100) NOT NULL,
  record_id       UUID        NOT NULL,
  action          VARCHAR(20) NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  old_values      JSONB,
  new_values      JSONB,
  changed_by      UUID        REFERENCES auth.users(id),
  changed_by_name TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE: rate_limits
-- Anti-spam commandes publiques (basé sur téléphone normalisé, IP hachée secondaire)
-- =============================================================================
CREATE TABLE rate_limits (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key             TEXT        NOT NULL,  -- 'phone:+242...' ou 'ip_hash:xxx'
  action          VARCHAR(50) NOT NULL DEFAULT 'create_order',
  count           INTEGER     NOT NULL DEFAULT 1,
  window_start    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX rate_limits_key_action ON rate_limits(key, action);

-- =============================================================================
-- TABLE: request_sequences
-- Compteur des demandes publiques (D-XXXX) — distinct des tickets officiels
-- =============================================================================
CREATE TABLE request_sequences (
  organization_id UUID    PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  last_value      INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES DE PERFORMANCE
-- =============================================================================

CREATE INDEX idx_orders_org_id         ON orders(organization_id);
CREATE INDEX idx_orders_status         ON orders(organization_id, status);
CREATE INDEX idx_orders_client_phone   ON orders(organization_id, client_phone);
CREATE INDEX idx_orders_ticket         ON orders(ticket_number) WHERE ticket_number IS NOT NULL;
CREATE INDEX idx_orders_token          ON orders(invoice_token);
CREATE INDEX idx_orders_request_code   ON orders(organization_id, request_code);
CREATE INDEX idx_order_items_order_id  ON order_items(order_id);
CREATE INDEX idx_payments_order_id     ON payments(order_id);
CREATE INDEX idx_payments_org_id       ON payments(organization_id);
CREATE INDEX idx_memberships_user_id   ON memberships(user_id);
CREATE INDEX idx_memberships_org_id    ON memberships(organization_id);
CREATE INDEX idx_customers_org_phone   ON customers(organization_id, phone_normalized);
CREATE INDEX idx_services_org_id       ON services(organization_id);
CREATE INDEX idx_audit_logs_org_id     ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_record_id  ON audit_logs(record_id);
CREATE INDEX idx_rate_limits_expires   ON rate_limits(expires_at);

-- =============================================================================
-- VUE: order_payment_summary
-- paid_amount et balance_due calculés depuis les écritures payments
-- JAMAIS saisis directement
-- =============================================================================
CREATE OR REPLACE VIEW order_payment_summary AS
SELECT
  o.id                                                          AS order_id,
  o.organization_id,
  o.total_amount,
  COALESCE(SUM(p.amount), 0)                                    AS paid_amount,
  o.total_amount - COALESCE(SUM(p.amount), 0)                  AS balance_due,
  COUNT(p.id)                                                   AS payment_count
FROM orders o
LEFT JOIN payments p ON p.order_id = o.id
GROUP BY o.id, o.organization_id, o.total_amount;

-- =============================================================================
-- HELPER FUNCTIONS — SÉCURITÉ MULTI-TENANT
-- =============================================================================

-- Retourne l'organization_id de l'utilisateur connecté
CREATE OR REPLACE FUNCTION auth.get_user_org_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM memberships
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
  RETURN v_org_id;
END;
$$;

-- Retourne le rôle de l'utilisateur dans une organisation donnée
CREATE OR REPLACE FUNCTION auth.get_user_role(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role::TEXT INTO v_role
  FROM memberships
  WHERE user_id = auth.uid()
    AND organization_id = p_org_id
    AND is_active = true;
  RETURN v_role;
END;
$$;

-- Vérifie si l'utilisateur est membre actif d'une organisation
CREATE OR REPLACE FUNCTION auth.is_member_of(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
      AND organization_id = p_org_id
      AND is_active = true
  );
END;
$$;

-- Vérifie si l'utilisateur a au moins le rôle demandé dans son organisation
CREATE OR REPLACE FUNCTION auth.has_role_in_org(p_org_id UUID, VARIADIC p_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
      AND organization_id = p_org_id
      AND role::TEXT = ANY(p_roles)
      AND is_active = true
  );
END;
$$;

-- Est-ce un platform_admin ?
CREATE OR REPLACE FUNCTION auth.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM platform_admins WHERE id = auth.uid()
  );
END;
$$;

-- =============================================================================
-- FUNCTION: assign_request_code (atomique, sans trou)
-- Attribue D-XXXX dès la création REQUEST
-- =============================================================================
CREATE OR REPLACE FUNCTION assign_request_code(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next INTEGER;
BEGIN
  INSERT INTO request_sequences (organization_id, last_value)
  VALUES (p_org_id, 1)
  ON CONFLICT (organization_id)
  DO UPDATE SET
    last_value = request_sequences.last_value + 1,
    updated_at = NOW()
  RETURNING last_value INTO v_next;

  RETURN 'D-' || LPAD(v_next::TEXT, 4, '0');
END;
$$;

-- =============================================================================
-- FUNCTION: receive_order_and_assign_ticket (atomique, sans trou)
-- Attribue LB-XXXX UNIQUEMENT au passage à RECEIVED
-- Utilise UPDATE verrouillé dans la même transaction (pas de SEQUENCE native)
-- =============================================================================
CREATE OR REPLACE FUNCTION receive_order_and_assign_ticket(
  p_order_id UUID,
  p_org_id   UUID,
  p_user_id  UUID,
  p_items_count INTEGER DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix  TEXT;
  v_next    INTEGER;
  v_ticket  TEXT;
  v_current_status order_status;
BEGIN
  -- Vérifier que la commande appartient à l'organisation et est dans le bon état
  SELECT status INTO v_current_status
  FROM orders
  WHERE id = p_order_id AND organization_id = p_org_id
  FOR UPDATE; -- verrouille la ligne pendant la transaction

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande % non trouvée pour organisation %', p_order_id, p_org_id;
  END IF;

  IF v_current_status NOT IN ('VALIDATED', 'REQUEST') THEN
    RAISE EXCEPTION 'La commande doit être en état VALIDATED ou REQUEST pour être réceptionnée (état actuel: %)', v_current_status;
  END IF;

  -- Récupérer le préfixe de l'organisation
  SELECT ticket_prefix INTO v_prefix
  FROM organizations
  WHERE id = p_org_id;

  IF v_prefix IS NULL OR v_prefix = '' THEN
    v_prefix := 'LB';
  END IF;

  -- Incrémenter le compteur verrouillé (sans trou en cas de commit)
  INSERT INTO ticket_sequences (organization_id, last_value)
  VALUES (p_org_id, 1)
  ON CONFLICT (organization_id)
  DO UPDATE SET
    last_value = ticket_sequences.last_value + 1,
    updated_at = NOW()
  RETURNING last_value INTO v_next;

  v_ticket := v_prefix || '-' || LPAD(v_next::TEXT, 4, '0');

  -- Mettre à jour la commande atomiquement
  UPDATE orders SET
    ticket_number  = v_ticket,
    status         = 'RECEIVED',
    received_by    = p_user_id,
    items_count_in = COALESCE(p_items_count, items_count_in),
    updated_at     = NOW()
  WHERE id = p_order_id
    AND organization_id = p_org_id;

  RETURN v_ticket;
END;
$$;

-- =============================================================================
-- FUNCTION: create_order_request (Server Action sécurisée côté public)
-- Crée une demande publique avec anti-spam
-- SECURITY DEFINER pour contourner RLS côté anon
-- =============================================================================
CREATE OR REPLACE FUNCTION create_order_request(
  p_org_id        UUID,
  p_client_name   TEXT,
  p_client_phone  TEXT,
  p_items         JSONB,   -- [{service_id, service_name, unit_price, quantity}]
  p_mode          TEXT     DEFAULT 'DROP_OFF',
  p_address       TEXT     DEFAULT NULL,
  p_notes         TEXT     DEFAULT NULL,
  p_ip_hash       TEXT     DEFAULT NULL,
  p_honeypot      TEXT     DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id     UUID;
  v_request_code TEXT;
  v_subtotal     DECIMAL(12,2) := 0;
  v_total        DECIMAL(12,2) := 0;
  v_item         JSONB;
  v_rate_count   INTEGER;
  v_phone_norm   TEXT;
  v_customer_id  UUID;
BEGIN
  -- Honeypot check
  IF p_honeypot IS NOT NULL AND p_honeypot != '' THEN
    RAISE EXCEPTION 'SPAM_DETECTED';
  END IF;

  -- Normaliser le téléphone (enlever espaces, tirets)
  v_phone_norm := regexp_replace(p_client_phone, '[^0-9+]', '', 'g');
  IF char_length(v_phone_norm) < 8 THEN
    RAISE EXCEPTION 'INVALID_PHONE';
  END IF;

  -- Rate limit par téléphone (max 3 demandes / heure)
  DELETE FROM rate_limits WHERE expires_at < NOW();

  INSERT INTO rate_limits (key, action, count, window_start, expires_at)
  VALUES ('phone:' || v_phone_norm, 'create_order', 1, NOW(), NOW() + INTERVAL '1 hour')
  ON CONFLICT (key, action)
  DO UPDATE SET count = rate_limits.count + 1
  RETURNING count INTO v_rate_count;

  IF v_rate_count > 3 THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  -- Calculer sous-total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_subtotal := v_subtotal + ((v_item->>'unit_price')::DECIMAL * (v_item->>'quantity')::INTEGER);
  END LOOP;

  v_total := v_subtotal;

  -- Attribuer code demande D-XXXX
  v_request_code := assign_request_code(p_org_id);

  -- Upsert customer
  INSERT INTO customers (organization_id, full_name, phone_normalized, phone_display)
  VALUES (p_org_id, p_client_name, v_phone_norm, p_client_phone)
  ON CONFLICT (organization_id, phone_normalized)
  DO UPDATE SET full_name = EXCLUDED.full_name
  RETURNING id INTO v_customer_id;

  -- Créer la commande
  INSERT INTO orders (
    organization_id, request_code, customer_id,
    client_name, client_phone, status, mode,
    pickup_address, delivery_address,
    subtotal, total_amount, notes, ip_hash
  )
  VALUES (
    p_org_id, v_request_code, v_customer_id,
    p_client_name, v_phone_norm, 'REQUEST', p_mode::order_mode,
    CASE WHEN p_mode = 'PICKUP' THEN p_address ELSE NULL END,
    CASE WHEN p_mode = 'DELIVERY' THEN p_address ELSE NULL END,
    v_subtotal, v_total, p_notes, p_ip_hash
  )
  RETURNING id INTO v_order_id;

  -- Insérer les lignes
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (
      organization_id, order_id, service_id,
      service_name, unit_price, quantity, line_total
    )
    VALUES (
      p_org_id,
      v_order_id,
      (v_item->>'service_id')::UUID,
      v_item->>'service_name',
      (v_item->>'unit_price')::DECIMAL,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'unit_price')::DECIMAL * (v_item->>'quantity')::INTEGER
    );
  END LOOP;

  RETURN jsonb_build_object(
    'order_id',      v_order_id,
    'request_code',  v_request_code,
    'total_amount',  v_total
  );
END;
$$;

-- =============================================================================
-- FUNCTION: get_order_tracking (lecture publique sécurisée)
-- =============================================================================
CREATE OR REPLACE FUNCTION get_order_tracking(
  p_org_id      UUID,
  p_request_code TEXT,
  p_phone       TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order JSONB;
  v_phone_norm TEXT;
BEGIN
  v_phone_norm := regexp_replace(p_phone, '[^0-9+]', '', 'g');

  SELECT jsonb_build_object(
    'request_code',  o.request_code,
    'ticket_number', o.ticket_number,
    'status',        o.status,
    'client_name',   o.client_name,
    'total_amount',  o.total_amount,
    'created_at',    o.created_at,
    'updated_at',    o.updated_at
  )
  INTO v_order
  FROM orders o
  WHERE o.organization_id = p_org_id
    AND o.request_code = p_request_code
    AND o.client_phone = v_phone_norm;

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  RETURN v_order;
END;
$$;

-- =============================================================================
-- TRIGGERS: updated_at automatique
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_organizations
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_memberships
  BEFORE UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_services
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_customers
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_orders
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_message_templates
  BEFORE UPDATE ON message_templates
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- TRIGGER: audit_log pour orders (actions sensibles)
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_audit_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (
    organization_id, table_name, record_id, action,
    old_values, new_values, changed_by
  )
  VALUES (
    COALESCE(NEW.organization_id, OLD.organization_id),
    'orders',
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP != 'INSERT' THEN row_to_json(OLD)::JSONB ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW)::JSONB ELSE NULL END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER audit_orders
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_orders();

-- =============================================================================
-- TRIGGER: audit_log pour payments
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_audit_payments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (
    organization_id, table_name, record_id, action,
    old_values, new_values, changed_by
  )
  VALUES (
    NEW.organization_id,
    'payments',
    NEW.id,
    TG_OP,
    NULL,
    row_to_json(NEW)::JSONB,
    auth.uid()
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_payments
  AFTER INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_payments();

-- =============================================================================
-- TRIGGER: mise à jour stats customer après chaque commande
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_update_customer_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL AND NEW.status = 'DELIVERED' THEN
    UPDATE customers SET
      total_orders = total_orders + 1,
      total_spent  = total_spent + NEW.total_amount,
      last_order_at = NOW()
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_customer_stats_on_delivery
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (OLD.status != 'DELIVERED' AND NEW.status = 'DELIVERED')
  EXECUTE FUNCTION trigger_update_customer_stats();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Organizations
ALTER TABLE organizations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admins    ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships        ENABLE ROW LEVEL SECURITY;
ALTER TABLE services           ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_closings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_sequences   ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_sequences  ENABLE ROW LEVEL SECURITY;

-- ---- ORGANIZATIONS ----

CREATE POLICY "org_select_members"
  ON organizations FOR SELECT
  USING (auth.is_member_of(id) OR auth.is_platform_admin());

CREATE POLICY "org_update_owner_manager"
  ON organizations FOR UPDATE
  USING (auth.has_role_in_org(id, 'OWNER', 'MANAGER') OR auth.is_platform_admin());

CREATE POLICY "org_public_select"
  ON organizations FOR SELECT
  USING (is_active = true); -- lecture publique limitée (slug, name, logo, phones)

-- ---- PLATFORM_ADMINS ----
CREATE POLICY "platform_admin_self"
  ON platform_admins FOR SELECT
  USING (id = auth.uid());

-- ---- MEMBERSHIPS ----

CREATE POLICY "memberships_select_own_org"
  ON memberships FOR SELECT
  USING (organization_id = auth.get_user_org_id() OR user_id = auth.uid());

CREATE POLICY "memberships_manage_owner_manager"
  ON memberships FOR ALL
  USING (
    auth.has_role_in_org(organization_id, 'OWNER', 'MANAGER')
    OR auth.is_platform_admin()
  );

-- ---- SERVICES ----

-- Lecture publique des services actifs (pour la page publique /{slug}/services)
CREATE POLICY "services_public_read"
  ON services FOR SELECT
  USING (is_active = true);

CREATE POLICY "services_member_read"
  ON services FOR SELECT
  USING (organization_id = auth.get_user_org_id());

CREATE POLICY "services_owner_manager_write"
  ON services FOR ALL
  USING (
    organization_id = auth.get_user_org_id()
    AND auth.has_role_in_org(organization_id, 'OWNER', 'MANAGER')
  );

-- ---- CUSTOMERS ----

CREATE POLICY "customers_member_read"
  ON customers FOR SELECT
  USING (organization_id = auth.get_user_org_id());

CREATE POLICY "customers_member_write"
  ON customers FOR INSERT
  WITH CHECK (organization_id = auth.get_user_org_id());

CREATE POLICY "customers_owner_manager_update"
  ON customers FOR UPDATE
  USING (
    organization_id = auth.get_user_org_id()
    AND auth.has_role_in_org(organization_id, 'OWNER', 'MANAGER', 'CASHIER')
  );

-- ---- ORDERS ----

CREATE POLICY "orders_member_read"
  ON orders FOR SELECT
  USING (organization_id = auth.get_user_org_id());

CREATE POLICY "orders_member_insert"
  ON orders FOR INSERT
  WITH CHECK (organization_id = auth.get_user_org_id());

CREATE POLICY "orders_member_update"
  ON orders FOR UPDATE
  USING (organization_id = auth.get_user_org_id());

-- DELIVERY: ne voit que les commandes READY et DELIVERED (ses livraisons)
CREATE POLICY "orders_delivery_read"
  ON orders FOR SELECT
  USING (
    organization_id = auth.get_user_org_id()
    AND auth.get_user_role(organization_id) = 'DELIVERY'
    AND status IN ('READY', 'DELIVERED')
  );

-- ---- ORDER_ITEMS ----

CREATE POLICY "order_items_member_read"
  ON order_items FOR SELECT
  USING (organization_id = auth.get_user_org_id());

CREATE POLICY "order_items_member_insert"
  ON order_items FOR INSERT
  WITH CHECK (organization_id = auth.get_user_org_id());

-- ---- PAYMENTS ----

CREATE POLICY "payments_member_read"
  ON payments FOR SELECT
  USING (organization_id = auth.get_user_org_id());

-- Seuls CASHIER, MANAGER, OWNER peuvent enregistrer un paiement
CREATE POLICY "payments_cashier_insert"
  ON payments FOR INSERT
  WITH CHECK (
    organization_id = auth.get_user_org_id()
    AND auth.has_role_in_org(organization_id, 'OWNER', 'MANAGER', 'CASHIER')
  );

-- AUCUN UPDATE/DELETE sur payments (immuable)

-- ---- CASH_CLOSINGS ----

CREATE POLICY "cash_closings_member_read"
  ON cash_closings FOR SELECT
  USING (organization_id = auth.get_user_org_id());

CREATE POLICY "cash_closings_cashier_write"
  ON cash_closings FOR ALL
  USING (
    organization_id = auth.get_user_org_id()
    AND auth.has_role_in_org(organization_id, 'OWNER', 'MANAGER', 'CASHIER')
  );

-- ---- MESSAGE_TEMPLATES ----

CREATE POLICY "templates_member_read"
  ON message_templates FOR SELECT
  USING (organization_id = auth.get_user_org_id());

CREATE POLICY "templates_owner_manager_write"
  ON message_templates FOR ALL
  USING (
    organization_id = auth.get_user_org_id()
    AND auth.has_role_in_org(organization_id, 'OWNER', 'MANAGER')
  );

-- ---- AUDIT_LOGS ----

-- Lecture seule pour OWNER/MANAGER
CREATE POLICY "audit_owner_manager_read"
  ON audit_logs FOR SELECT
  USING (
    organization_id = auth.get_user_org_id()
    AND auth.has_role_in_org(organization_id, 'OWNER', 'MANAGER')
  );

-- Insertion par triggers uniquement (SECURITY DEFINER)
CREATE POLICY "audit_trigger_insert"
  ON audit_logs FOR INSERT
  WITH CHECK (true); -- géré par SECURITY DEFINER functions

-- ---- RATE_LIMITS ----

CREATE POLICY "rate_limits_anon_insert"
  ON rate_limits FOR INSERT
  WITH CHECK (true); -- accessible par create_order_request (SECURITY DEFINER)

-- ---- TICKET_SEQUENCES & REQUEST_SEQUENCES ----

CREATE POLICY "ticket_seq_member_read"
  ON ticket_sequences FOR SELECT
  USING (organization_id = auth.get_user_org_id());

CREATE POLICY "request_seq_member_read"
  ON request_sequences FOR SELECT
  USING (organization_id = auth.get_user_org_id());

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT USAGE ON SCHEMA public TO authenticated, anon;

-- Tables: authenticated
GRANT SELECT, INSERT, UPDATE ON organizations      TO authenticated;
GRANT SELECT, INSERT, UPDATE ON memberships        TO authenticated;
GRANT SELECT, INSERT, UPDATE ON services           TO authenticated;
GRANT SELECT, INSERT, UPDATE ON customers          TO authenticated;
GRANT SELECT, INSERT, UPDATE ON orders             TO authenticated;
GRANT SELECT, INSERT, UPDATE ON order_items        TO authenticated;
GRANT SELECT, INSERT         ON payments           TO authenticated; -- PAS UPDATE/DELETE
GRANT SELECT, INSERT, UPDATE ON cash_closings      TO authenticated;
GRANT SELECT, INSERT, UPDATE ON message_templates  TO authenticated;
GRANT SELECT                 ON audit_logs         TO authenticated;
GRANT INSERT                 ON audit_logs         TO authenticated; -- pour triggers
GRANT SELECT                 ON order_payment_summary TO authenticated;
GRANT SELECT                 ON platform_admins    TO authenticated;
GRANT SELECT                 ON ticket_sequences   TO authenticated;
GRANT SELECT                 ON request_sequences  TO authenticated;

-- Anon: lecture publique limitée
GRANT SELECT ON organizations TO anon;
GRANT SELECT ON services      TO anon;

-- Fonctions RPC
GRANT EXECUTE ON FUNCTION auth.get_user_org_id()                TO authenticated;
GRANT EXECUTE ON FUNCTION auth.get_user_role(UUID)              TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_member_of(UUID)               TO authenticated;
GRANT EXECUTE ON FUNCTION auth.has_role_in_org(UUID, TEXT[])    TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_platform_admin()              TO authenticated;
GRANT EXECUTE ON FUNCTION assign_request_code(UUID)             TO authenticated;
GRANT EXECUTE ON FUNCTION receive_order_and_assign_ticket(UUID, UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION create_order_request(UUID, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_order_tracking(UUID, TEXT, TEXT)  TO anon, authenticated;
