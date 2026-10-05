'use server';

// =============================================================================
// SERVER ACTIONS - GESTION DU CATALOGUE SERVICES
// Contrôle d'accès strict (OWNER / MANAGER)
// =============================================================================

import { createServerSupabaseClient, getServerUserMembership } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

interface ServiceInput {
  name: string;
  description?: string;
  category?: string;
  price: number;
  cost_price?: number;
  estimated_days?: number;
  is_active?: boolean;
}

/**
 * Créer un nouveau service dans le catalogue
 */
export async function createServiceAction(input: ServiceInput) {
  try {
    const profile = await getServerUserMembership();
    if (!profile?.membership || !profile.membership.is_active) {
      return { success: false, error: 'Connexion requise.' };
    }

    const { role, organization_id } = profile.membership;
    if (role !== 'OWNER' && role !== 'MANAGER' && !profile.isPlatformAdmin) {
      return { success: false, error: 'Accès refusé. Seuls le Propriétaire et le Manager peuvent modifier le catalogue.' };
    }

    if (!input.name || input.name.trim().length < 2) {
      return { success: false, error: 'Le nom du service est requis.' };
    }

    if (input.price < 0) {
      return { success: false, error: 'Le prix doit être supérieur ou égal à 0.' };
    }

    const db = await createServerSupabaseClient();
    const { data, error } = await db
      .from('services')
      .insert({
        organization_id,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        category: input.category?.trim() || 'Vêtement',
        price: input.price,
        cost_price: input.cost_price != null ? input.cost_price : null,
        estimated_days: input.estimated_days && input.estimated_days > 0 ? input.estimated_days : 2,
        is_active: input.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/services');
    revalidatePath('/[slug]', 'layout');

    return { success: true, service: data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors de la création du service.',
    };
  }
}

/**
 * Mettre à jour un service du catalogue (nom, description, tarif, statut)
 * Note : La modification du tarif du catalogue n'affecte jamais les commandes passées
 * car le prix unitaire d'une ligne de commande est copié au moment de la création dans order_items.unit_price.
 */
export async function updateServiceAction(serviceId: string, input: Partial<ServiceInput>) {
  try {
    const profile = await getServerUserMembership();
    if (!profile?.membership || !profile.membership.is_active) {
      return { success: false, error: 'Connexion requise.' };
    }

    const { role, organization_id } = profile.membership;
    if (role !== 'OWNER' && role !== 'MANAGER' && !profile.isPlatformAdmin) {
      return { success: false, error: 'Accès refusé. Seuls le Propriétaire et le Manager peuvent modifier le catalogue.' };
    }

    const updatePayload: Record<string, any> = {};
    if (input.name !== undefined) updatePayload.name = input.name.trim();
    if (input.description !== undefined) updatePayload.description = input.description.trim() || null;
    if (input.category !== undefined) updatePayload.category = input.category.trim() || 'Vêtement';
    if (input.price !== undefined) {
      if (input.price < 0) return { success: false, error: 'Le prix doit être positif.' };
      updatePayload.price = input.price;
    }
    if (input.cost_price !== undefined) updatePayload.cost_price = input.cost_price;
    if (input.estimated_days !== undefined) updatePayload.estimated_days = input.estimated_days;
    if (input.is_active !== undefined) updatePayload.is_active = input.is_active;

    updatePayload.updated_at = new Date().toISOString();

    const db = await createServerSupabaseClient();
    const { data, error } = await db
      .from('services')
      .update(updatePayload)
      .eq('id', serviceId)
      .eq('organization_id', organization_id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/services');
    revalidatePath('/[slug]', 'layout');

    return { success: true, service: data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors de la mise à jour du service.',
    };
  }
}

/**
 * Activer ou désactiver (soft-delete) un service
 */
export async function toggleServiceStatusAction(serviceId: string, is_active: boolean) {
  return updateServiceAction(serviceId, { is_active });
}
