import { readFileSync } from 'node:fs';

export interface E2EConfig {
  baseUrl: string;
  password: string;
  ownerEmail: string;
  managerEmail: string;
  cashierEmail: string;
  deliveryEmail: string;
  customerPhone1: string;
  customerPhone2: string;
  databaseUrl?: string;
}

function readDotEnvValue(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  try {
    const line = readFileSync('.env', 'utf8').split(/\r?\n/).find((value) => value.startsWith(`${name}=`));
    return line?.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, '');
  } catch {
    return undefined;
  }
}

function isLoopback(value: string): boolean {
  const hostname = new URL(value).hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function requireE2EConfig(options: { requireDatabase?: boolean } = {}): E2EConfig {
  const baseUrl = process.env.E2E_BASE_URL;
  const password = process.env.E2E_TEST_PASSWORD;
  const ownerEmail = process.env.E2E_OWNER_EMAIL;
  const managerEmail = process.env.E2E_MANAGER_EMAIL;
  const cashierEmail = process.env.E2E_CASHIER_EMAIL;
  const deliveryEmail = process.env.E2E_DELIVERY_EMAIL;
  const customerPhone1 = process.env.E2E_CUSTOMER_PHONE_1;
  const customerPhone2 = process.env.E2E_CUSTOMER_PHONE_2;
  const databaseUrl = process.env.E2E_DATABASE_URL;

  if (process.env.E2E_ALLOW_WRITES !== 'true') {
    throw new Error('E2E tests write orders, staff, or service records. Set E2E_ALLOW_WRITES=true only for a disposable test environment.');
  }
  if (!baseUrl || !password || !ownerEmail || !managerEmail || !cashierEmail || !deliveryEmail || !customerPhone1 || !customerPhone2) {
    throw new Error('Set the E2E base URL, role credentials and two dedicated E2E customer phone numbers.');
  }
  if (!/^https?:\/\//.test(baseUrl)) throw new Error('E2E_BASE_URL must be an http(s) URL.');
  if (options.requireDatabase && !databaseUrl) {
    throw new Error('Set E2E_DATABASE_URL to the database that backs the app at E2E_BASE_URL.');
  }

  const targets = [baseUrl, ...(databaseUrl ? [databaseUrl] : [])];
  const configuredSupabaseUrl = readDotEnvValue('NEXT_PUBLIC_SUPABASE_URL');
  if (configuredSupabaseUrl) targets.push(configuredSupabaseUrl);
  if (targets.some((target) => !isLoopback(target)) && process.env.E2E_ALLOW_REMOTE_WRITES !== 'true') {
    throw new Error('A remote Supabase target is configured. Set E2E_ALLOW_REMOTE_WRITES=true only after confirming this is a disposable test project.');
  }

  return { baseUrl: baseUrl.replace(/\/$/, ''), password, ownerEmail, managerEmail, cashierEmail, deliveryEmail, customerPhone1, customerPhone2, databaseUrl };
}
