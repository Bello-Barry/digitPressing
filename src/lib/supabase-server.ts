import 'server-only';
import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.');
}

/** Create one request-scoped anon client using the Supabase Auth cookies. */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(url!, anonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll: ((cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies; the middleware refreshes the session.
        }
      }) as SetAllCookies,
    },
  });
}

export async function getServerUserMembership() {
  const client = await createServerSupabaseClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  const { data: adminData } = await client.from('platform_admins').select('id').eq('id', user.id).maybeSingle();
  const { data: membership } = await client.from('memberships')
    .select('id, organization_id, role, full_name, phone, is_active, organization:organizations(*)')
    .eq('user_id', user.id).eq('is_active', true).maybeSingle();
  const organization = (membership?.organization as any) || null;
  return {
    user: { id: user.id, email: user.email || undefined },
    membership: membership ? {
      id: membership.id,
      organization_id: membership.organization_id,
      role: membership.role,
      full_name: membership.full_name,
      phone: membership.phone,
      is_active: membership.is_active,
    } : null,
    organization,
    isPlatformAdmin: Boolean(adminData),
  };
}
