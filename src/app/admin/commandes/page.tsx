import React from 'react';
import Link from 'next/link';
import { createServerSupabaseClient, getServerUserMembership } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { OrdersListView } from '@/components/admin/OrdersListView';
import { ShoppingBag, Plus } from 'lucide-react';

interface PageProps {
  searchParams: Promise<{ status?: string; search?: string }>;
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const { status, search } = await searchParams;
  const profile = await getServerUserMembership();
  if (!profile?.membership?.is_active) redirect('/admin/login');
  const orgId = profile.membership.organization_id;
  const db = await createServerSupabaseClient();

  let query = db
    .from('orders')
    .select(`
      id,
      request_code,
      ticket_number,
      client_name,
      client_phone,
      mode,
      status,
      subtotal,
      delivery_fee,
      discount_amount,
      total_amount,
      items_count_in,
      created_at,
      invoice_token,
      order_payment_summary(paid_amount, balance_due)
    `)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  if (status && status !== 'ALL') {
    query = query.eq('status', status as any);
  }

  const { data: rawOrders } = await query;

  // Filtrage recherche en mémoire si spécifié
  const orders = (rawOrders || []).filter((o: any) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      o.client_name?.toLowerCase().includes(term) ||
      o.client_phone?.includes(term) ||
      o.request_code?.toLowerCase().includes(term) ||
      o.ticket_number?.toLowerCase().includes(term)
    );
  }).map((o: any) => {
    // Normaliser le payment summary (qui peut être un tableau ou un objet)
    const summary = Array.isArray(o.order_payment_summary)
      ? o.order_payment_summary[0]
      : o.order_payment_summary;

    return {
      ...o,
      paid_amount: summary?.paid_amount ?? 0,
      balance_due: summary?.balance_due ?? o.total_amount,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center">
            <ShoppingBag className="w-5 h-5 mr-2 text-amber-400" />
            Gestion des Commandes
          </h1>
          <p className="text-xs text-slate-400">
            {orders.length} commande(s) trouvée(s) — Traitez les demandes et générez les tickets officiels.
          </p>
        </div>

        <Link
          href="/lb-pressing/commander"
          target="_blank"
          className="inline-flex items-center px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-amber-500/20 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Nouvelle commande
        </Link>
      </div>

      <OrdersListView
        initialOrders={orders}
        currentStatus={status || 'ALL'}
        currentSearch={search || ''}
      />
    </div>
  );
}
