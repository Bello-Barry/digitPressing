'use server';

// =============================================================================
// SERVER ACTIONS - REVISIONS ET CORRECTIONS DE FACTURES (TÂCHE D2 - REWRITE)
// Conforme règles strictes :
// 1. Code calculé à la volée, non stocké, non renvoyé au livreur
// 2. Gestion des essais sans exception (ok=false, essais restants)
// 3. Rôles et état AT_CUSTOMER / VALIDATED
// 4. Lignes order_item_id, prix catalogue pour ajouts, prix existants préservés
// 5. Contrôle obligatoire confirm_pickup_conform avant COLLECTED
// =============================================================================

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions-server';
import { revalidatePath } from 'next/cache';

export interface RevisionLineInput {
  order_item_id?: string | null;
  service_id: string;
  qty_after: number;
  item_type?: string;
  color?: string;
  pattern?: string;
  brand?: string;
  size?: string;
  item_notes?: string;
}

/**
 * 1. Créer un projet de révision (PENDING_AGREEMENT) chez le client
 * Ne renvoie JAMAIS le code OTP au livreur.
 */
export async function createOrderRevisionDraftAction(
  missionId: string,
  lines: RevisionLineInput[],
  notes?: string
) {
  try {
    const auth = await requirePermission('revise_order');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Permission insuffisante.' };
    }

    const db = await createServerSupabaseClient();
    const { data, error } = await db.rpc('create_order_revision_draft', {
      p_mission_id: missionId,
      p_lines_json: lines,
      p_notes: notes || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const res = data as any;
    if (res && res.ok === false) {
      return { success: false, error: res.message || 'Erreur lors de la création.' };
    }

    revalidatePath('/admin/missions');
    revalidatePath('/admin/commandes');

    return {
      success: true,
      revisionId: res.revision_id,
      versionNumber: res.version_number,
      subtotalBefore: res.subtotal_before,
      subtotalAfter: res.subtotal_after,
      totalBefore: res.total_before,
      totalAfter: res.total_after,
      expiresAt: res.expires_at,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors de la création de la révision.',
    };
  }
}

/**
 * 2. Renouveler le code de validation (3 renouvellements max)
 */
export async function renewOrderRevisionCodeAction(missionId: string) {
  try {
    const auth = await requirePermission('revise_order');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Permission insuffisante.' };
    }

    const db = await createServerSupabaseClient();
    const { data, error } = await db.rpc('renew_order_revision_code', {
      p_mission_id: missionId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const res = data as any;
    return {
      success: Boolean(res?.ok),
      message: res?.message,
      attemptsLeft: res?.attempts_left,
      renewsLeft: res?.renews_left,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur de renouvellement.',
    };
  }
}

/**
 * 3. Confirmer la révision par saisie du code OTP client
 * Renvoie ok=false et attempts_left sans exception si code incorrect
 */
export async function confirmOrderRevisionOtpAction(
  missionId: string,
  code: string
) {
  try {
    const auth = await requirePermission('revise_order');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Permission insuffisante.' };
    }

    if (!code || code.trim().length !== 6) {
      return { success: false, error: 'Le code doit comporter exactement 6 chiffres.' };
    }

    const db = await createServerSupabaseClient();
    const { data, error } = await db.rpc('confirm_order_revision_otp', {
      p_mission_id: missionId,
      p_code: code.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const res = data as any;
    if (res && res.ok === false) {
      return {
        success: false,
        error: res.message || 'Code incorrect.',
        attemptsLeft: res.attempts_left,
      };
    }

    revalidatePath('/admin/missions');
    revalidatePath('/admin/commandes');
    revalidatePath('/admin');

    return {
      success: true,
      message: res?.message,
      totalAmount: res?.total_amount,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors de la validation OTP.',
    };
  }
}

/**
 * 4. Valider sans vérification client (Déclaration d'accord non vérifié)
 */
export async function confirmOrderRevisionUnverifiedAction(
  missionId: string,
  reason: string
) {
  try {
    const auth = await requirePermission('revise_order');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Permission insuffisante.' };
    }

    if (!reason || reason.trim().length < 5) {
      return { success: false, error: 'Un motif détaillé d\'au moins 5 caractères est obligatoire.' };
    }

    const db = await createServerSupabaseClient();
    const { data, error } = await db.rpc('confirm_order_revision_unverified', {
      p_mission_id: missionId,
      p_reason: reason.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const res = data as any;
    if (res && res.ok === false) {
      return { success: false, error: res.message };
    }

    revalidatePath('/admin/missions');
    revalidatePath('/admin/commandes');
    revalidatePath('/admin');

    return { success: true, message: res?.message, totalAmount: res?.total_amount };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors de la dérogation.',
    };
  }
}

/**
 * 5. Contrôle chez le client CONFORME (aucun article modifié)
 */
export async function confirmPickupConformAction(missionId: string) {
  try {
    const auth = await requirePermission('run_mission');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Permission insuffisante.' };
    }

    const db = await createServerSupabaseClient();
    const { data, error } = await db.rpc('confirm_pickup_conform', {
      p_mission_id: missionId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const res = data as any;
    if (res && res.ok === false) {
      return { success: false, error: res.message };
    }

    revalidatePath('/admin/missions');
    return { success: true, message: res?.message };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors du contrôle conforme.',
    };
  }
}

/**
 * 6. Obtenir la révision en attente pour affichage sur la page de suivi client (/f/[token])
 */
export async function getPendingRevisionForCustomerAction(token: string) {
  try {
    const db = await createServerSupabaseClient();
    const { data, error } = await db.rpc('get_pending_revision_for_customer', {
      p_token: token,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, pendingRevision: data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur de lecture du code de validation.',
    };
  }
}

/**
 * 7. Obtenir les articles actuels d'une commande
 */
export async function getOrderItemsForRevisionAction(orderId: string) {
  try {
    const db = await createServerSupabaseClient();
    const { data: items, error } = await db
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (error) return { success: false, error: error.message };
    return { success: true, items: items || [] };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur de lecture des articles.',
    };
  }
}

/**
 * 8. Obtenir le catalogue actif des services
 */
export async function getActiveServicesCatalogAction() {
  try {
    const db = await createServerSupabaseClient();
    const { data: userAuth } = await db.auth.getUser();
    if (!userAuth.user) return { success: false, error: 'Non authentifié.' };

    const { data: mem } = await db
      .from('memberships')
      .select('organization_id')
      .eq('user_id', userAuth.user.id)
      .single();

    if (!mem) return { success: false, error: 'Membre introuvable.' };

    const { data: services, error } = await db
      .from('services')
      .select('id, name, price, category:service_categories(name)')
      .eq('organization_id', mem.organization_id)
      .eq('is_active', true)
      .order('name');

    if (error) return { success: false, error: error.message };

    return {
      success: true,
      services: (services || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        price: Number(s.price),
        category_name: s.category?.name || 'Général',
      })),
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur de chargement du catalogue.',
    };
  }
}

/**
 * 9. Historique des révisions d'une commande
 */
/**
 * 10. Liste des accords non vérifiés visible par OWNER et MANAGER (Règle 6)
 */
export async function getUnverifiedRevisionsAction() {
  try {
    const db = await createServerSupabaseClient();
    const { data: userAuth } = await db.auth.getUser();
    if (!userAuth.user) return { success: false, error: 'Non authentifié.' };

    const { data: mem } = await db
      .from('memberships')
      .select('organization_id, role')
      .eq('user_id', userAuth.user.id)
      .eq('is_active', true)
      .single();

    if (!mem || (mem.role !== 'OWNER' && mem.role !== 'MANAGER')) {
      return { success: false, error: 'Accès réservé au Propriétaire et au Manager.' };
    }

    const { data: revisions, error } = await db
      .from('order_revisions')
      .select(`
        id,
        order_id,
        mission_id,
        version_number,
        unverified_reason,
        total_after,
        created_at,
        confirmed_at,
        created_by,
        order:orders(ticket_number, request_code, client_name)
      `)
      .eq('organization_id', mem.organization_id)
      .eq('verification_type', 'UNVERIFIED_DECLARATION')
      .order('confirmed_at', { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, unverifiedRevisions: revisions || [] };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur de chargement des accords non vérifiés.',
    };
  }
}

export async function getOrderRevisionsHistoryAction(orderId: string) {
  try {
    const db = await createServerSupabaseClient();
    const { data: revisions, error } = await db
      .from('order_revisions')
      .select(`
        *,
        lines:order_revision_lines(*)
      `)
      .eq('order_id', orderId)
      .order('version_number', { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, revisions: revisions || [] };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur de chargement des révisions.',
    };
  }
}
