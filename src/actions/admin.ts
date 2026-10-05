'use server';

// =============================================================================
// SERVER ACTIONS - ADMINISTRATION & GESTION DES COMMANDES
// Anti-détournement, vérification des rôles, journalisation d'audit
// =============================================================================

import { createServerSupabaseClient, getServerUserMembership } from '@/lib/supabase-server';
import type { Database } from '@/types/supabase';
import { revalidatePath } from 'next/cache';

type OrderStatus = Database['public']['Enums']['order_status'];
type PaymentMethod = Database['public']['Enums']['payment_method'];

/**
 * Récupère le client Supabase serveur avec privilèges sécurisés
 */
async function authorizeOrder(orderId: string, allowedRoles: Database['public']['Enums']['member_role'][] = ['OWNER', 'MANAGER', 'CASHIER', 'DELIVERY']) {
  const db = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) return { error: 'Connexion requise.' as const };
  const { data: membership } = await db.from('memberships')
    .select('organization_id, role, is_active').eq('user_id', user.id).eq('is_active', true).maybeSingle();
  if (!membership || !allowedRoles.includes(membership.role)) return { error: 'Accès refusé.' as const };
  const { data: order } = await db.from('orders').select('id, organization_id, status').eq('id', orderId).single();
  if (!order || order.organization_id !== membership.organization_id) return { error: 'Commande introuvable.' as const };
  return { db, user, membership, order };
}

/**
 * 1. Valider une demande en ligne (passe de REQUEST à VALIDATED)
 * Possibilité d'ajuster ou d'ajouter des frais de livraison
 */
export async function validateOrderAction(
  orderId: string,
  deliveryFee: number = 0
) {
  try {
    const auth = await authorizeOrder(orderId, ['OWNER', 'MANAGER', 'CASHIER']);
    if ('error' in auth) return { success: false, error: auth.error };
    const { db, user } = auth;

    // Récupérer la commande actuelle
    const { data: order, error: fetchErr } = await db
      .from('orders')
      .select('id, subtotal, discount_amount, status')
      .eq('id', orderId)
      .single();

    if (fetchErr || !order) {
      return { success: false, error: 'Commande introuvable.' };
    }

    if (order.status !== 'REQUEST') {
      return {
        success: false,
        error: `La commande est déjà au statut ${order.status}.`,
      };
    }

    const newTotal = Number(order.subtotal) + Number(deliveryFee) - Number(order.discount_amount);

    const { error: updateErr } = await db
      .from('orders')
      .update({
        status: 'VALIDATED',
        validated_by: user.id,
        delivery_fee: deliveryFee,
        total_amount: Math.max(0, newTotal),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    revalidatePath('/admin/commandes');
    revalidatePath('/admin');

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors de la validation.',
    };
  }
}

/**
 * 8. Création d'un membre de l'équipe par l'OWNER (Supabase Auth Admin)
 * Crée l'utilisateur Supabase Auth + identity + membership dans l'organisation du caller.
 */
export async function createStaffMemberAction(input: {
  email: string;
  password: string;
  fullName: string;
  role: Database['public']['Enums']['member_role'];
}) {
  try {
    const callerMembership = await getServerUserMembership();
    if (!callerMembership || !callerMembership.membership || callerMembership.membership.role !== 'OWNER') {
      return { success: false, error: 'Seul le propriétaire (OWNER) peut créer un membre d\'équipe.' };
    }

    const orgId = callerMembership.membership.organization_id;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl || !serviceRoleKey) {
      return { success: false, error: 'Configuration serveur Supabase incomplète.' };
    }

    const { createClient } = await import('@supabase/supabase-js');
    const adminSupabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Créer l'utilisateur Supabase Auth avec email_confirm = true
    const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.fullName.trim() },
    });

    if (authError || !authUser.user) {
      return { success: false, error: authError?.message || 'Erreur lors de la création Auth.' };
    }

    // 2. Créer le membership lié à l'organisation
    const { error: memError } = await adminSupabase.from('memberships').insert({
      user_id: authUser.user.id,
      organization_id: orgId,
      role: input.role,
      full_name: input.fullName.trim(),
      is_active: true,
    });

    if (memError) {
      return { success: false, error: memError.message };
    }

    revalidatePath('/users');
    revalidatePath('/admin');

    return { success: true, userId: authUser.user.id };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors de la création du membre.',
    };
  }
}

/**
 * 2. Réception du linge et attribution du ticket officiel sans trou (statut RECEIVED)
 * Règle métier : « pas de ticket, pas de linge »
 * Exécute atomiquement la RPC PostgreSQL receive_order_and_assign_ticket()
 */
export async function receiveOrderAction(
  orderId: string,
  itemsCountIn: number
) {
  try {
    const auth = await authorizeOrder(orderId, ['OWNER', 'MANAGER', 'CASHIER']);
    if ('error' in auth) return { success: false, error: auth.error };
    const { db, user, membership } = auth;

    if (auth.order.status !== 'VALIDATED' || !Number.isInteger(itemsCountIn) || itemsCountIn < 1) {
      return { success: false, error: 'Validez la demande et saisissez un nombre de pièces valide avant réception.' };
    }

    // Appel de la fonction atomique PostgreSQL
    const { data: ticketNumber, error } = await db.rpc(
      'receive_order_and_assign_ticket',
      {
        p_order_id: orderId,
        p_org_id: membership.organization_id,
        p_user_id: user.id,
        p_items_count: itemsCountIn,
      }
    );

    if (error) {
      console.error('Erreur attribution ticket:', error);
      return {
        success: false,
        error: error.message || 'Échec de l\'attribution du ticket.',
      };
    }

    return {
      success: true,
      ticketNumber: ticketNumber as string,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors de la réception.',
    };
  }
}

/**
 * 3. Mise à jour du statut d'avancement (PROCESSING, READY, DELIVERED)
 * Anti-détournement : pas de livraison (DELIVERED) si commande non soldée sans dérogation
 */
export async function updateOrderStatusAction(
  orderId: string,
  newStatus: OrderStatus,
  options?: {
    overrideReason?: string;
    itemsCountOut?: number;
  }
) {
  try {
    const transitions: Record<OrderStatus, OrderStatus[]> = {
      REQUEST: ['VALIDATED', 'REJECTED', 'CANCELLED'],
      VALIDATED: ['RECEIVED', 'CANCELLED'],
      RECEIVED: ['PROCESSING', 'CANCELLED'],
      PROCESSING: ['READY', 'CANCELLED'],
      READY: ['DELIVERED'],
      DELIVERED: [],
      REJECTED: [],
      CANCELLED: [],
    };
    const auth = await authorizeOrder(orderId, newStatus === 'DELIVERED' ? ['OWNER', 'MANAGER', 'CASHIER', 'DELIVERY'] : ['OWNER', 'MANAGER', 'CASHIER']);
    if ('error' in auth) return { success: false, error: auth.error };
    const { db, user } = auth;
    if (!transitions[auth.order.status].includes(newStatus)) {
      return { success: false, error: `Transition impossible de ${auth.order.status} à ${newStatus}.` };
    }

    // Vérifier les données financières de la commande
    const { data: summary, error: sumErr } = await db
      .from('order_payment_summary')
      .select('balance_due, paid_amount, total_amount')
      .eq('order_id', orderId)
      .single();

    if (sumErr) {
      console.error('Erreur lecture summary:', sumErr);
    }

    const updatePayload: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === 'DELIVERED') {
      const balanceDue = Number(summary?.balance_due ?? 0);
      if (balanceDue > 0) {
        if (!options?.overrideReason || options.overrideReason.trim().length < 5) {
          return {
            success: false,
            error:
              `La commande a un solde impayé de ${balanceDue} FCFA. Une dérogation avec motif obligatoire est requise pour livrer.`,
          };
        }
        updatePayload.delivery_override_by = user.id;
        updatePayload.delivery_override_at = new Date().toISOString();
        updatePayload.delivery_override_note = options.overrideReason.trim();
      }

      updatePayload.delivered_by = user.id;
      if (options?.itemsCountOut) {
        updatePayload.items_count_out = options.itemsCountOut;
      }
    }

    const { error: updErr } = await db
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId);

    if (updErr) {
      return { success: false, error: updErr.message };
    }
    revalidatePath('/admin/commandes');
    revalidatePath('/admin');

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur de changement de statut.',
    };
  }
}

/**
 * 4. Enregistrement d'un paiement (écriture immuable dans payments)
 */
export async function recordPaymentAction(
  orderId: string,
  amount: number,
  method: PaymentMethod,
  reference?: string,
  notes?: string
) {
  try {
    if (!amount || amount <= 0) {
      return { success: false, error: 'Le montant du paiement doit être supérieur à 0.' };
    }

    const auth = await authorizeOrder(orderId, ['OWNER', 'MANAGER', 'CASHIER']);
    if ('error' in auth) return { success: false, error: auth.error };
    const { db, user, membership } = auth;

    const { data, error } = await db
      .from('payments')
      .insert({
        organization_id: membership.organization_id,
        order_id: orderId,
        amount,
        method,
        collected_by: user.id,
        reference: reference || null,
        notes: notes || null,
        collected_at: new Date().toISOString(),
      })
      .select('id, amount, method, collected_at')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    revalidatePath('/admin/commandes');
    revalidatePath('/admin/paiements');

    return { success: true, payment: data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur d\'enregistrement du paiement.',
    };
  }
}

/**
 * 5. Annulation d'une commande (motif obligatoire, audit automatique)
 * Aucune suppression physique
 */
export async function cancelOrderAction(
  orderId: string,
  reason: string
) {
  try {
    if (!reason || reason.trim().length < 5) {
      return {
        success: false,
        error: 'Un motif d\'annulation détaillé (au moins 5 caractères) est obligatoire.',
      };
    }

    const auth = await authorizeOrder(orderId, ['OWNER', 'MANAGER']);
    if ('error' in auth) return { success: false, error: auth.error };
    const { db, user } = auth;

    const { error } = await db
      .from('orders')
      .update({
        status: 'CANCELLED',
        cancelled_by: user.id,
        cancellation_reason: reason.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur d\'annulation.',
    };
  }
}

/**
 * 6. Récupérer le détail complet d'une commande pour l'admin
 */
export async function getOrderDetailsAction(orderId: string) {
  try {
    const auth = await authorizeOrder(orderId);
    if ('error' in auth) return { success: false, error: auth.error };
    const { db } = auth;

    const { data: order, error: ordErr } = await db
      .from('orders')
      .select(`
        *,
        organization:organizations(name, slug, ticket_prefix, phone_1, phone_2, currency, address),
        order_items(*),
        payments(*)
      `)
      .eq('id', orderId)
      .single();

    if (ordErr || !order) {
      return { success: false, error: 'Commande introuvable.' };
    }

    // Récupérer le sommaire financier
    const { data: summary } = await db
      .from('order_payment_summary')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    return {
      success: true,
      order: {
        ...order,
        paid_amount: summary?.paid_amount ?? 0,
        balance_due: summary?.balance_due ?? order.total_amount,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors du chargement.',
    };
  }
}

/**
 * 7. Récupérer les statistiques du tableau de bord admin
 */
export async function getAdminDashboardStats(orgId: string) {
  try {
    const db = await createServerSupabaseClient();
    const today = new Date().toISOString().split('T')[0];

    // Commandes en attente de validation
    const { count: toValidateCount } = await db
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'REQUEST');

    // Commandes en cours de traitement
    const { count: inProcessCount } = await db
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .in('status', ['RECEIVED', 'PROCESSING']);

    // Commandes prêtes
    const { count: readyCount } = await db
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'READY');

    // Chiffre d'affaires encaissé aujourd'hui
    const { data: todayPayments } = await db
      .from('payments')
      .select('amount, method')
      .eq('organization_id', orgId)
      .gte('collected_at', `${today}T00:00:00.000Z`)
      .lte('collected_at', `${today}T23:59:59.999Z`);

    const caToday = todayPayments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
    const cashToday = todayPayments?.filter((p: any) => p.method === 'CASH').reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
    const momoToday = todayPayments?.filter((p: any) => p.method !== 'CASH').reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;

    return {
      success: true,
      stats: {
        toValidateCount: toValidateCount || 0,
        inProcessCount: inProcessCount || 0,
        readyCount: readyCount || 0,
        caToday,
        cashToday,
        momoToday,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur stats.',
    };
  }
}
