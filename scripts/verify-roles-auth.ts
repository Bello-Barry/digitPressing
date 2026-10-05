import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkxMTkzODMxfQ.5nbS45dHGIJdxArBYQzpPIf6DEe-KglIJdkuCQfJVZU';
const LB_ORG_ID = '11111111-1111-1111-1111-111111111111';
const PASSWORD = process.env.TEST_PASSWORD;

if (!PASSWORD) {
  throw new Error('TEST_PASSWORD environment variable is required.');
}

interface RoleTestConfig {
  email: string;
  expectedRole: 'OWNER' | 'MANAGER' | 'CASHIER' | 'DELIVERY';
}

const TEST_ACCOUNTS: RoleTestConfig[] = [
  { email: 'obusiness715@gmail.com', expectedRole: 'OWNER' },
  { email: 'manager@lb-pressing.cg', expectedRole: 'MANAGER' },
  { email: 'cashier@lb-pressing.cg', expectedRole: 'CASHIER' },
  { email: 'delivery@lb-pressing.cg', expectedRole: 'DELIVERY' },
];

async function runRoleVerification() {
  console.log('=============================================================================');
  console.log('  REAL AUTHENTICATION, MIDDLEWARE & RLS ROLE VERIFICATION SUITE');
  console.log('=============================================================================\n');

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, testName: string, details: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${testName}`);
      console.log(`     └─ ${details}`);
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      console.error(`     └─ ${details}`);
    }
  }

  const clientsByRole: Record<string, SupabaseClient<Database>> = {};

  for (const acc of TEST_ACCOUNTS) {
    console.log(`\n-----------------------------------------------------------------------------`);
    console.log(` TESTING ROLE: ${acc.expectedRole} (${acc.email})`);
    console.log(`-----------------------------------------------------------------------------`);

    const anonClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

    // 1. Authenticate via Supabase Auth
    const { data: authData, error: authErr } = await anonClient.auth.signInWithPassword({
      email: acc.email,
      password: PASSWORD!,
    });

    assert(
      !authErr && Boolean(authData.session?.access_token),
      `Supabase Auth Login (${acc.expectedRole})`,
      authErr ? authErr.message : `Received valid JWT access token for ${authData.user?.id}`
    );

    if (!authData.session) continue;

    // Create authenticated client with user JWT token
    const authClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${authData.session.access_token}`,
        },
      },
    });

    clientsByRole[acc.expectedRole] = authClient;

    // 2. Membership and Role Retrieval
    const { data: memData, error: memErr } = await authClient
      .from('memberships')
      .select('id, organization_id, role, full_name, is_active')
      .eq('user_id', authData.user.id)
      .eq('is_active', true)
      .single();

    assert(
      !memErr && memData?.role === acc.expectedRole && memData?.organization_id === LB_ORG_ID,
      `Real Membership & Role Verification (${acc.expectedRole})`,
      memErr
        ? memErr.message
        : `Verified membership ID=${memData?.id}, Org=${memData?.organization_id}, Role=${memData?.role}`
    );

    // 3. Role Specific Access Checks & RLS Verification
    if (acc.expectedRole === 'OWNER') {
      // OWNER should read audit logs
      const { data: auditData, error: auditErr } = await authClient.from('audit_logs').select('*');
      assert(
        !auditErr,
        'OWNER Audit Logs Access',
        `Successfully queried audit_logs (returned ${auditData?.length || 0} rows)`
      );

      // OWNER should read services and pricing
      const { data: servicesData, error: servicesErr } = await authClient.from('services').select('*');
      assert(
        !servicesErr && (servicesData?.length || 0) > 0,
        'OWNER Services & Administration Access',
        `Access to full services catalog (${servicesData?.length} items)`
      );
    }

    if (acc.expectedRole === 'MANAGER') {
      // MANAGER should read orders and services
      const { data: ordersData, error: ordersErr } = await authClient.from('orders').select('*');
      assert(
        !ordersErr,
        'MANAGER Orders Access',
        `Successfully retrieved orders list (${ordersData?.length || 0} orders)`
      );

      // MANAGER should read audit logs
      const { data: auditData, error: auditErr } = await authClient.from('audit_logs').select('*');
      assert(
        !auditErr,
        'MANAGER Audit Logs Access',
        `MANAGER authorized to read audit logs (${auditData?.length || 0} rows)`
      );
    }

    if (acc.expectedRole === 'CASHIER') {
      // CASHIER should read orders
      const { data: ordersData, error: ordersErr } = await authClient.from('orders').select('*');
      assert(
        !ordersErr,
        'CASHIER Orders & POS Access',
        `CASHIER authorized to access active orders list (${ordersData?.length || 0} orders)`
      );

      // CASHIER should BE BLOCKED from reading audit logs
      const { data: auditData, error: auditErr } = await authClient.from('audit_logs').select('*');
      const isBlocked = auditErr !== null || !auditData || auditData.length === 0;
      assert(
        isBlocked,
        'CASHIER Audit Logs Restriction (RLS Enforced)',
        isBlocked
          ? 'RLS policy correctly blocked CASHIER from accessing audit_logs'
          : 'SECURITY FAILURE: CASHIER accessed audit logs!'
      );
    }

    if (acc.expectedRole === 'DELIVERY') {
      // DELIVERY should BE BLOCKED from reading audit logs
      const { data: auditData, error: auditErr } = await authClient.from('audit_logs').select('*');
      const auditBlocked = auditErr !== null || !auditData || auditData.length === 0;
      assert(
        auditBlocked,
        'DELIVERY Audit Logs Restriction (RLS Enforced)',
        auditBlocked
          ? 'RLS policy correctly blocked DELIVERY from audit_logs'
          : 'SECURITY FAILURE: DELIVERY accessed audit logs!'
      );
    }
  }

  console.log(`\n=============================================================================`);
  console.log(`  VERIFICATION SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log(`=============================================================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runRoleVerification();
