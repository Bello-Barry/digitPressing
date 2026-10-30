'use server';

// =============================================================================
// SERVER ACTIONS - REVISIONS ET CORRECTIONS DE FACTURES (TÂCHE D2)
// Multi-tenant, contrôle chez le client, validation OTP & dérogations
// =============================================================================

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions-server';
import { revalidatePath } from 'next/cache';

export interface RevisionLineInput {
  service_id: string;
  qty_after: number;
  color?: string;
  pattern?: string;
  brand?: string;
  size?: string;
  item_notes?: string;
}

export interface OrderRevisionItem {
  id: string;
  organization_id: string;
  order_id: string;
  mission_id: string | null;
  version_number: number;
  status: 'DRAFT' | 'PENDING_AGREEMENT' | 'CONFIRMED' | 'UNVERIFIED_AGREEMENT' | 'REJECTED';
  verification_type: 'CLIENT_OTP' | 'UNVERIFIED_DECLARATION' | null;
  otp_code_plain?: string | null;
  otp_expires_at?: string | null;
  subtotal_before: number;
  subtotal_after: number;
  total_before: number;
  total_after: number;
  created_at: string;
  confirmed_at?: string | null;
  notes?: string | null;
  created_by_name?: string | null;
  lines?: any[];
}

/**
 * 1. Créer un projet de révision (DRAFT / PENDING_AGREEMENT) chez le client
 */
export async function createOrderRevisionDraftAction(
  missionId: string,
  lines: RevisionLineInput[],
  notes?: string
) {
  try {
    const auth = await requirePermission('revise_order');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Permission insuffisante pour réviser la commande.' };
    }

    if (!lines || lines.length === 0) {
      return { success: false, error: 'Au moins un article doit être présent dans la révision.' };
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

    const result = Array.isArray(data) ? data[0] : data;

    revalidatePath('/admin/missions');
    revalidatePath('/admin/commandes');

    return {
      success: true,
      revisionId: result.revision_id,
      versionNumber: result.version_number,
      otpCode: result.otp_code,
      subtotalAfter: result.subtotal_after,
      totalAfter: result.total_after,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors de la création de la révision.',
    };
  }
}

/**
 * 2. Confirmer la révision par saisie du code OTP client à 6 chiffres
 */
export async function confirmOrderRevisionOtpAction(
  revisionId: string,
  otpCode: string
) {
  try {
    const auth = await requirePermission('revise_order');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Permission insuffisante.' };
    }

    if (!otpCode || otpCode.trim().length !== 6) {
      return { success: false, error: 'Le code de validation doit comporter exactement 6 chiffres.' };
    }

    const db = await createServerSupabaseClient();
    const { data, error } = await db.rpc('confirm_order_revision_otp', {
      p_revision_id: revisionId,
      p_otp_code: otpCode.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/missions');
    revalidatePath('/admin/commandes');
    revalidatePath('/admin');

    return { success: true, revision: data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors de la validation OTP.',
    };
  }
}

/**
 * 3. Valider la révision sans vérification client (Déclaration d'accord non vérifié)
 */
export async function confirmOrderRevisionUnverifiedAction(
  revisionId: string,
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
      p_revision_id: revisionId,
      p_reason: reason.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/missions');
    revalidatePath('/admin/commandes');
    revalidatePath('/admin');

    return { success: true, revision: data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors de la validation sans vérification.',
    };
  }
}

/**
 * 4. Consulter l'historique des révisions d'une commande
 */
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

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, revisions: revisions || [] };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur de chargement des révisions.',
    };
  }
}

/**
 * 5. Obtenir l'OTP actif pour affichage sur la page de suivi client (/f/[token])
 */
export async function getActiveRevisionOtpForTrackingAction(orderId: string) {
  try {
    const db = await createServerSupabaseClient();
    const { data, error } = await db.rpc('get_active_revision_otp_for_tracking', {
      p_order_id: orderId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const activeOtp = Array.isArray(data) ? data[0] : data;
    return { success: true, activeOtp };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur de chargement du code de validation.',
    };
  }
}

/**
 * 6. Obtenir le catalogue actif des services pour l'ajout d'articles lors de la révision
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
