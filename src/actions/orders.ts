'use server';

// =============================================================================
// SERVER ACTIONS - COMMANDES PUBLIQUES (CLIENT SANS COMPTE)
// =============================================================================

import { publicOrderRequestSchema, type PublicOrderRequestInput } from '@/lib/validations/order';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { normalizePhoneNumber } from '@/lib/whatsapp';
import { revalidatePath } from 'next/cache';

export interface SubmitOrderResponse {
  success: boolean;
  orderId?: string;
  requestCode?: string;
  totalAmount?: number;
  error?: string;
}

/**
 * Soumission d'une demande de pressing en ligne par le client
 * Vérifie le honeypot, valide les données via Zod, et appelle la RPC SQL sécurisée
 */
export async function submitOrderAction(
  rawInput: PublicOrderRequestInput
): Promise<SubmitOrderResponse> {
  try {
    // 1. Validation Zod stricte (incluant honeypot et normalisation téléphone)
    const validation = publicOrderRequestSchema.safeParse(rawInput);
    if (!validation.success) {
      const errorMsg = validation.error.issues.map((i) => i.message).join(', ');
      return { success: false, error: errorMsg };
    }

    const { org_id, client_name, client_phone, mode, address, notes, items, honeypot, requested_at } =
      validation.data;

    const client = await createServerSupabaseClient();
    const { data: organization, error: organizationError } = await client
      .from('organizations')
      .select('id')
      .eq('id', org_id)
      .eq('slug', 'lb-pressing')
      .eq('is_active', true)
      .maybeSingle();

    if (organizationError || !organization) {
      return { success: false, error: 'Organisation indisponible.' };
    }

    // Protection anti-spam par champ invisible
    if (honeypot && honeypot.length > 0) {
      return { success: false, error: 'Activité suspecte détectée.' };
    }

    if ((mode === 'PICKUP' || mode === 'DELIVERY') && !address?.trim()) {
      return { success: false, error: 'Une adresse est requise pour ce mode de service.' };
    }

    const { data: liveServices, error: servicesError } = await client
      .from('services')
      .select('id, name, price, is_active')
      .eq('organization_id', org_id)
      .eq('is_active', true)
      .in('id', items.map((item) => item.service_id).filter((id): id is string => Boolean(id)));

    if (servicesError || !liveServices || liveServices.length !== items.length) {
      return { success: false, error: 'Un ou plusieurs services ne sont plus disponibles.' };
    }

    const authoritativeItems = items.map((item) => {
      const service = liveServices.find((candidate: any) => candidate.id === item.service_id);
      if (!service) return null;
      return { ...item, service_name: service.name, unit_price: Number(service.price) };
    });
    if (authoritativeItems.some((item) => item === null)) {
      return { success: false, error: 'Un ou plusieurs services ne sont plus disponibles.' };
    }

    // 2. Appel de la RPC create_order_request dans Supabase
    // Nous utilisons le client public (ou admin si configuré) pour exécuter la fonction SECURITY DEFINER
    const { data, error } = await client.rpc('create_order_request', {
      p_org_id: org_id,
      p_client_name: client_name.trim(),
      p_client_phone: client_phone,
      p_items: authoritativeItems.filter((it): it is NonNullable<typeof it> => it !== null).map((it) => ({
        service_id: it.service_id || null,
        service_name: it.service_name,
        quantity: it.quantity,
        unit_price: it.unit_price,
        item_type: it.item_type || null,
        color: it.color || null,
        pattern: it.pattern || null,
        brand: it.brand || null,
        size: it.size || null,
        item_notes: it.item_notes || null,
        notes: it.notes || null,
      })),
      p_mode: mode,
      p_address: address || undefined,
      p_notes: [notes, requested_at ? `Date souhaitée : ${requested_at}` : null].filter(Boolean).join(' | ') || undefined,
      p_honeypot: honeypot || undefined,
      p_ip_hash: undefined,
    });

    if (error) {
      console.error('Erreur RPC create_order_request:', error);
      return {
        success: false,
        error: error.message || 'Impossible d\'enregistrer votre demande.',
      };
    }

    const result = data as {
      order_id: string;
      request_code: string;
      total_amount: number;
    };

    revalidatePath('/admin');
    revalidatePath('/admin/commandes');

    return {
      success: true,
      orderId: result.order_id,
      requestCode: result.request_code,
      totalAmount: result.total_amount,
    };
  } catch (err: unknown) {
    console.error('Exception submitOrderAction:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Une erreur inattendue est survenue.',
    };
  }
}

/**
 * Suivi d'une commande sans compte par code et numéro de téléphone
 */
export async function trackOrderAction(
  slug: string,
  requestCode: string,
  rawPhone: string
) {
  try {
    if (!slug || !requestCode || !rawPhone) {
      return { success: false, error: 'Code et numéro de téléphone obligatoires.' };
    }

    const client = await createServerSupabaseClient();

    // 1. Trouver l'organisation par slug
    const { data: org, error: orgError } = await client
      .from('organizations')
      .select('id, name, ticket_prefix')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (orgError || !org) {
      return { success: false, error: 'Organisation introuvable.' };
    }

    const normalizedPhone = normalizePhoneNumber(rawPhone);

    // 2. Appel de la RPC sécurisée get_order_tracking
    const { data, error } = await client.rpc('get_order_tracking', {
      p_org_id: org.id,
      p_request_code: requestCode.trim().toUpperCase(),
      p_phone: normalizedPhone,
    });

    if (error || !data) {
      return {
        success: false,
        error: 'Aucune commande ne correspond à ce code et ce numéro.',
      };
    }

    return {
      success: true,
      tracking: data as {
        request_code: string;
        ticket_number: string | null;
        status: string;
        client_name: string;
        total_amount: number;
        created_at: string;
        updated_at: string;
      },
      organization: org,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur de recherche.',
    };
  }
}
