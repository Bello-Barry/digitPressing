import React from 'react';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { MissionsViewClient } from '@/components/admin/MissionsViewClient';

export default async function AdminMissionsPage() {
  const db = await createServerSupabaseClient();
  const { data: userAuth } = await db.auth.getUser();

  if (!userAuth.user) {
    redirect('/admin/login');
  }

  const { data: membership } = await db
    .from('memberships')
    .select('role, is_active')
    .eq('user_id', userAuth.user.id)
    .single();

  if (!membership || !membership.is_active) {
    redirect('/admin/login');
  }

  return <MissionsViewClient />;
}
