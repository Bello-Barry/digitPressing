'use server';

// =============================================================================
// SERVER ACTIONS - GESTION DU CATALOGUE SERVICES
// Contrôle d'accès strict (OWNER / MANAGER)
// Sécurisation du coût interne des services via `service_costs` (OWNER uniquement)
// =============================================================================

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions-server';
import { can } from '@/lib/permissions';
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
    const auth = await requirePermission('manage_services');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Accès refusé.' };
    }

    const { organization_id, role } = auth.profile.membership;

    if (!input.name || input.name.trim().length < 2) {
      return { success: false, error: 'Le nom du service est requis.' };
    }

    if (input.price < 0) {
      return { success: false, error: 'Le prix doit être supérieur ou égal à 0.' };
    }

    const db = await createServerSupabaseClient();
    const { data: service, error } = await db
      .from('services')
      .insert({
        organization_id,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        category: input.category?.trim() || 'Vêtement',
        price: input.price,
        estimated_days: input.estimated_days && input.estimated_days > 0 ? input.estimated_days : 2,
        is_active: input.is_active ?? true,
      })
      .select('id, organization_id, name, description, category, price, estimated_days, is_active, created_at')
      .single();

    if (error || !service) {
      return { success: false, error: error?.message || 'Erreur de création.' };
    }

    // Gestion du coût interne : réservée exclusivement à l'OWNER
    let cost_price: number | null = null;
    if (can(role, 'view_margins_and_service_costs') && input.cost_price != null && input.cost_price >= 0) {
      const { error: costErr } = await db
        .from('service_costs')
        .upsert({
          service_id: service.id,
          organization_id,
          cost_price: input.cost_price,
          updated_by: auth.profile.user.id,
          updated_at: new Date().toISOString(),
        });

      if (!costErr) {
        cost_price = input.cost_price;
      }
    }

    revalidatePath('/admin/services');
    revalidatePath('/[slug]', 'layout');

    return { success: true, service: { ...service, cost_price } };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors de la création du service.',
    };
  }
}

/**
 * Mettre à jour un service du catalogue (nom, description, tarif, statut)
 */
export async function updateServiceAction(serviceId: string, input: Partial<ServiceInput>) {
  try {
    const auth = await requirePermission('manage_services');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Accès refusé.' };
    }

    const { organization_id, role } = auth.profile.membership;

    const updatePayload: Record<string, any> = {};
    if (input.name !== undefined) updatePayload.name = input.name.trim();
    if (input.description !== undefined) updatePayload.description = input.description.trim() || null;
    if (input.category !== undefined) updatePayload.category = input.category.trim() || 'Vêtement';
    if (input.price !== undefined) {
      if (input.price < 0) return { success: false, error: 'Le prix doit être positif.' };
      updatePayload.price = input.price;
    }
    if (input.estimated_days !== undefined) updatePayload.estimated_days = input.estimated_days;
    if (input.is_active !== undefined) updatePayload.is_active = input.is_active;

    updatePayload.updated_at = new Date().toISOString();

    const db = await createServerSupabaseClient();
    const { data: service, error } = await db
      .from('services')
      .update(updatePayload)
      .eq('id', serviceId)
      .eq('organization_id', organization_id)
      .select('id, organization_id, name, description, category, price, estimated_days, is_active, created_at')
      .single();

    if (error || !service) {
      return { success: false, error: error?.message || 'Erreur de mise à jour.' };
    }

    // Mise à jour du coût de revient dans `service_costs` si OWNER
    let cost_price: number | null = null;
    if (can(role, 'view_margins_and_service_costs') && input.cost_price !== undefined) {
      if (input.cost_price !== null && input.cost_price >= 0) {
        await db
          .from('service_costs')
          .upsert({
            service_id: serviceId,
            organization_id,
            cost_price: input.cost_price,
            updated_by: auth.profile.user.id,
            updated_at: new Date().toISOString(),
          });
        cost_price = input.cost_price;
      }
    }

    revalidatePath('/admin/services');
    revalidatePath('/[slug]', 'layout');

    return { success: true, service: { ...service, cost_price } };
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

/**
 * Récupérer les coûts internes des services (réservé OWNER)
 */
export async function getServiceCostsMapAction(): Promise<Record<string, number>> {
  try {
    const auth = await requirePermission('view_margins_and_service_costs');
    if (!auth.authorized || !auth.profile?.membership) {
      return {};
    }

    const { organization_id } = auth.profile.membership;
    const db = await createServerSupabaseClient();
    const { data } = await db
      .from('service_costs')
      .select('service_id, cost_price')
      .eq('organization_id', organization_id);

    const map: Record<string, number> = {};
    if (data) {
      for (const item of data) {
        map[item.service_id] = Number(item.cost_price);
      }
    }
    return map;
  } catch {
    return {};
  }
}
