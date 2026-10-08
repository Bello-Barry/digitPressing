import React from 'react';
import { createServerSupabaseClient, getServerUserMembership } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { ServiceCatalogClient } from '@/components/admin/ServiceCatalogClient';
import { can } from '@/lib/permissions';
import { getServiceCostsMapAction } from '@/actions/services';

export default async function AdminServicesPage() {
  const profile = await getServerUserMembership();
  if (!profile?.membership?.is_active) redirect('/admin/login');

  const orgId = profile.membership.organization_id;
  const db = await createServerSupabaseClient();
  const role = profile.membership.role;
  const canManageServices = can(role, 'manage_services') || Boolean(profile.isPlatformAdmin);
  const canViewCosts = can(role, 'view_margins_and_service_costs') || Boolean(profile.isPlatformAdmin);

  // Sélectionner explicitement les colonnes publiques/métier sans sélectionner cost_price de services
  const { data: servicesData } = await db
    .from('services')
    .select('id, organization_id, name, description, category, price, estimated_days, is_active, created_at')
    .eq('organization_id', orgId)
    .order('category')
    .order('price');

  let costsMap: Record<string, number> = {};
  if (canViewCosts) {
    costsMap = await getServiceCostsMapAction();
  }

  const initialServices = (servicesData || []).map(s => ({
    ...s,
    cost_price: canViewCosts && costsMap[s.id] !== undefined ? costsMap[s.id] : null,
  }));

  return (
    <ServiceCatalogClient
      initialServices={initialServices}
      canManageServices={canManageServices}
      canViewCosts={canViewCosts}
      userRole={role}
    />
  );
}
