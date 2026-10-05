import React from 'react';
import Link from 'next/link';
import { createServerSupabaseClient, getServerUserMembership } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { DollarSign, ShieldCheck, ExternalLink, Calendar } from 'lucide-react';

export default async function AdminPaymentsPage() {
  const profile = await getServerUserMembership();
  if (!profile?.membership?.is_active) redirect('/admin/login');
  const orgId = profile.membership.organization_id;
  const db = await createServerSupabaseClient();

  // Récupérer les écritures de paiement réelles
  const { data: payments } = await db
    .from('payments')
    .select(`
      id,
      amount,
      method,
      reference,
      notes,
      collected_at,
      order:orders(id, request_code, ticket_number, client_name)
    `)
    .eq('organization_id', orgId)
    .order('collected_at', { ascending: false });

  // Totaux par mode
  const totalAmount = payments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
  const totalCash = payments?.filter((p: any) => p.method === 'CASH').reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
  const totalMoMo = payments?.filter((p: any) => p.method !== 'CASH').reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-amber-400" />
            Journal de Caisse & Écritures
          </h1>
          <p className="text-xs text-slate-400">
            Écritures comptables immuables — Anti-détournement & traçabilité stricte.
          </p>
        </div>
      </div>

      {/* Cartes récapitulatives */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <p className="text-xs text-slate-400">Total Encaissé</p>
          <p className="text-xl sm:text-2xl font-black font-mono text-amber-400">
            {totalAmount.toLocaleString('fr-FR')} FCFA
          </p>
          <p className="text-[11px] text-slate-500">{payments?.length || 0} écriture(s)</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <p className="text-xs text-slate-400">Espèces (CASH)</p>
          <p className="text-xl sm:text-2xl font-black font-mono text-white">
            {totalCash.toLocaleString('fr-FR')} FCFA
          </p>
          <p className="text-[11px] text-slate-500">En caisse physique</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <p className="text-xs text-slate-400">Mobile Money (MTN / Airtel)</p>
          <p className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
            {totalMoMo.toLocaleString('fr-FR')} FCFA
          </p>
          <p className="text-[11px] text-slate-500">Comptes marchands</p>
        </div>
      </div>

      {/* VUE MOBILE (Cartes) */}
      <div className="md:hidden space-y-3">
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Historique des Règlements
          </h2>
          <span className="text-[10px] text-emerald-400 flex items-center font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            Immuable
          </span>
        </div>

        {payments && payments.length > 0 ? (
          payments.map((p: any) => {
            const orderData = Array.isArray(p.order) ? p.order[0] : p.order;
            return (
              <div
                key={p.id}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div>
                    {orderData ? (
                      <Link
                        href={`/admin/commandes/${orderData.id}`}
                        className="font-mono font-bold text-amber-400 hover:underline text-xs flex items-center"
                      >
                        {orderData.ticket_number || orderData.request_code}
                      </Link>
                    ) : (
                      <span className="text-slate-500 text-xs">—</span>
                    )}
                    {orderData?.client_name && (
                      <p className="text-xs font-semibold text-white mt-0.5">{orderData.client_name}</p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="font-mono font-bold text-emerald-400 text-sm">
                      +{Number(p.amount).toLocaleString('fr-FR')} FCFA
                    </p>
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold mt-0.5 ${
                        p.method === 'CASH'
                          ? 'bg-slate-800 text-slate-300'
                          : 'bg-emerald-500/10 text-emerald-400'
                      }`}
                    >
                      {p.method}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-mono">
                    {new Date(p.collected_at).toLocaleDateString('fr-FR')} à{' '}
                    {new Date(p.collected_at).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {p.reference && (
                    <span className="font-mono text-slate-500">Réf: {p.reference}</span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-500 text-xs">
            Aucun encaissement enregistré.
          </div>
        )}
      </div>

      {/* VUE DESKTOP (Tableau) */}
      <div className="hidden md:block rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Historique Chronologique des Règlements
          </h2>
          <span className="text-[11px] text-emerald-400 flex items-center">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            Écritures immuables
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-bold">
              <th className="py-3 px-4">Date & Heure</th>
              <th className="py-3 px-4">Commande</th>
              <th className="py-3 px-4">Mode</th>
              <th className="py-3 px-4">Référence</th>
              <th className="py-3 px-4 text-right">Montant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {payments && payments.length > 0 ? (
              payments.map((p: any) => {
                const orderData = Array.isArray(p.order) ? p.order[0] : p.order;
                return (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {new Date(p.collected_at).toLocaleDateString('fr-FR')}{' '}
                      <span className="text-slate-500">
                        {new Date(p.collected_at).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {orderData ? (
                        <Link
                          href={`/admin/commandes/${orderData.id}`}
                          className="font-mono font-bold text-amber-400 hover:underline flex items-center"
                        >
                          {orderData.ticket_number || orderData.request_code}
                          <span className="font-normal font-sans text-slate-300 ml-1.5">
                            ({orderData.client_name})
                          </span>
                        </Link>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.method === 'CASH'
                            ? 'bg-slate-800 text-slate-300'
                            : 'bg-emerald-500/10 text-emerald-400'
                        }`}
                      >
                        {p.method}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-400">
                      {p.reference || '—'}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 text-sm">
                      +{Number(p.amount).toLocaleString('fr-FR')} FCFA
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">
                  Aucun encaissement enregistré.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
