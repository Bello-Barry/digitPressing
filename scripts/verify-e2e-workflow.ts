import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';
import jwt from 'jsonwebtoken';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || jwt.sign({ role: 'anon', iss: 'supabase' }, JWT_SECRET);
const LB_ORG_ID = '11111111-1111-1111-1111-111111111111';
const PASSWORD = process.env.TEST_PASSWORD;

if (!PASSWORD) {
  throw new Error('TEST_PASSWORD environment variable is required.');
}

async function runE2EWorkflowTest() {
  console.log('=============================================================================');
  console.log('  LB PRESSING REAL END-TO-END (E2E) BUSINESS WORKFLOW TEST');
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

  const publicClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

  const cashierAnon = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: cashierAuth } = await cashierAnon.auth.signInWithPassword({
    email: 'cashier@lb-pressing.cg',
    password: PASSWORD!,
  });
  const cashierClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${cashierAuth.session?.access_token}` } },
  });

  const ownerAnon = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: ownerAuth } = await ownerAnon.auth.signInWithPassword({
    email: 'obusiness715@gmail.com',
    password: PASSWORD!,
  });
  const ownerClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${ownerAuth.session?.access_token}` } },
  });

  const cashierUserId = cashierAuth.user?.id || '';

  // STEP 1: CLIENT CREATES PUBLIC ORDER REQUEST
  console.log('--- STEP 1: PUBLIC CLIENT ORDER REQUEST ---');
  const { data: createRes, error: createErr } = await (publicClient.rpc as any)('create_order_request', {
    p_org_id: LB_ORG_ID,
    p_client_name: 'Madame Mireille',
    p_client_phone: '+242065554433',
    p_items: [
      { service_name: 'Costume 2 pièces', unit_price: 15000, quantity: 1 },
      { service_name: 'Chemise homme', unit_price: 5000, quantity: 2 },
    ],
    p_mode: 'DROP_OFF',
    p_notes: 'Attention au col de la chemise',
  });

  if (createErr) {
    console.error('RPC Error:', createErr);
  }

  const resObj = typeof createRes === 'string' ? JSON.parse(createRes) : createRes;
  const orderId = resObj?.order_id;
  const requestCode = resObj?.request_code;
  const totalAmount = resObj?.total_amount;

  assert(
    !createErr && Boolean(orderId) && Boolean(requestCode?.startsWith('D-')),
    '1. Public Order Request Creation',
    `Created request ID=${orderId}, Code=${requestCode}, Total=${totalAmount} XAF`
  );

  if (!orderId) {
    console.error('orderId is undefined! Stopping workflow.');
    return;
  }

  // Verify that REQUEST status order has NO ticket number yet
  const { data: requestOrder } = await ownerClient.from('orders').select('*').eq('id', orderId).single();
  assert(
    requestOrder?.status === 'REQUEST' && requestOrder?.ticket_number === null,
    '2. REQUEST Status Has NO Official Ticket',
    `Status=${requestOrder?.status}, TicketNumber=${requestOrder?.ticket_number}`
  );

  // Verify that REQUEST status does NOT generate revenue
  const { data: initialPayments } = await ownerClient.from('payments').select('amount').eq('order_id', orderId);
  const initialRev = initialPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  assert(
    initialRev === 0,
    '3. REQUEST Status Generates 0 CA / Revenue',
    `Initial payments sum = ${initialRev} XAF`
  );

  // STEP 2: CASHIER VALIDATES REQUEST AND RECEIVES ITEMS (TICKET ATTRIBUTION)
  console.log('\n--- STEP 2: VALIDATION & ATOMIC TICKET ATTRIBUTION (RECEIVED) ---');
  const { error: valErr } = await cashierClient
    .from('orders')
    .update({ status: 'VALIDATED', validated_by: cashierUserId } as any)
    .eq('id', orderId);

  assert(!valErr, '4. CASHIER Validates Request (REQUEST -> VALIDATED)', 'Order status set to VALIDATED');

  // Receive items and assign atomic official ticket
  const { data: ticketRes, error: ticketErr } = await (cashierClient.rpc as any)('receive_order_and_assign_ticket', {
    p_order_id: orderId,
    p_org_id: LB_ORG_ID,
    p_user_id: cashierUserId,
    p_items_count: 3,
  });

  const ticketNumber = typeof ticketRes === 'string' ? ticketRes : (ticketRes as any)?.ticket_number || ticketRes;

  assert(
    !ticketErr && Boolean(ticketNumber && String(ticketNumber).startsWith('LB-')),
    '5. Atomic Ticket Attribution at RECEIVED',
    `Official Ticket Assigned = ${ticketNumber}`
  );

  // Verify ticket sequence is persistent across orders
  const { data: createRes2 } = await (publicClient.rpc as any)('create_order_request', {
    p_org_id: LB_ORG_ID,
    p_client_name: 'Monsieur Paul',
    p_client_phone: '+242068889900',
    p_items: [{ service_name: 'Pantalon homme', unit_price: 7000, quantity: 1 }],
  });
  const resObj2 = typeof createRes2 === 'string' ? JSON.parse(createRes2) : createRes2;
  const orderId2 = resObj2?.order_id;
  await cashierClient.from('orders').update({ status: 'VALIDATED' } as any).eq('id', orderId2);
  const { data: ticketRes2 } = await (cashierClient.rpc as any)('receive_order_and_assign_ticket', {
    p_order_id: orderId2,
    p_org_id: LB_ORG_ID,
    p_user_id: cashierUserId,
    p_items_count: 1,
  });
  const ticketNumber2 = typeof ticketRes2 === 'string' ? ticketRes2 : (ticketRes2 as any)?.ticket_number || ticketRes2;

  const seq1 = parseInt(String(ticketNumber).replace('LB-', ''), 10);
  const seq2 = parseInt(String(ticketNumber2).replace('LB-', ''), 10);
  assert(
    seq2 === seq1 + 1,
    '6. Persistent Non-Resetting Ticket Sequence Counter',
    `Ticket 1 = ${ticketNumber}, Ticket 2 = ${ticketNumber2}`
  );

  // STEP 3: PAYMENTS & DYNAMICALLY DERIVED FINANCIALS
  console.log('\n--- STEP 3: IMMUTABLE PAYMENTS & DERIVED FINANCIAL BALANCES ---');
  // Record partial payment of 10,000 XAF
  const { data: pay1, error: pay1Err } = await cashierClient
    .from('payments')
    .insert({
      organization_id: LB_ORG_ID,
      order_id: orderId,
      amount: 10000,
      method: 'CASH',
      collected_by: cashierUserId,
      notes: 'Acompte espèces',
    } as any)
    .select()
    .single();

  assert(!pay1Err && Boolean((pay1 as any)?.id), '7. Record Partial Payment (Acompte)', `Payment ID=${(pay1 as any)?.id}, Amount=10000 XAF`);

  // Verify derived paid_amount and balance_due from order_payment_summary view
  const { data: summary1 } = await ownerClient.from('order_payment_summary').select('*').eq('order_id', orderId).single();
  assert(
    Number(summary1?.paid_amount) === 10000 && Number(summary1?.balance_due) === 15000,
    '8. Derived Financial Summary (paid_amount & balance_due)',
    `Total=25000, Paid=${summary1?.paid_amount}, BalanceDue=${summary1?.balance_due}`
  );

  // Record inverse compensating entry (reversal) of -2,000 XAF for correction
  const { error: revErr } = await cashierClient.from('payments').insert({
    organization_id: LB_ORG_ID,
    order_id: orderId,
    amount: -2000,
    method: 'CASH',
    collected_by: cashierUserId,
    is_reversal: true,
    reversal_reason: 'Correction erreur de saisie acompte',
  } as any);

  assert(!revErr, '9. Compensating Inverse Payment Entry (Correction)', 'Inserted reversal entry of -2000 XAF with reason');

  const { data: summary2 } = await ownerClient.from('order_payment_summary').select('*').eq('order_id', orderId).single();
  assert(
    Number(summary2?.paid_amount) === 8000 && Number(summary2?.balance_due) === 17000,
    '10. Derived Balance Updated After Reversal',
    `Updated Paid=${summary2?.paid_amount}, BalanceDue=${summary2?.balance_due}`
  );

  // Pay remaining 17,000 XAF via MTN MoMo
  await cashierClient.from('payments').insert({
    organization_id: LB_ORG_ID,
    order_id: orderId,
    amount: 17000,
    method: 'MTN_MOMO',
    collected_by: cashierUserId,
    reference: 'MOMO-998877',
  } as any);

  const { data: summary3 } = await ownerClient.from('order_payment_summary').select('*').eq('order_id', orderId).single();
  assert(
    Number(summary3?.paid_amount) === 25000 && Number(summary3?.balance_due) === 0,
    '11. Order Fully Paid (Balance Due = 0)',
    `Final Paid=${summary3?.paid_amount}, BalanceDue=${summary3?.balance_due}`
  );

  // STEP 4: PROCESSING -> READY -> DELIVERED & AUDIT LOGGING
  console.log('\n--- STEP 4: PROCESSING, DELIVERY OVERRIDE CHECK & AUDIT TRAIL ---');
  await cashierClient.from('orders').update({ status: 'PROCESSING' } as any).eq('id', orderId);
  await cashierClient.from('orders').update({ status: 'READY' } as any).eq('id', orderId);
  await cashierClient.from('orders').update({ status: 'DELIVERED', delivered_by: cashierUserId } as any).eq('id', orderId);

  const { data: finalOrder } = await ownerClient.from('orders').select('*').eq('id', orderId).single();
  assert(finalOrder?.status === 'DELIVERED', '12. Order Transition to DELIVERED', `Final Status = ${finalOrder?.status}`);

  // Check audit logs trigger automatically recorded changes
  const { data: auditLogs } = await ownerClient.from('audit_logs').select('*').eq('record_id', orderId);
  assert(
    Boolean(auditLogs && auditLogs.length > 0),
    '13. Automatic PostgreSQL Audit Log Recording',
    `Recorded ${auditLogs?.length || 0} audit log entries for sensitive order operations`
  );

  console.log(`\n=============================================================================`);
  console.log(`  E2E WORKFLOW SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log(`=============================================================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runE2EWorkflowTest();
