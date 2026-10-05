import { createClient } from '@supabase/supabase-js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} to run the authenticated RLS read check.`);
  return value;
}

async function main() {
  const url = required('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = required('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const credentials = [
    { email: required('RLS_USER_A_EMAIL'), password: required('RLS_USER_A_PASSWORD') },
    { email: required('RLS_USER_B_EMAIL'), password: required('RLS_USER_B_PASSWORD') },
  ];

  const clients = credentials.map(() => createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));
  const sessions = await Promise.all(clients.map((client, index) =>
    client.auth.signInWithPassword(credentials[index])
  ));
  for (const { error } of sessions) {
    if (error) throw new Error(`RLS test login failed: ${error.message}`);
  }

  const memberships = await Promise.all(clients.map(async (client) => {
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) throw new Error('RLS test account did not produce an authenticated user.');
    const { data, error } = await client.from('memberships')
      .select('organization_id').eq('user_id', user.id).eq('is_active', true);
    if (error) throw new Error(`Unable to load test-user memberships: ${error.message}`);
    const orgIds = [...new Set((data ?? []).map((row) => row.organization_id))];
    if (orgIds.length !== 1) throw new Error('Each RLS test account must have exactly one active organization membership.');
    return orgIds[0];
  }));

  if (memberships[0] === memberships[1]) {
    throw new Error('RLS test accounts must belong to different organizations.');
  }

  for (const [index, client] of clients.entries()) {
    const foreignOrgId = memberships[1 - index];
    for (const table of ['orders', 'customers', 'payments'] as const) {
      const { data, error } = await client.from(table).select('id')
        .eq('organization_id', foreignOrgId).limit(1);
      if (error) throw new Error(`${table} RLS query failed: ${error.message}`);
      if ((data ?? []).length > 0) throw new Error(`RLS FAILURE: account ${index + 1} read ${table} from another organization.`);
      console.log(`[PASS] account ${index + 1} cannot read foreign-tenant ${table}`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
