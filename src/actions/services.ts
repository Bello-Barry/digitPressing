'use server';

// =============================================================================
// SERVER ACTIONS - GESTION DU CATALOGUE SERVICES ET ARTICLES
// Contrôle d'accès strict (OWNER / MANAGER)
// Sécurisation du coût interne des services via `service_costs` (OWNER uniquement)
// =============================================================================

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions-server';
import { can } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';
import { normalizeCatalogName, formatServiceName, type TreatmentType } from '@/lib/catalog';

export interface ServiceCategory {
  id: string;
  organization_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface GarmentType {
  id: string;
  organization_id: string;
  category_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface ServiceInput {
  name?: string;
  category?: string;
  category_id?: string | null;
  garment_type_id?: string | null;
  treatment?: TreatmentType | string | null;
  description?: string | null;
  price: number;
  cost_price?: number | null;
  estimated_days?: number;
  is_active?: boolean;
  needs_review?: boolean;
}

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  duplicate?: boolean;
}

/**
 * Récupérer toutes les catégories pour l'organisation de l'utilisateur connecté
 * Avec auto-seeding si la liste est vide pour l'organisation
 */
export async function getServiceCategoriesAction(): Promise<{ data: ServiceCategory[]; error?: string }> {
  try {
    const db = await createServerSupabaseClient();
    const { data: userRes, error: userErr } = await db.auth.getUser();
    if (userErr || !userRes.user) {
      console.error('Erreur getServiceCategoriesAction (auth):', userErr);
      return { data: [], error: 'Utilisateur non authentifié.' };
    }

    const { data, error } = await db
      .from('service_categories')
      .select('id, organization_id, name, sort_order, is_active, created_at')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Erreur SQL getServiceCategoriesAction:', error);
      return { data: [], error: error.message };
    }

    // Si aucune catégorie n'existe encore pour l'organisation, tenter un auto-seed
    if (!data || data.length === 0) {
      const { data: membership } = await db
        .from('memberships')
        .select('organization_id')
        .eq('user_id', userRes.user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (membership?.organization_id) {
        console.log(`Auto-seeding du catalogue par défaut pour org: ${membership.organization_id}`);
        await db.rpc('seed_default_catalog', { p_org_id: membership.organization_id });

        const { data: seededCats, error: reQueryErr } = await db
          .from('service_categories')
          .select('id, organization_id, name, sort_order, is_active, created_at')
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true });

        if (reQueryErr) {
          console.error('Erreur SQL re-requête categories après seed:', reQueryErr);
          return { data: [], error: reQueryErr.message };
        }
        return { data: (seededCats || []) as ServiceCategory[] };
      }
    }

    return { data: (data || []) as ServiceCategory[] };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Erreur inattendue getServiceCategoriesAction';
    console.error('Exception getServiceCategoriesAction:', err);
    return { data: [], error: errorMsg };
  }
}

/**
 * Récupérer les articles (garment_types) pour l'organisation de l'utilisateur connecté
 */
export async function getGarmentTypesAction(categoryId?: string): Promise<{ data: GarmentType[]; error?: string }> {
  try {
    const db = await createServerSupabaseClient();

    let query = db
      .from('garment_types')
      .select('id, organization_id, category_id, name, is_active, created_at')
      .order('name', { ascending: true });

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Erreur SQL getGarmentTypesAction:', error);
      return { data: [], error: error.message };
    }

    return { data: (data || []) as GarmentType[] };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Erreur inattendue getGarmentTypesAction';
    console.error('Exception getGarmentTypesAction:', err);
    return { data: [], error: errorMsg };
  }
}

/**
 * Créer une nouvelle catégorie normalisée avec vérification de doublon
 */
export async function createCategoryAction(name: string, sortOrder: number = 10) {
  try {
    const auth = await requirePermission('manage_services');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Accès refusé.' };
    }

    const { organization_id } = auth.profile.membership;
    const trimmedName = name.trim();
    const normalizedInput = normalizeCatalogName(trimmedName);

    if (!normalizedInput || normalizedInput.length < 2) {
      return { success: false, error: 'Le nom de la catégorie est trop court.' };
    }

    const db = await createServerSupabaseClient();

    // Vérification préalable de doublon par nom normalisé
    const { data: existingList, error: fetchErr } = await db
      .from('service_categories')
      .select('id, name, organization_id, sort_order, is_active, created_at')
      .eq('organization_id', organization_id);

    if (fetchErr) {
      console.error('Erreur SQL verification doublon categorie:', fetchErr);
    }

    const duplicate = (existingList || []).find(
      cat => normalizeCatalogName(cat.name) === normalizedInput
    );

    if (duplicate) {
      return {
        success: false,
        duplicate: true,
        category: duplicate as ServiceCategory,
        error: `La catégorie "${duplicate.name}" existe déjà.`,
      };
    }

    const { data: newCategory, error } = await db
      .from('service_categories')
      .insert({
        organization_id,
        name: trimmedName,
        sort_order: sortOrder,
        is_active: true,
      })
      .select('id, organization_id, name, sort_order, is_active, created_at')
      .single();

    if (error || !newCategory) {
      console.error('Erreur insertion categorie:', error);
      return { success: false, error: error?.message || 'Erreur lors de la création de la catégorie.' };
    }

    revalidatePath('/admin/services');
    return { success: true, category: newCategory as ServiceCategory };
  } catch (err: unknown) {
    console.error('Exception createCategoryAction:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur inattendue.',
    };
  }
}

/**
 * Créer un nouvel article (garment_type) avec vérification de doublon
 */
export async function createGarmentTypeAction(categoryId: string, name: string) {
  try {
    const auth = await requirePermission('manage_services');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Accès refusé.' };
    }

    const { organization_id } = auth.profile.membership;
    const trimmedName = name.trim();
    const normalizedInput = normalizeCatalogName(trimmedName);

    if (!normalizedInput || normalizedInput.length < 2) {
      return { success: false, error: 'Le nom de l\'article est trop court.' };
    }

    const db = await createServerSupabaseClient();

    // Vérification préalable de doublon par nom normalisé
    const { data: existingList, error: fetchErr } = await db
      .from('garment_types')
      .select('id, name, category_id, organization_id, is_active, created_at')
      .eq('organization_id', organization_id);

    if (fetchErr) {
      console.error('Erreur SQL verification doublon garment_type:', fetchErr);
    }

    const duplicate = (existingList || []).find(
      gt => normalizeCatalogName(gt.name) === normalizedInput
    );

    if (duplicate) {
      return {
        success: false,
        duplicate: true,
        garmentType: duplicate as GarmentType,
        error: `L'article "${duplicate.name}" existe déjà.`,
      };
    }

    const { data: newGarmentType, error } = await db
      .from('garment_types')
      .insert({
        organization_id,
        category_id: categoryId,
        name: trimmedName,
        is_active: true,
      })
      .select('id, organization_id, category_id, name, is_active, created_at')
      .single();

    if (error || !newGarmentType) {
      console.error('Erreur insertion garment_type:', error);
      return { success: false, error: error?.message || 'Erreur lors de la création de l\'article.' };
    }

    revalidatePath('/admin/services');
    return { success: true, garmentType: newGarmentType as GarmentType };
  } catch (err: unknown) {
    console.error('Exception createGarmentTypeAction:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur inattendue.',
    };
  }
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

    if (input.price < 0) {
      return { success: false, error: 'Le prix doit être supérieur ou égal à 0.' };
    }

    const db = await createServerSupabaseClient();

    let garmentTypeName = '';
    let categoryName = input.category || 'Vêtements';

    if (input.category_id) {
      const { data: cat } = await db
        .from('service_categories')
        .select('name')
        .eq('id', input.category_id)
        .maybeSingle();
      if (cat?.name) categoryName = cat.name;
    }

    if (input.garment_type_id) {
      const { data: gt } = await db
        .from('garment_types')
        .select('name')
        .eq('id', input.garment_type_id)
        .maybeSingle();
      if (gt?.name) garmentTypeName = gt.name;
    }

    const displayName = formatServiceName(garmentTypeName, input.treatment, input.name);

    if (input.garment_type_id && input.treatment) {
      const { data: existingService } = await db
        .from('services')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('garment_type_id', input.garment_type_id)
        .eq('treatment', input.treatment)
        .maybeSingle();

      if (existingService) {
        return {
          success: false,
          error: 'Un service pour cet article et ce traitement existe déjà.',
        };
      }
    }

    const { data: service, error } = await db
      .from('services')
      .insert({
        organization_id,
        name: displayName,
        category: categoryName,
        category_id: input.category_id || null,
        garment_type_id: input.garment_type_id || null,
        treatment: input.treatment || null,
        description: input.description?.trim() || null,
        price: input.price,
        estimated_days: input.estimated_days && input.estimated_days > 0 ? input.estimated_days : 2,
        is_active: input.is_active ?? true,
        needs_review: input.needs_review ?? false,
      })
      .select('id, organization_id, name, description, category, category_id, garment_type_id, treatment, needs_review, price, estimated_days, is_active, created_at')
      .single();

    if (error || !service) {
      console.error('Erreur insertion service:', error);
      return { success: false, error: error?.message || 'Erreur de création.' };
    }

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
      } else {
        console.error('Erreur upsert service_costs:', costErr);
      }
    }

    revalidatePath('/admin/services');
    revalidatePath('/[slug]', 'layout');

    return { success: true, service: { ...service, cost_price } };
  } catch (err: unknown) {
    console.error('Exception createServiceAction:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors de la création du service.',
    };
  }
}

/**
 * Mettre à jour un service du catalogue (nom, description, tarif, statut, normalisation)
 */
export async function updateServiceAction(serviceId: string, input: Partial<ServiceInput>) {
  try {
    const auth = await requirePermission('manage_services');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Accès refusé.' };
    }

    const { organization_id, role } = auth.profile.membership;
    const db = await createServerSupabaseClient();

    let garmentTypeName = '';
    let categoryName = input.category;

    if (input.category_id) {
      const { data: cat } = await db
        .from('service_categories')
        .select('name')
        .eq('id', input.category_id)
        .maybeSingle();
      if (cat?.name) categoryName = cat.name;
    }

    const garmentIdToFetch = input.garment_type_id;
    if (garmentIdToFetch) {
      const { data: gt } = await db
        .from('garment_types')
        .select('name')
        .eq('id', garmentIdToFetch)
        .maybeSingle();
      if (gt?.name) garmentTypeName = gt.name;
    }

    const updatePayload: Record<string, any> = {};
    if (input.category_id !== undefined) updatePayload.category_id = input.category_id;
    if (input.garment_type_id !== undefined) updatePayload.garment_type_id = input.garment_type_id;
    if (input.treatment !== undefined) updatePayload.treatment = input.treatment;
    if (input.needs_review !== undefined) updatePayload.needs_review = input.needs_review;

    if (garmentTypeName || input.treatment) {
      updatePayload.name = formatServiceName(garmentTypeName, input.treatment || undefined, input.name);
      updatePayload.needs_review = false;
    } else if (input.name !== undefined) {
      updatePayload.name = input.name.trim();
    }

    if (categoryName) updatePayload.category = categoryName;
    if (input.description !== undefined) updatePayload.description = input.description?.trim() || null;
    if (input.price !== undefined) {
      if (input.price < 0) return { success: false, error: 'Le prix doit être positif.' };
      updatePayload.price = input.price;
    }
    if (input.estimated_days !== undefined) updatePayload.estimated_days = input.estimated_days;
    if (input.is_active !== undefined) updatePayload.is_active = input.is_active;

    updatePayload.updated_at = new Date().toISOString();

    const { data: service, error } = await db
      .from('services')
      .update(updatePayload)
      .eq('id', serviceId)
      .eq('organization_id', organization_id)
      .select('id, organization_id, name, description, category, category_id, garment_type_id, treatment, needs_review, price, estimated_days, is_active, created_at')
      .single();

    if (error || !service) {
      console.error('Erreur updateServiceAction:', error);
      return { success: false, error: error?.message || 'Erreur de mise à jour.' };
    }

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
    console.error('Exception updateServiceAction:', err);
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
    const { data, error } = await db
      .from('service_costs')
      .select('service_id, cost_price')
      .eq('organization_id', organization_id);

    if (error) {
      console.error('Erreur getServiceCostsMapAction:', error);
      return {};
    }

    const map: Record<string, number> = {};
    if (data) {
      for (const item of data) {
        map[item.service_id] = Number(item.cost_price);
      }
    }
    return map;
  } catch (err: unknown) {
    console.error('Exception getServiceCostsMapAction:', err);
    return {};
  }
}
