// =============================================================================
// CLIENT SUPABASE - DIGIT PRESSING / SAAS PRESSING
// Schéma multi-tenant aligné sur copilote.md
// =============================================================================

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// Variables d'environnement
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
}

if (!supabaseAnonKey) {
  console.warn('Warning: Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Client principal pour le navigateur
const browserSupabase: SupabaseClient<Database> = createBrowserClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  { db: { schema: 'public' }, global: { headers: { 'X-Client-Info': 'Digit-pressing@1.0.0' } } }
);

/** Client navigateur. Les pages/actions serveur importent createServerSupabaseClient. */
export const supabase = browserSupabase;

export type SupabaseClientType = typeof supabase;

// =============================================================================
// HELPERS D'AUTHENTIFICATION & PROFILS MULTI-TENANT
// =============================================================================

export interface UserMembershipProfile {
  user: {
    id: string;
    email?: string;
  };
  membership: {
    id: string;
    organization_id: string;
    role: Database['public']['Enums']['member_role'];
    full_name: string | null;
    phone: string | null;
    is_active: boolean;
  } | null;
  organization: Database['public']['Tables']['organizations']['Row'] | null;
  isPlatformAdmin: boolean;
}

/**
 * Récupère l'utilisateur connecté
 */
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) return null;
    return user;
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    return null;
  }
};

/**
 * Récupère le profil complet (adhésion + organisation)
 */
export const getUserProfile = async (userId: string) => {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user || userData.user.id !== userId) return null;
    const effectiveUserId = userData.user.id;

    if (!effectiveUserId) {
      return null;
    }

    const { data: membershipData, error: memError } = await supabase
      .from('memberships')
      .select('id, user_id, organization_id, role, full_name, phone, is_active')
      .eq('user_id', effectiveUserId)
      .eq('is_active', true)
      .maybeSingle();

    if (memError || !membershipData) {
      return null;
    }

    const authUser = userData?.user ?? { email: null, id: effectiveUserId };

    return {
      id: effectiveUserId,
      email: authUser.email ?? null,
      role: membershipData.role,
      pressing_id: membershipData.organization_id,
      organization_id: membershipData.organization_id,
      full_name: membershipData.full_name,
      phone: membershipData.phone,
      permissions: [],
      is_active: membershipData.is_active,
      created_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Erreur getUserProfile:', error);
    return null;
  }
};

export const paginateQuery = async (query: any, page: number, limit: number) => {
  const offset = (page - 1) * limit;
  return query.range(offset, offset + limit - 1);
};

export const buildSearchQuery = (query: any, searchTerm: string) => {
  if (!searchTerm || !searchTerm.trim()) {
    return query;
  }

  const term = searchTerm.trim();
  return query.or(`client_name.ilike.%${term}%,client_phone.ilike.%${term}%`);
};

export const getUserMembership = async (
  userId?: string
): Promise<UserMembershipProfile | null> => {
  try {
    const authenticatedUser = await getCurrentUser();
    if (userId && authenticatedUser?.id !== userId) return null;
    const user = authenticatedUser;
    if (!user) return null;

    // Vérifier si platform_admin
    const { data: adminData } = await supabase
      .from('platform_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    const isPlatformAdmin = Boolean(adminData);

    // Récupérer le membership actif
    const { data: membershipData, error: memError } = await supabase
      .from('memberships')
      .select(`
        id,
        organization_id,
        role,
        full_name,
        phone,
        is_active,
        organization:organizations(*)
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (memError) {
      console.error('Erreur membership:', memError);
    }

    const org = (membershipData?.organization as unknown as Database['public']['Tables']['organizations']['Row']) || null;

    return {
      user: {
        id: user.id,
        email: 'email' in user ? (user.email as string) : undefined,
      },
      membership: membershipData
        ? {
            id: membershipData.id,
            organization_id: membershipData.organization_id,
            role: membershipData.role,
            full_name: membershipData.full_name,
            phone: membershipData.phone,
            is_active: membershipData.is_active,
          }
        : null,
      organization: org,
      isPlatformAdmin,
    };
  } catch (error) {
    console.error('Erreur getUserMembership:', error);
    return null;
  }
};

/**
 * Déconnexion
 */
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error('Erreur déconnexion:', error);
    throw error;
  }
};

// =============================================================================
// HELPERS PUBLICS (sans authentification requise)
// =============================================================================

/**
 * Récupère le profil public d'une organisation par son slug (ex: lb-pressing)
 */
export const getOrganizationBySlug = async (slug: string) => {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, slug, ticket_prefix, phone_1, phone_2, email, currency, slogan, address, footer_text, logo_url, settings, is_active')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return null;
  }
  return data;
};

/**
 * Récupère les services actifs d'une organisation
 */
export const getActiveServices = async (organizationId: string) => {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, description, category, price, estimated_days')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('category')
    .order('price');

  if (error) {
    console.error('Erreur chargement services:', error);
    return [];
  }
  return data || [];
};

/**
 * Crée une demande de commande client via la RPC sécurisée create_order_request
 */
export const submitPublicOrderRequest = async (payload: {
  orgId: string;
  clientName: string;
  clientPhone: string;
  items: Array<{
    service_id?: string | null;
    service_name: string;
    quantity: number;
    unit_price: number;
    notes?: string | null;
  }>;
  mode?: 'DROP_OFF' | 'PICKUP' | 'DELIVERY';
  address?: string | null;
  notes?: string | null;
  honeypot?: string;
  ipHash?: string;
}) => {
  const { data, error } = await supabase.rpc('create_order_request', {
    p_org_id: payload.orgId,
    p_client_name: payload.clientName,
    p_client_phone: payload.clientPhone,
    p_items: payload.items,
    p_mode: payload.mode || 'DROP_OFF',
    p_address: payload.address || undefined,
    p_notes: payload.notes || undefined,
    p_honeypot: payload.honeypot || undefined,
    p_ip_hash: payload.ipHash || undefined,
  });

  if (error) {
    throw new Error(error.message || 'Erreur lors de la création de la demande');
  }

  return data as {
    order_id: string;
    request_code: string;
    total_amount: number;
  };
};

/**
 * Suivi d'une commande sans compte via RPC sécurisée
 */
export const trackOrderPublic = async (
  orgId: string,
  requestCode: string,
  clientPhone: string
) => {
  const { data, error } = await supabase.rpc('get_order_tracking', {
    p_org_id: orgId,
    p_request_code: requestCode.trim().toUpperCase(),
    p_phone: clientPhone.trim(),
  });

  if (error || !data) {
    return null;
  }

  return data as {
    request_code: string;
    ticket_number: string | null;
    status: Database['public']['Enums']['order_status'];
    client_name: string;
    total_amount: number;
    created_at: string;
    updated_at: string;
  };
};

export default supabase;
