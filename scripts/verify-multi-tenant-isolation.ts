import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import type { Database } from '../src/types/supabase';
import jwt from 'jsonwebtoken';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || jwt.sign({ role: 'anon', iss: 'supabase' }, JWT_SECRET);
const DB_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/postgres';
const PASSWORD = process.env.TEST_PASSWORD;

if (!PASSWORD) {
  throw new Error('TEST_PASSWORD environment variable is required.');
}

const ORG_A_ID = '11111111-1111-1111-1111-111111111111'; // LB Pressing
const ORG_B_ID = '22222222-2222-2222-2222-222222222222'; // DEMO Pressing

async function runMultiTenantIsolationTest() {
  console.log('=============================================================================');
  console.log('  MULTI-TENANT CROSS-TENANT REAL RLS DATA ISOLATION TEST');
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

  // 1. Seed DEMO Organization & User B in Organization B
  const pg = new Client({ connectionString: DB_URL });
  await pg.connect();

  await pg.query(`
    INSERT INTO organizations (id, name, slug, ticket_prefix, country_code, is_active)
    VALUES ('${ORG_B_ID}', 'DEMO Pressing', 'demo-pressing', 'DM', '242', true)
    ON CONFLICT (slug) DO NOTHING;
  `);

  // Insert DEMO order into Organization B
  const demoOrderRes = await pg.query(`
    INSERT INTO orders (
      organization_id, client_name, client_phone, status, subtotal, total_amount, ticket_number
    ) VALUES (
      '${ORG_B_ID}', 'Client Confidential Org B', '+242069990011', 'RECEIVED', 12000, 12000, 'DM-0001'
    ) RETURNING id;
  `);
  const demoOrderId = demoOrderRes.rows[0]?.id;
  await pg.end();

  // 2. Authenticate as User A (OWNER of Org A - LB Pressing)
  const anonClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: userAAuth } = await anonClient.auth.signInWithPassword({
    email: 'obusiness715@gmail.com',
    password: PASSWORD!,
  });

  const clientUserA = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${userAAuth.session?.access_token}`,
      },
    },
  });

  // TEST 1: Cross-Tenant Read Prevention (Org A user reads Org B orders)
  const { data: orgBOrders, error: readErr } = await clientUserA
    .from('orders')
    .select('*')
    .eq('organization_id', ORG_B_ID);

  const isReadIsolated = (!orgBOrders || orgBOrders.length === 0) || readErr !== null;
  assert(
    isReadIsolated,
    'Cross-Tenant Read Prevention (Org A -> Org B Orders)',
    `User A (LB Pressing) queried Org B orders: received ${orgBOrders?.length || 0} rows`
  );

  // TEST 2: Direct UUID Lookup on Foreign Tenant Resource
  const { data: foreignOrder } = await clientUserA
    .from('orders')
    .select('*')
    .eq('id', demoOrderId)
    .maybeSingle();

  const isUuidIsolated = foreignOrder === null;
  assert(
    isUuidIsolated,
    'Direct Foreign UUID Lookup Access Prevention',
    `User A queried DEMO Order ID ${demoOrderId}: result is ${foreignOrder}`
  );

  // TEST 3: Cross-Tenant Update Prevention
  const { data: updateRes, error: updateErr } = await clientUserA
    .from('orders')
    .update({ status: 'CANCELLED' } as any)
    .eq('id', demoOrderId)
    .select();

  const isUpdatePrevented = (!updateRes || updateRes.length === 0) || updateErr !== null;
  assert(
    isUpdatePrevented,
    'Cross-Tenant Update Prevention (Org A -> Org B)',
    `User A attempted to cancel Org B order: 0 rows modified`
  );

  // TEST 4: Cross-Tenant Delete Prevention
  const { data: deleteRes, error: deleteErr } = await clientUserA
    .from('orders')
    .delete()
    .eq('id', demoOrderId)
    .select();

  const isDeletePrevented = (!deleteRes || deleteRes.length === 0) || deleteErr !== null;
  assert(
    isDeletePrevented,
    'Cross-Tenant Delete Prevention (Org A -> Org B)',
    `User A attempted to delete Org B order: 0 rows deleted`
  );

  console.log(`\n=============================================================================`);
  console.log(`  ISOLATION SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log(`=============================================================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runMultiTenantIsolationTest();
