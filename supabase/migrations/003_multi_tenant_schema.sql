-- =============================================================================
-- MIGRATION 003: MULTI-TENANT SAAS ARCHITECTURE & SECURITY POLICIES
-- Multi-tenant isolation via organization_id
-- =============================================================================

-- 1. ORGANIZATIONS TABLE
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  ticket_prefix VARCHAR(10) NOT NULL DEFAULT 'LB',
  country VARCHAR(10) DEFAULT 'CG',
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

-- 2. ORGANIZATION MEMBERS TABLE WITH UNIFIED ROLES
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'cashier' CHECK (role IN ('owner', 'manager', 'cashier', 'delivery')),
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
  payment_method VARCHAR(20) NOT NULL DEFAULT 'cash',
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

-- 6. PERSISTENT NON-RESETTING TICKET SEQUENCE COUNTER TABLE (PER ORGANIZATION)
CREATE TABLE IF NOT EXISTS ticket_sequences (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  last_value INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

-- 8. ATOMIC FUNCTION: RECEIVE ORDER AND ASSIGN PERSISTENT OFFICIAL TICKET
CREATE OR REPLACE FUNCTION receive_order_and_assign_ticket(
  p_order_id UUID,
  p_org_id UUID
)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_next_val INTEGER;
  v_ticket_number TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Verify order exists for organization FIRST before incrementing sequence
  SELECT EXISTS (
    SELECT 1 FROM invoices
    WHERE id = p_order_id AND organization_id = p_org_id
  ) INTO v_exists;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'Order % not found for organization %', p_order_id, p_org_id;
  END IF;

  -- Get organization prefix
  SELECT ticket_prefix INTO v_prefix
  FROM organizations
  WHERE id = p_org_id;

  IF v_prefix IS NULL THEN
    v_prefix := 'LB';
  END IF;

  -- Lock and update persistent ticket sequence counter atomically
  INSERT INTO ticket_sequences (organization_id, last_value, updated_at)
  VALUES (p_org_id, 1, NOW())
  ON CONFLICT (organization_id)
  DO UPDATE SET
    last_value = ticket_sequences.last_value + 1,
    updated_at = NOW()
  RETURNING last_value INTO v_next_val;

  -- Format persistent ticket e.g., "LB-0001"
  v_ticket_number := v_prefix || '-' || LPAD(v_next_val::TEXT, 4, '0');

  -- Atomically update invoice/order with official ticket and RECEIVED state
  UPDATE invoices
  SET
    number = v_ticket_number,
    status = 'active',
    updated_at = NOW()
  WHERE id = p_order_id
    AND organization_id = p_org_id;

  RETURN v_ticket_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. STRICT ROW-LEVEL SECURITY (RLS) POLICIES BY ORGANIZATION_ID ONLY
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
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

-- ARTICLES STRICT RLS BY ORGANIZATION_ID
DROP POLICY IF EXISTS "Users can view org articles" ON articles;
CREATE POLICY "Users can view org articles"
  ON articles FOR SELECT
  USING (
    organization_id = auth.user_organization_id() OR organization_id IS NULL
  );

DROP POLICY IF EXISTS "Authorized users can create org articles" ON articles;
CREATE POLICY "Authorized users can create org articles"
  ON articles FOR INSERT
  WITH CHECK (
    organization_id = auth.user_organization_id()
  );

DROP POLICY IF EXISTS "Authorized users can update org articles" ON articles;
CREATE POLICY "Authorized users can update org articles"
  ON articles FOR UPDATE
  USING (
    organization_id = auth.user_organization_id()
  );

-- INVOICES/ORDERS STRICT RLS BY ORGANIZATION_ID
DROP POLICY IF EXISTS "Users can view org invoices" ON invoices;
CREATE POLICY "Users can view org invoices"
  ON invoices FOR SELECT
  USING (
    organization_id = auth.user_organization_id()
  );

DROP POLICY IF EXISTS "Authorized users can create org invoices" ON invoices;
CREATE POLICY "Authorized users can create org invoices"
  ON invoices FOR INSERT
  WITH CHECK (
    organization_id = auth.user_organization_id()
  );

DROP POLICY IF EXISTS "Users can update org invoices" ON invoices;
CREATE POLICY "Users can update org invoices"
  ON invoices FOR UPDATE
  USING (
    organization_id = auth.user_organization_id()
  );

-- CLIENTS STRICT RLS BY ORGANIZATION_ID
DROP POLICY IF EXISTS "Users can view org clients" ON clients;
CREATE POLICY "Users can view org clients"
  ON clients FOR SELECT
  USING (
    organization_id = auth.user_organization_id()
  );

DROP POLICY IF EXISTS "System can manage org clients" ON clients;
CREATE POLICY "System can manage org clients"
  ON clients FOR ALL
  USING (
    organization_id = auth.user_organization_id()
  );

-- PAYMENTS STRICT RLS BY ORGANIZATION_ID
DROP POLICY IF EXISTS "Members can view org payments" ON payments;
CREATE POLICY "Members can view org payments"
  ON payments FOR SELECT
  USING (organization_id = auth.user_organization_id());

DROP POLICY IF EXISTS "Members can insert org payments" ON payments;
CREATE POLICY "Members can insert org payments"
  ON payments FOR INSERT
  WITH CHECK (organization_id = auth.user_organization_id());

-- CASH REGISTERS STRICT RLS BY ORGANIZATION_ID
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
GRANT EXECUTE ON FUNCTION receive_order_and_assign_ticket(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.user_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_org_member(UUID) TO authenticated;
