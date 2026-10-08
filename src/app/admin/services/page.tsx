import React from 'react';
import { createServerSupabaseClient, getServerUserMembership } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { ServiceCatalogClient } from '@/components/admin/ServiceCatalogClient';
import { can } from '@/lib/permissions';
import {
  getServiceCostsMapAction,
  getServiceCategoriesAction,
  getGarmentTypesAction,
} from '@/actions/services';

export default async function AdminServicesPage() {
  const profile = await getServerUserMembership();
  if (!profile?.membership?.is_active) redirect('/admin/login');

  const orgId = profile.membership.organization_id;
  const db = await createServerSupabaseClient();
  const role = profile.membership.role;
  const canManageServices = can(role, 'manage_services') || Boolean(profile.isPlatformAdmin);
  const canViewCosts = can(role, 'view_margins_and_service_costs') || Boolean(profile.isPlatformAdmin);

  let queryErrorMessage: string | null = null;

  // Charger TOUS les services sans jointure bloquante
  const { data: servicesData, error: servicesErr } = await db
    .from('services')
    .select('id, organization_id, name, description, category, category_id, garment_type_id, treatment, needs_review, price, estimated_days, is_active, created_at')
    .eq('organization_id', orgId)
    .order('category')
    .order('price');

  if (servicesErr) {
    console.error('Erreur de chargement des services dans AdminServicesPage:', servicesErr);
    queryErrorMessage = `Erreur de chargement des prestations: ${servicesErr.message}`;
  }

  // Charger les catégories et articles
  const categoriesRes = await getServiceCategoriesAction();
  const garmentTypesRes = await getGarmentTypesAction();

  if (categoriesRes.error) {
    console.error('Erreur chargement catégories:', categoriesRes.error);
    if (!queryErrorMessage) queryErrorMessage = `Erreur catégories: ${categoriesRes.error}`;
  }

  if (garmentTypesRes.error) {
    console.error('Erreur chargement articles:', garmentTypesRes.error);
    if (!queryErrorMessage) queryErrorMessage = `Erreur articles: ${garmentTypesRes.error}`;
  }

  let costsMap: Record<string, number> = {};
  if (canViewCosts) {
    costsMap = await getServiceCostsMapAction();
  }

  const initialServices = (servicesData || []).map(s => ({
    ...s,
    // Marquer à normaliser si needs_review ou s'il manque d'identifiant d'article/catégorie
    needs_review: Boolean(s.needs_review || !s.garment_type_id || !s.category_id),
    cost_price: canViewCosts && costsMap[s.id] !== undefined ? costsMap[s.id] : null,
  }));

  return (
    <ServiceCatalogClient
      initialServices={initialServices}
      initialCategories={categoriesRes.data || []}
      initialGarmentTypes={garmentTypesRes.data || []}
      canManageServices={canManageServices}
      canViewCosts={canViewCosts}
      userRole={role}
      errorMessage={queryErrorMessage}
    />
  );
}
