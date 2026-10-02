-- =============================================================================
-- MIGRATION 003: MULTI-TENANT SAAS ARCHITECTURE & SECURITY POLICIES
-- Multi-tenant isolation via organization_id
-- =============================================================================

-- 1. ORGANIZATIONS TABLE
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  country country_code DEFAULT 'CG',
  phone VARCHAR(20),
  email VARCHAR(255),
  logo_url TEXT,
  currency VARCHAR(10) DEFAULT 'XAF',
  settings JSONB DEFAULT '{
    "currency": "XAF",
    "timezone": "Africa/Brazzaville",
    "taxRate": 0,
    "whatsappEnabled": true,
    "phoneFormat": "CG"
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT org_name_check CHECK (char_length(name) >= 2)
);

-- 2. ORGANIZATION MEMBERS TABLE
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'employee' CHECK (role IN ('owner', 'manager', 'employee', 'caissier')),
  permissions JSONB DEFAULT '[
    {"action": "create_order", "granted": true},
    {"action": "cancel_order", "granted": false},
    {"action": "view_revenue", "granted": false},
    {"action": "manage_team", "granted": false}
  ]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- 3. ADD ORGANIZATION_ID TO EXISTING BUSINESS TABLES
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE revenue_daily ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- 4. NEW PAYMENTS LEDGER (IMMUTABLE)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_method payment_method NOT NULL DEFAULT 'cash',
  notes TEXT,
  is_reversal BOOLEAN DEFAULT false,
  reversal_reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. CASH REGISTERS & SHIFT CLOSING
CREATE TABLE IF NOT EXISTS cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  opened_by UUID NOT NULL REFERENCES auth.users(id),
  closed_by UUID REFERENCES auth.users(id),
  opening_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  closing_balance DECIMAL(10,2),
  expected_balance DECIMAL(10,2),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TICKET SEQUENCE COUNTER TABLE (ATOMIC PER ORGANIZATION)
CREATE TABLE IF NOT EXISTS ticket_sequences (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date_key DATE NOT NULL DEFAULT CURRENT_DATE,
  last_value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (organization_id, date_key)
);

-- 7. HELPER FUNCTIONS FOR MULTI-TENANT SECURITY
CREATE OR REPLACE FUNCTION auth.user_organization_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT organization_id
    FROM organization_members
    WHERE user_id = auth.uid()
      AND is_active = true
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth.is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
      AND organization_id = org_id
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. ATOMIC TICKET GENERATOR FUNCTION
CREATE OR REPLACE FUNCTION generate_atomic_ticket_number(p_org_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_date_prefix TEXT;
  v_next_val INTEGER;
BEGIN
  v_date_prefix := to_char(CURRENT_DATE, 'YYYYMMDD');

  INSERT INTO ticket_sequences (organization_id, date_key, last_value)
  VALUES (p_org_id, CURRENT_DATE, 1)
  ON CONFLICT (organization_id, date_key)
  DO UPDATE SET last_value = ticket_sequences.last_value + 1
  RETURNING last_value INTO v_next_val;

  RETURN 'TICK-' || v_date_prefix || '-' || lpad(v_next_val::text, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. ROW-LEVEL SECURITY (RLS) POLICIES FOR ALL TABLES
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;

-- ORGANIZATIONS RLS
DROP POLICY IF EXISTS "Members can view their organization" ON organizations;
CREATE POLICY "Members can view their organization"
  ON organizations FOR SELECT
  USING (auth.is_org_member(id));

DROP POLICY IF EXISTS "Owners can update their organization" ON organizations;
CREATE POLICY "Owners can update their organization"
  ON organizations FOR UPDATE
  USING (
    auth.is_org_member(id) AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE user_id = auth.uid() AND organization_id = id AND role = 'owner'
    )
  );

-- ORGANIZATION MEMBERS RLS
DROP POLICY IF EXISTS "Members can view same org members" ON organization_members;
CREATE POLICY "Members can view same org members"
  ON organization_members FOR SELECT
  USING (auth.is_org_member(organization_id));

DROP POLICY IF EXISTS "Owners/Managers can manage org members" ON organization_members;
CREATE POLICY "Owners/Managers can manage org members"
  ON organization_members FOR ALL
  USING (
    auth.is_org_member(organization_id) AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE user_id = auth.uid()
        AND organization_id = organization_members.organization_id
        AND role IN ('owner', 'manager')
    )
  );

-- ARTICLES RLS RE-APPLIED WITH ORGANIZATION_ID
DROP POLICY IF EXISTS "Users can view pressing articles" ON articles;
DROP POLICY IF EXISTS "Users can view org articles" ON articles;
CREATE POLICY "Users can view org articles"
  ON articles FOR SELECT
  USING (
    (organization_id = auth.user_organization_id() OR organization_id IS NULL)
    AND is_deleted = false
  );

DROP POLICY IF EXISTS "Authorized users can create articles" ON articles;
DROP POLICY IF EXISTS "Authorized users can create org articles" ON articles;
CREATE POLICY "Authorized users can create org articles"
  ON articles FOR INSERT
  WITH CHECK (
    organization_id = auth.user_organization_id()
  );

-- INVOICES/ORDERS RLS RE-APPLIED WITH ORGANIZATION_ID
DROP POLICY IF EXISTS "Users can view pressing invoices" ON invoices;
DROP POLICY IF EXISTS "Users can view org invoices" ON invoices;
CREATE POLICY "Users can view org invoices"
  ON invoices FOR SELECT
  USING (
    organization_id = auth.user_organization_id() OR pressing_id = auth.user_pressing_id()
  );

DROP POLICY IF EXISTS "Authorized users can create invoices" ON invoices;
DROP POLICY IF EXISTS "Authorized users can create org invoices" ON invoices;
CREATE POLICY "Authorized users can create org invoices"
  ON invoices FOR INSERT
  WITH CHECK (
    organization_id = auth.user_organization_id() OR pressing_id = auth.user_pressing_id()
  );

DROP POLICY IF EXISTS "Users can update org invoices" ON invoices;
CREATE POLICY "Users can update org invoices"
  ON invoices FOR UPDATE
  USING (
    organization_id = auth.user_organization_id() OR pressing_id = auth.user_pressing_id()
  );

-- CLIENTS RLS RE-APPLIED WITH ORGANIZATION_ID
DROP POLICY IF EXISTS "Users can view pressing clients" ON clients;
DROP POLICY IF EXISTS "Users can view org clients" ON clients;
CREATE POLICY "Users can view org clients"
  ON clients FOR SELECT
  USING (
    organization_id = auth.user_organization_id() OR pressing_id = auth.user_pressing_id()
  );

DROP POLICY IF EXISTS "System can manage clients" ON clients;
DROP POLICY IF EXISTS "System can manage org clients" ON clients;
CREATE POLICY "System can manage org clients"
  ON clients FOR ALL
  USING (
    organization_id = auth.user_organization_id() OR pressing_id = auth.user_pressing_id()
  );

-- PAYMENTS RLS
DROP POLICY IF EXISTS "Members can view org payments" ON payments;
CREATE POLICY "Members can view org payments"
  ON payments FOR SELECT
  USING (organization_id = auth.user_organization_id());

DROP POLICY IF EXISTS "Members can insert org payments" ON payments;
CREATE POLICY "Members can insert org payments"
  ON payments FOR INSERT
  WITH CHECK (organization_id = auth.user_organization_id());

-- CASH REGISTERS RLS
DROP POLICY IF EXISTS "Members can view org cash registers" ON cash_registers;
CREATE POLICY "Members can view org cash registers"
  ON cash_registers FOR SELECT
  USING (organization_id = auth.user_organization_id());

DROP POLICY IF EXISTS "Members can manage org cash registers" ON cash_registers;
CREATE POLICY "Members can manage org cash registers"
  ON cash_registers FOR ALL
  USING (organization_id = auth.user_organization_id());

-- GRANTS
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION generate_atomic_ticket_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.user_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_org_member(UUID) TO authenticated;
