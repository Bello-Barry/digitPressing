import React from 'react';
import { createServerSupabaseClient, getServerUserMembership } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { AccessDenied } from '@/components/admin/AccessDenied';
import { ExpensesListClient } from '@/components/admin/ExpensesListClient';
import { getExpensesAction, getExpenseSummaryAction, getBrazzavilleToday } from '@/actions/expenses';

export default async function AdminExpensesPage() {
  const profile = await getServerUserMembership();
  if (!profile?.membership?.is_active) redirect('/admin/login');

  const role = profile.membership.role;
  if (role === 'DELIVERY') {
    return (
      <AccessDenied
        title="Accès restreint"
        message="Le rôle Livreur n'a pas accès à la gestion des dépenses et de la caisse."
      />
    );
  }

  const orgId = profile.membership.organization_id;
  const db = await createServerSupabaseClient();
  const todayBrazza = await getBrazzavilleToday();

  // Charger le plafond caissier, les catégories et la liste des dépenses
  const [orgRes, catRes, expensesRes] = await Promise.all([
    db.from('organizations').select('cashier_expense_limit').eq('id', orgId).single(),
    db.from('expense_categories').select('*').eq('organization_id', orgId).eq('is_active', true).order('sort_order'),
    getExpensesAction({ period: '7days' }),
  ]);

  const cashierLimit = Number(orgRes.data?.cashier_expense_limit ?? 10000);
  const categories = catRes.data || [];
  const initialExpenses = expensesRes.expenses || [];

  // Résumé financier pour OWNER
  let initialSummary = null;
  if (role === 'OWNER') {
    const summaryRes = await getExpenseSummaryAction('month');
    if (summaryRes.success && summaryRes.summary) {
      initialSummary = summaryRes.summary;
    }
  }

  return (
    <ExpensesListClient
      initialExpenses={initialExpenses as any[]}
      categories={categories as any[]}
      cashierLimit={cashierLimit}
      userRole={role}
      initialSummary={initialSummary}
      initialTodayBrazza={todayBrazza}
    />
  );
}
