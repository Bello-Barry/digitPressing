// =============================================================================
// CLIENT SUPABASE - Digit PRESSING
// =============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// Variables d'environnement
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
}

if (!supabaseAnonKey) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Client principal pour l'application côté client
export const supabase: SupabaseClient<Database> = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'X-Client-Info': 'Digit-pressing@1.0.0',
      },
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// Client avec service role pour les opérations administratives (côté serveur uniquement)
export const supabaseAdmin: SupabaseClient<Database> | null = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
    })
  : null;

// Types utilitaires pour TypeScript
export type SupabaseClientType = typeof supabase;
export type SupabaseAdminType = typeof supabaseAdmin;

// Configuration des politiques RLS par défaut
export const RLS_POLICIES = {
  USERS_ACCESS_OWN_PRESSING: 'users_access_own_pressing',
  INVOICES_ACCESS_OWN_PRESSING: 'invoices_access_own_pressing',
  ARTICLES_ACCESS_OWN_PRESSING: 'articles_access_own_pressing',
  CLIENTS_ACCESS_OWN_PRESSING: 'clients_access_own_pressing',
  REVENUE_ACCESS_OWN_PRESSING: 'revenue_access_own_pressing',
  AUDIT_LOGS_READ_ONLY: 'audit_logs_read_only',
} as const;

// Helper functions pour la gestion des erreurs
export const handleSupabaseError = (error: unknown): string => {
  if (error && typeof error === 'object' && 'message' in error) {
    return (error as { message: string }).message;
  }
  return 'Une erreur inattendue est survenue';
};

// Helper pour vérifier la session utilisateur
export const getCurrentUser = async () => {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    return user;
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    return null;
  }
};

// Helper pour vérifier si l'utilisateur est connecté
export const isAuthenticated = async (): Promise<boolean> => {
  const user = await getCurrentUser();
  return user !== null;
};

// Helper pour récupérer le profil utilisateur complet - EXPORT CORRIGÉ
export const getUserProfile = async (userId?: string) => {
  try {
    const user = userId ? { id: userId } : await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        pressing:pressings(*)
      `)
      .eq('id', user.id)
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error);
    return null;
  }
};

// Helper pour la déconnexion
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
    throw error;
  }
};

// Helper pour écouter les changements d'authentification
export const onAuthStateChange = (
  callback: (event: string, session: any) => void
) => {
  return supabase.auth.onAuthStateChange(callback);
};

// Configuration des canaux en temps réel
export const REALTIME_CHANNELS = {
  INVOICES: 'invoices_changes',
  REVENUE: 'revenue_changes',
  ARTICLES: 'articles_changes',
  USERS: 'users_changes',
} as const;

// Helper pour s'abonner aux changements en temps réel
export const subscribeToTable = (
  table: keyof Database['public']['Tables'],
  pressingId: string,
  callback: (payload: any) => void
) => {
  return supabase
    .channel(`${table}_${pressingId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: `pressing_id=eq.${pressingId}`,
      },
      callback
    )
    .subscribe();
};

// Helper pour se désabonner d'un canal
export const unsubscribeFromChannel = (channelName: string) => {
  return supabase.removeChannel(supabase.getChannels().find(ch => ch.topic === channelName));
};

// Configuration des buckets de stockage
export const STORAGE_BUCKETS = {
  LOGOS: 'pressing-logos',
  EXPORTS: 'exports',
  TEMP: 'temp-files',
} as const;

// Helper pour uploader un fichier
export const uploadFile = async (
  bucket: keyof typeof STORAGE_BUCKETS,
  path: string,
  file: File,
  options?: {
    cacheControl?: string;
    contentType?: string;
    upsert?: boolean;
  }
) => {
  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS[bucket])
      .upload(path, file, options);

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Erreur lors de l\'upload:', error);
    throw error;
  }
};

// Helper pour obtenir l'URL publique d'un fichier
export const getPublicUrl = (bucket: keyof typeof STORAGE_BUCKETS, path: string) => {
  const { data } = supabase.storage.from(STORAGE_BUCKETS[bucket]).getPublicUrl(path);
  return data.publicUrl;
};

// Helper pour supprimer un fichier
export const deleteFile = async (bucket: keyof typeof STORAGE_BUCKETS, path: string) => {
  try {
    const { error } = await supabase.storage.from(STORAGE_BUCKETS[bucket]).remove([path]);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    throw error;
  }
};

// Configuration des fonctions Edge
export const EDGE_FUNCTIONS = {
  SEND_EMAIL: 'send-email',
  GENERATE_PDF: 'generate-pdf',
  CALCULATE_STATS: 'calculate-stats',
  SYNC_OFFLINE: 'sync-offline',
} as const;

// Helper pour appeler une fonction Edge
export const callEdgeFunction = async (
  functionName: keyof typeof EDGE_FUNCTIONS,
  payload: any
) => {
  try {
    const { data, error } = await supabase.functions.invoke(
      EDGE_FUNCTIONS[functionName],
      {
        body: payload,
      }
    );

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error(`Erreur lors de l'appel de la fonction ${functionName}:`, error);
    throw error;
  }
};

// Helper pour la pagination - EXPORT CORRIGÉ
export const paginateQuery = <T>(
  query: any,
  page: number = 1,
  limit: number = 50
) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  
  return query.range(from, to);
};

// Helper pour les requêtes de recherche
export const buildSearchQuery = (
  baseQuery: any,
  searchTerm: string,
  searchFields: string[]
) => {
  if (!searchTerm.trim()) {
    return baseQuery;
  }

  // Construction de la requête de recherche full-text
  const searchConditions = searchFields
    .map(field => `${field}.ilike.%${searchTerm}%`)
    .join(',');

  return baseQuery.or(searchConditions);
};

// Configuration pour le développement
if (process.env.NODE_ENV === 'development') {
  // Logs supplémentaires en développement
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event, session?.user?.email);
  });
}

export default supabase;