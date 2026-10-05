import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import bcrypt from 'bcryptjs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyA...';
const DB_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/postgres';
const LB_ORG_ID = '11111111-1111-1111-1111-111111111111';
const PASSWORD = process.env.TEST_PASSWORD;

if (!PASSWORD) {
  throw new Error('TEST_PASSWORD environment variable is required.');
}

interface UserSeedDef {
  email: string;
  role: 'OWNER' | 'MANAGER' | 'CASHIER' | 'DELIVERY';
  fullName: string;
}

const USERS_TO_SEED: UserSeedDef[] = [
  { email: 'obusiness715@gmail.com', role: 'OWNER', fullName: 'Propriétaire LB' },
  { email: 'manager@lb-pressing.cg', role: 'MANAGER', fullName: 'Gestionnaire LB' },
  { email: 'cashier@lb-pressing.cg', role: 'CASHIER', fullName: 'Caissier LB' },
  { email: 'delivery@lb-pressing.cg', role: 'DELIVERY', fullName: 'Livreur LB' },
];

async function seedUsers() {
  console.log('--- SEEDING SUPABASE AUTH USERS & MEMBERSHIPS FOR LB PRESSING ---');

  // Try using Supabase Auth Admin API
  const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const pg = new Client({ connectionString: DB_URL });
  let pgConnected = false;

  for (const u of USERS_TO_SEED) {
    console.log(`Processing user: ${u.email} (${u.role})...`);
    let userId: string | null = null;

    try {
      const { data, error } = await adminSupabase.auth.admin.createUser({
        email: u.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: u.fullName },
      });

      if (!error && data.user) {
        userId = data.user.id;
      }
    } catch (e) {
      // API call failed, fallback to SQL
    }

    if (!userId) {
      if (!pgConnected) {
        await pg.connect();
        pgConnected = true;
      }

      await pg.query(`
        CREATE TABLE IF NOT EXISTS auth.identities (
          id TEXT NOT NULL,
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          identity_data JSONB NOT NULL,
          provider TEXT NOT NULL,
          last_sign_in_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          email TEXT GENERATED ALWAYS AS (lower(identity_data->>'email')) STORED,
          PRIMARY KEY (provider, id)
        );
      `);

      const encryptedPassword = bcrypt.hashSync(PASSWORD!, 10);
      const existingUserRes = await pg.query('SELECT id FROM auth.users WHERE lower(email) = lower($1)', [u.email]);

      if (existingUserRes.rows.length > 0) {
        userId = existingUserRes.rows[0].id;
        await pg.query(
          `UPDATE auth.users SET encrypted_password = $1, email_confirmed_at = NOW(), raw_user_meta_data = $2, updated_at = NOW() WHERE id = $3`,
          [encryptedPassword, JSON.stringify({ full_name: u.fullName }), userId]
        );
      } else {
        const insertUserRes = await pg.query(
          `INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data)
           VALUES ($1, $2, NOW(), $3, $4) RETURNING id`,
          [u.email.toLowerCase(), encryptedPassword, JSON.stringify({ full_name: u.fullName }), JSON.stringify({ provider: 'email', providers: ['email'] })]
        );
        userId = insertUserRes.rows[0].id;
      }

      await pg.query(
        `INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
         VALUES ($1, $2, $3, 'email', NOW(), NOW(), NOW())
         ON CONFLICT (provider, id) DO UPDATE SET identity_data = EXCLUDED.identity_data, updated_at = NOW()`,
        [userId, userId, JSON.stringify({ sub: userId, email: u.email.toLowerCase() })]
      );
    }

    if (userId) {
      if (!pgConnected) {
        await pg.connect();
        pgConnected = true;
      }
      await pg.query(
        `INSERT INTO memberships (user_id, organization_id, role, full_name, is_active)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (user_id, organization_id)
         DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name, is_active = true, updated_at = NOW()`,
        [userId, LB_ORG_ID, u.role, u.fullName]
      );
      console.log(`Successfully configured Auth User, Identity & Membership: ID=${userId}, Email=${u.email}, Role=${u.role}`);
    }
  }

  if (pgConnected) {
    await pg.end();
  }

  console.log('\n✅ ALL 4 TEST USERS, IDENTITIES & MEMBERSHIPS SUCCESSFULLY CREATED / UPDATED IN LB PRESSING.');
}

seedUsers();
