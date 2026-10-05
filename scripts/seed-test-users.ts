import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';

const supabaseUrl = process.env.SEED_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const testPassword = process.env.TEST_PASSWORD;

if (process.env.SEED_TEST_USERS !== 'true') {
  throw new Error('Set SEED_TEST_USERS=true to create disposable role test accounts.');
}
if (!supabaseUrl || !serviceRoleKey || !testPassword) {
  throw new Error('SEED_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and TEST_PASSWORD are required.');
}
const host = new URL(supabaseUrl).hostname;
const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
if (!isLocal && process.env.SEED_ALLOW_REMOTE_PROJECT !== 'true') {
  throw new Error('Remote account seeding is disabled. Use a disposable test project and explicitly set SEED_ALLOW_REMOTE_PROJECT=true.');
}

const userDefinitions = [
  { email: process.env.E2E_OWNER_EMAIL, role: 'OWNER', fullName: 'E2E Owner' },
  { email: process.env.E2E_MANAGER_EMAIL, role: 'MANAGER', fullName: 'E2E Manager' },
  { email: process.env.E2E_CASHIER_EMAIL, role: 'CASHIER', fullName: 'E2E Cashier' },
  { email: process.env.E2E_DELIVERY_EMAIL, role: 'DELIVERY', fullName: 'E2E Delivery' },
] as const;

if (userDefinitions.some((user) => !user.email)) {
  throw new Error('Provide the four E2E role emails through E2E_OWNER_EMAIL, E2E_MANAGER_EMAIL, E2E_CASHIER_EMAIL and E2E_DELIVERY_EMAIL.');
}

const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seedUsers() {
  const { data: organization, error: organizationError } = await admin
    .from('organizations')
    .select('id')
    .eq('slug', 'lb-pressing')
    .eq('is_active', true)
    .single();
  if (organizationError || !organization) throw new Error('Active LB Pressing organization not found.');

  const { data: userPage, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) throw usersError;

  for (const definition of userDefinitions) {
    const email = definition.email!.trim().toLowerCase();
    let user = userPage.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: testPassword,
        email_confirm: true,
        user_metadata: { full_name: definition.fullName },
      });
      if (error || !data.user) throw error || new Error(`Could not create E2E account ${email}.`);
      user = data.user;
    }

    const { error: membershipError } = await admin.from('memberships').upsert({
      user_id: user.id,
      organization_id: organization.id,
      role: definition.role,
      full_name: definition.fullName,
      is_active: true,
    }, { onConflict: 'user_id,organization_id' });
    if (membershipError) throw membershipError;
    console.log(`Configured role test membership for ${email} (${definition.role}). Existing account passwords are never reset.`);
  }
}

seedUsers().catch((error: unknown) => {
  console.error('E2E account setup failed:', error instanceof Error ? error.message : 'Unknown error.');
  process.exitCode = 1;
});
