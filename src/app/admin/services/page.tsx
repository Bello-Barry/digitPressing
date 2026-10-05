import React from 'react';
import { createServerSupabaseClient, getServerUserMembership } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { ServiceCatalogClient } from '@/components/admin/ServiceCatalogClient';

export default async function AdminServicesPage() {
  const profile = await getServerUserMembership();
  if (!profile?.membership?.is_active) redirect('/admin/login');

  const orgId = profile.membership.organization_id;
  const db = await createServerSupabaseClient();
  const role = profile.membership.role;
  const isManagement = role === 'OWNER' || role === 'MANAGER' || profile.isPlatformAdmin;

  const { data: services } = await db
    .from('services')
    .select('*')
    .eq('organization_id', orgId)
    .order('category')
    .order('price');

  return (
    <ServiceCatalogClient
      initialServices={services || []}
      isManagement={isManagement}
      userRole={role}
    />
  );
}
