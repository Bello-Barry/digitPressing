import { notFound } from 'next/navigation';
import { getOrderDetailsAction } from '@/actions/admin';
import { getServerUserMembership } from '@/lib/supabase-server';
import { OrderDetailClient } from '@/components/admin/OrderDetailClient';
import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const res = await getOrderDetailsAction(id);

  if (!res.success || !res.order) {
    notFound();
  }

  const membershipProfile = await getServerUserMembership();
  if (!membershipProfile?.membership?.is_active) redirect('/admin/login');
  const userRole = membershipProfile.membership.role;

  return (
    <OrderDetailClient
      order={res.order}
      userRole={userRole}
    />
  );
}
