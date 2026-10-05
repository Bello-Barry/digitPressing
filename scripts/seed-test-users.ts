import { Client } from 'pg';
import bcrypt from 'bcryptjs';

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
  const pg = new Client({ connectionString: DB_URL });
  await pg.connect();

  try {
    const encryptedPassword = bcrypt.hashSync(PASSWORD!, 10);

    for (const u of USERS_TO_SEED) {
      console.log(`Processing user: ${u.email} (${u.role})...`);

      // 1. Check if user already exists in auth.users
      const existingUserRes = await pg.query('SELECT id FROM auth.users WHERE lower(email) = lower($1)', [u.email]);

      let userId: string;

      if (existingUserRes.rows.length > 0) {
        userId = existingUserRes.rows[0].id;
        // Update password and metadata for existing user
        await pg.query(
          `UPDATE auth.users SET
            encrypted_password = $1,
            email_confirmed_at = NOW(),
            raw_user_meta_data = $2,
            updated_at = NOW()
          WHERE id = $3`,
          [
            encryptedPassword,
            JSON.stringify({ full_name: u.fullName }),
            userId,
          ]
        );

        // Upsert membership
        await pg.query(
          `INSERT INTO memberships (
            user_id, organization_id, role, full_name, is_active
          ) VALUES (
            $1, $2, $3, $4, true
          ) ON CONFLICT (user_id, organization_id)
          DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name, is_active = true, updated_at = NOW()`,
          [userId, LB_ORG_ID, u.role, u.fullName]
        );

        console.log(`Updated Auth User & Membership: ID=${userId}, Email=${u.email}, Role=${u.role}`);
      } else {
        // Insert new user into auth.users
        const insertUserRes = await pg.query(
          `INSERT INTO auth.users (
            email, encrypted_password, email_confirmed_at,
            raw_user_meta_data, raw_app_meta_data
          ) VALUES (
            $1, $2, NOW(),
            $3, $4
          ) RETURNING id`,
          [
            u.email.toLowerCase(),
            encryptedPassword,
            JSON.stringify({ full_name: u.fullName }),
            JSON.stringify({ provider: 'email', providers: ['email'] }),
          ]
        );

        userId = insertUserRes.rows[0].id;

        // Insert real membership into memberships table
        await pg.query(
          `INSERT INTO memberships (
            user_id, organization_id, role, full_name, is_active
          ) VALUES (
            $1, $2, $3, $4, true
          )`,
          [userId, LB_ORG_ID, u.role, u.fullName]
        );

        console.log(`Successfully created Auth User & Membership: ID=${userId}, Email=${u.email}, Role=${u.role}`);
      }
    }

    console.log('\n✅ ALL 4 TEST USERS & MEMBERSHIPS SUCCESSFULLY CREATED / UPDATED IN LB PRESSING.');
  } catch (err: any) {
    console.error('❌ Error seeding users:', err);
    process.exit(1);
  } finally {
    await pg.end();
  }
}

seedUsers();
