import 'server-only';

import { getServerUserMembership } from '@/lib/supabase-server';
import { can, Permission, Role } from '@/lib/permissions';

/**
 * Helper serveur qui vérifie l'authentification et la permission de l'utilisateur courant.
 * Renvoie un résultat propre (authorized, profile, error) sans écran blanc ni crash.
 */
export async function requirePermission(permission: Permission) {
  try {
    const profile = await getServerUserMembership();

    if (!profile?.membership || !profile.membership.is_active) {
      return {
        authorized: false as const,
        error: 'Connexion requise ou compte inactif.',
        profile: null,
      };
    }

    const role = profile.membership.role as Role;

    // platform admin bypass
    if (profile.isPlatformAdmin) {
      return {
        authorized: true as const,
        profile,
        role,
      };
    }

    if (!can(role, permission)) {
      return {
        authorized: false as const,
        error: `Accès refusé : la permission "${permission}" est requise pour votre rôle (${role}).`,
        profile,
        role,
      };
    }

    return {
      authorized: true as const,
      profile,
      role,
    };
  } catch (err: unknown) {
    return {
      authorized: false as const,
      error: err instanceof Error ? err.message : 'Erreur de vérification des permissions.',
      profile: null,
    };
  }
}
