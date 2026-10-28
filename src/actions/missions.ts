'use server';

// =============================================================================
// SERVER ACTIONS - MISSIONS DE COLLECTE ET DE LIVRAISON (TÂCHE D1)
// multi-tenant, vérification des permissions, RPC sécurisées & revalidation
// =============================================================================

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions-server';
import { revalidatePath } from 'next/cache';

export interface MissionItem {
  id: string;
  organization_id: string;
  order_id: string;
  kind: 'COLLECTION' | 'DELIVERY';
  status: 'OPEN' | 'ASSIGNED' | 'ACCEPTED' | 'EN_ROUTE' | 'AT_CUSTOMER' | 'COLLECTED' | 'IN_TRANSIT' | 'AT_SHOP' | 'FAILED' | 'CANCELLED';
  assigned_to: string | null;
  pay_amount: number;
  zone_label: string;
  instructions: string | null;
  items_count_collected: number | null;
  created_at: string;
  updated_at: string;
  assigned_at?: string | null;
  accepted_at?: string | null;
  en_route_at?: string | null;
  at_customer_at?: string | null;
  collected_at?: string | null;
  in_transit_at?: string | null;
  at_shop_at?: string | null;
  cancel_reason?: string | null;
  fail_reason?: string | null;
  // Joins facultatifs pour responsables
  assigned_courier_name?: string | null;
  request_code?: string | null;
  ticket_number?: string | null;
  order_status?: string | null;
  client_name?: string | null;
}

/**
 * 1. Créer une mission de collecte ou de livraison (OWNER, MANAGER, CASHIER)
 */
export async function createMissionAction(
  orderId: string,
  kind: 'COLLECTION' | 'DELIVERY',
  assignedTo?: string,
  zoneLabel?: string,
  instructions?: string
) {
  try {
    const auth = await requirePermission('create_mission');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Permission insuffisante pour créer une mission.' };
    }

    const db = await createServerSupabaseClient();
    const { data: missionId, error } = await db.rpc('create_delivery_mission', {
      p_order_id: orderId,
      p_kind: kind,
      p_assigned_to: assignedTo || null,
      p_zone_label: zoneLabel || '',
      p_instructions: instructions || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/missions');
    revalidatePath(`/admin/commandes/${orderId}`);
    revalidatePath('/admin/commandes');
    revalidatePath('/admin');

    return { success: true, missionId: missionId as string };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors de la création de la mission.',
    };
  }
}

/**
 * 2. Accepter une mission ouverte ou attribuée (DELIVERY)
 */
export async function acceptMissionAction(missionId: string) {
  try {
    const auth = await requirePermission('run_mission');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Seul un livreur peut accepter une mission.' };
    }

    const db = await createServerSupabaseClient();
    const { data, error } = await db.rpc('accept_delivery_mission', {
      p_mission_id: missionId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/missions');
    revalidatePath('/admin');

    return { success: true, mission: data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors de l\'acceptation.',
    };
  }
}

/**
 * 3. Refuser une mission (Livreur attribué ou OWNER/MANAGER)
 */
export async function declineMissionAction(missionId: string, reason: string) {
  try {
    if (!reason || reason.trim().length < 3) {
      return { success: false, error: 'Un motif de refus d\'au moins 3 caractères est obligatoire.' };
    }

    const db = await createServerSupabaseClient();
    const { data, error } = await db.rpc('decline_delivery_mission', {
      p_mission_id: missionId,
      p_reason: reason.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/missions');
    revalidatePath('/admin');

    return { success: true, mission: data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors du refus.',
    };
  }
}

/**
 * 4. Réattribuer une mission (OWNER, MANAGER)
 */
export async function reassignMissionAction(
  missionId: string,
  newAssignee: string | null,
  reason: string
) {
  try {
    const auth = await requirePermission('manage_missions');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Permission insuffisante pour réattribuer.' };
    }

    if (!reason || reason.trim().length < 3) {
      return { success: false, error: 'Un motif de réattribution est obligatoire.' };
    }

    const db = await createServerSupabaseClient();
    const { data, error } = await db.rpc('reassign_delivery_mission', {
      p_mission_id: missionId,
      p_new_assignee: newAssignee || null,
      p_reason: reason.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/missions');
    revalidatePath('/admin');

    return { success: true, mission: data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors de la réattribution.',
    };
  }
}

/**
 * 5. Annuler une mission (OWNER, MANAGER)
 */
export async function cancelMissionAction(missionId: string, reason: string) {
  try {
    const auth = await requirePermission('manage_missions');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Permission insuffisante pour annuler une mission.' };
    }

    if (!reason || reason.trim().length < 3) {
      return { success: false, error: 'Un motif d\'annulation détaillé est obligatoire.' };
    }

    const db = await createServerSupabaseClient();
    const { data, error } = await db.rpc('cancel_delivery_mission', {
      p_mission_id: missionId,
      p_reason: reason.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/missions');
    revalidatePath('/admin');

    return { success: true, mission: data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors de l\'annulation.',
    };
  }
}

/**
 * 6. Faire avancer l'étape d'une mission (DELIVERY attribué)
 */
export async function advanceMissionAction(
  missionId: string,
  nextStatus: string,
  itemsCount?: number
) {
  try {
    const auth = await requirePermission('run_mission');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Permission insuffisante pour faire avancer la mission.' };
    }

    if (nextStatus === 'COLLECTED' && (itemsCount === undefined || itemsCount === null || itemsCount < 0)) {
      return { success: false, error: 'Le nombre de pièces collectées (≥ 0) est obligatoire pour confirmer la collecte.' };
    }

    const db = await createServerSupabaseClient();
    const { data, error } = await db.rpc('advance_delivery_mission', {
      p_mission_id: missionId,
      p_next_status: nextStatus,
      p_items_count: itemsCount ?? null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/missions');
    revalidatePath('/admin');

    return { success: true, mission: data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors de l\'avancement.',
    };
  }
}

/**
 * 7. Signaler un échec de mission (DELIVERY attribué)
 */
export async function failMissionAction(missionId: string, reason: string) {
  try {
    const auth = await requirePermission('run_mission');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Permission insuffisante.' };
    }

    if (!reason || reason.trim().length < 3) {
      return { success: false, error: 'Un motif d\'échec est obligatoire.' };
    }

    const db = await createServerSupabaseClient();
    const { data, error } = await db.rpc('fail_delivery_mission', {
      p_mission_id: missionId,
      p_reason: reason.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/missions');
    revalidatePath('/admin');

    return { success: true, mission: data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors du signalement d\'échec.',
    };
  }
}

/**
 * 8. Consulter la liste anonymisée des missions ouvertes (OPEN) pour le livreur
 */
export async function listOpenMissionsAction() {
  try {
    const auth = await requirePermission('run_mission');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Accès réservé aux livreurs.' };
    }

    const db = await createServerSupabaseClient();
    const { data, error } = await db.rpc('list_open_missions');

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, openMissions: data || [] };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur de chargement des missions disponibles.',
    };
  }
}

/**
 * 9. Consulter les détails confidentiels d'une mission (Livreur attribué ou OWNER/MANAGER)
 */
export async function getMissionDetailsAction(missionId: string) {
  try {
    const db = await createServerSupabaseClient();
    const { data, error } = await db.rpc('get_mission_details', {
      p_mission_id: missionId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const details = Array.isArray(data) ? data[0] : data;
    return { success: true, details };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur de chargement des détails.',
    };
  }
}

/**
 * 10. Liste globale des missions pour le tableau de bord / gestionnaire
 */
export async function listMissionsAction() {
  try {
    const db = await createServerSupabaseClient();
    const { data: userAuth } = await db.auth.getUser();
    if (!userAuth.user) {
      return { success: false, error: 'Non authentifié.' };
    }

    const { data: mem } = await db
      .from('memberships')
      .select('organization_id, role')
      .eq('user_id', userAuth.user.id)
      .eq('is_active', true)
      .single();

    if (!mem) {
      return { success: false, error: 'Membre introuvable.' };
    }

    // Récupérer les membres livreurs pour afficher leur nom
    const { data: couriers } = await db
      .from('memberships')
      .select('user_id, full_name')
      .eq('organization_id', mem.organization_id)
      .eq('role', 'DELIVERY');

    const courierMap = new Map<string, string>();
    couriers?.forEach((c) => {
      if (c.user_id && c.full_name) courierMap.set(c.user_id, c.full_name);
    });

    let query = db
      .from('delivery_missions')
      .select(`
        *,
        order:orders(request_code, ticket_number, status, client_name, pickup_address, delivery_address)
      `)
      .eq('organization_id', mem.organization_id)
      .order('created_at', { ascending: false });

    if (mem.role === 'CASHIER') {
      query = query.in('status', ['IN_TRANSIT', 'AT_SHOP']);
    } else if (mem.role === 'DELIVERY') {
      query = query.eq('assigned_to', userAuth.user.id);
    }

    const { data: rawMissions, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    const missions: MissionItem[] = (rawMissions || []).map((m: any) => ({
      id: m.id,
      organization_id: m.organization_id,
      order_id: m.order_id,
      kind: m.kind,
      status: m.status,
      assigned_to: m.assigned_to,
      pay_amount: m.pay_amount,
      zone_label: m.zone_label,
      instructions: m.instructions,
      items_count_collected: m.items_count_collected,
      created_at: m.created_at,
      updated_at: m.updated_at,
      assigned_at: m.assigned_at,
      accepted_at: m.accepted_at,
      en_route_at: m.en_route_at,
      at_customer_at: m.at_customer_at,
      collected_at: m.collected_at,
      in_transit_at: m.in_transit_at,
      at_shop_at: m.at_shop_at,
      cancel_reason: m.cancel_reason,
      fail_reason: m.fail_reason,
      assigned_courier_name: m.assigned_to ? courierMap.get(m.assigned_to) || 'Livreur attribué' : null,
      request_code: m.order?.request_code || null,
      ticket_number: m.order?.ticket_number || null,
      order_status: m.order?.status || null,
      client_name: m.order?.client_name || null,
    }));

    return { success: true, missions, userRole: mem.role, userId: userAuth.user.id };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors du chargement des missions.',
    };
  }
}

/**
 * 11. Mise à jour des paramètres de rémunération des livreurs (OWNER)
 */
export async function updateCourierPaySettingsAction(
  payCollection: number,
  payDelivery: number
) {
  try {
    const auth = await requirePermission('manage_organization_settings');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Seul le propriétaire (OWNER) peut configurer la rémunération.' };
    }

    if (isNaN(payCollection) || payCollection < 0 || isNaN(payDelivery) || payDelivery < 0) {
      return { success: false, error: 'Les montants de rémunération doivent être des nombres positifs ou nuls.' };
    }

    const orgId = auth.profile.membership.organization_id;
    const db = await createServerSupabaseClient();

    const { error } = await db
      .from('organizations')
      .update({
        courier_pay_collection: payCollection,
        courier_pay_delivery: payDelivery,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orgId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/parametres');
    revalidatePath('/admin/missions');
    revalidatePath('/admin');

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur de mise à jour de la rémunération.',
    };
  }
}

/**
 * 12. Récupérer les paramètres de rémunération des livreurs de l'organisation
 */
export async function getCourierPaySettingsAction() {
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

    const { data: org, error } = await db
      .from('organizations')
      .select('courier_pay_collection, courier_pay_delivery')
      .eq('id', mem.organization_id)
      .single();

    if (error) return { success: false, error: error.message };

    return {
      success: true,
      payCollection: org.courier_pay_collection ?? null,
      payDelivery: org.courier_pay_delivery ?? null,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur de lecture.',
    };
  }
}

/**
 * 13. Récupérer la liste des livreurs actifs de l'organisation pour l'attribution
 */
export async function getActiveCouriersAction() {
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

    const { data: couriers, error } = await db
      .from('memberships')
      .select('user_id, full_name')
      .eq('organization_id', mem.organization_id)
      .eq('role', 'DELIVERY')
      .eq('is_active', true);

    if (error) return { success: false, error: error.message };

    return {
      success: true,
      couriers: (couriers || []).map((c) => ({
        id: c.user_id,
        name: c.full_name || 'Livreur',
      })),
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur de chargement des livreurs.',
    };
  }
}
