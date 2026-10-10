'use client';

// =============================================================================
// COMPOSANT LISTE DES COMMANDES ADMIN
// Responsive : Tableau sur Desktop, Cartes ergonomiques sur Mobile
// =============================================================================

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { formatPhoneDisplay } from '@/lib/whatsapp';
import {
  Search,
  Truck,
  Building,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface OrderItem {
  id: string;
  request_code: string;
  ticket_number: string | null;
  client_name: string;
  client_phone: string;
  mode: string;
  status: string;
  subtotal: number;
  delivery_fee: number;
  discount_amount: number;
  total_amount: number;
  items_count_in: number | null;
  created_at: string;
  invoice_token: string | null;
  paid_amount: number;
  balance_due: number;
}

interface OrdersListViewProps {
  initialOrders: OrderItem[];
  currentStatus: string;
  currentSearch: string;
}

export function OrdersListView({
  initialOrders,
  currentStatus,
  currentSearch,
}: OrdersListViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchTerm, setSearchTerm] = useState(currentSearch);

  const statusFilters = [
    { key: 'ALL', label: 'Toutes' },
    { key: 'REQUEST', label: 'À Valider' },
    { key: 'VALIDATED', label: 'Validées' },
    { key: 'RECEIVED', label: 'Réceptionnées' },
    { key: 'PROCESSING', label: 'En traitement' },
    { key: 'READY', label: 'Prêtes' },
    { key: 'DELIVERED', label: 'Livrées' },
    { key: 'REJECTED', label: 'Rejetées' },
    { key: 'CANCELLED', label: 'Annulées' },
  ];

  const handleStatusChange = (newStatus: string) => {
    const params = new URLSearchParams();
    if (newStatus !== 'ALL') params.set('status', newStatus);
    if (searchTerm) params.set('search', searchTerm);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (currentStatus !== 'ALL') params.set('status', currentStatus);
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    router.push(`${pathname}?${params.toString()}`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'REQUEST':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            À Valider
          </span>
        );
      case 'VALIDATED':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            Validée
          </span>
        );
      case 'RECEIVED':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            Réceptionnée
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            En Traitement
          </span>
        );
      case 'READY':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Prête
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            Livrée
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Rejetée
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-950/60 text-red-400 border border-red-800">
            Annulée
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Barre de recherche et filtres de statuts */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <input
            type="text"
            placeholder="Rechercher par client, téléphone, ticket (LB-XXXX)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3.5 py-2 pl-9 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-amber-500 transition"
          />
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
        </form>

        {searchTerm && (
          <button
            onClick={() => {
              setSearchTerm('');
              const params = new URLSearchParams();
              if (currentStatus !== 'ALL') params.set('status', currentStatus);
              router.push(`${pathname}?${params.toString()}`);
            }}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            Effacer
          </button>
        )}
      </div>

      {/* Onglets de Statuts défilables */}
      <div className="flex items-center space-x-1 overflow-x-auto pb-1 scrollbar-none text-xs">
        {statusFilters.map((sf) => (
          <button
            key={sf.key}
            type="button"
            onClick={() => handleStatusChange(sf.key)}
            className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition ${
              currentStatus === sf.key
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {sf.label}
          </button>
        ))}
      </div>

      {/* VUE MOBILE (Cartes ergonomiques) */}
      <div className="md:hidden space-y-3">
        {initialOrders.length > 0 ? (
          initialOrders.map((order) => {
            const isCancelledOrRejected = order.status === 'CANCELLED' || order.status === 'REJECTED';
            const isSolded = isCancelledOrRejected || Number(order.balance_due) <= 0;
            return (
              <div
                key={order.id}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-extrabold text-sm text-white">
                        {order.ticket_number || order.request_code}
                      </span>
                      {getStatusBadge(order.status)}
                    </div>
                    <p className="font-semibold text-xs text-slate-200">{order.client_name}</p>
                    <p className="font-mono text-[11px] text-slate-400">
                      {formatPhoneDisplay(order.client_phone)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-mono font-bold text-sm text-amber-400">
                      {Number(order.total_amount).toLocaleString('fr-FR')} FCFA
                    </p>
                    <span
                      className={`text-[10px] font-bold ${
                        isSolded ? 'text-slate-400' : 'text-red-400'
                      }`}
                    >
                      {isCancelledOrRejected
                        ? (order.status === 'CANCELLED' ? 'Annulée' : 'Rejetée')
                        : (Number(order.balance_due) <= 0
                          ? 'Soldé'
                          : `Reste: ${Number(order.balance_due).toLocaleString('fr-FR')} FCFA`)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                  <div className="flex items-center space-x-1">
                    {order.mode === 'DROP_OFF' ? (
                      <Building className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <Truck className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>{order.mode}</span>
                    {order.items_count_in && <span>• {order.items_count_in} pièces</span>}
                  </div>

                  <div className="flex items-center space-x-2">
                    {order.invoice_token && (
                      <Link
                        href={`/f/${order.invoice_token}`}
                        target="_blank"
                        className="p-1 text-slate-400 hover:text-white"
                        title="Voir Facture"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    )}
                    <Link
                      href={`/admin/commandes/${order.id}`}
                      className="px-3 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-slate-950 font-bold text-xs flex items-center transition"
                    >
                      Gérer
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-500 text-xs">
            Aucune commande trouvée.
          </div>
        )}
      </div>

      {/* VUE DESKTOP (Tableau complet) */}
      <div className="hidden md:block rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-bold">
              <th className="py-3 px-4">Ticket / Code</th>
              <th className="py-3 px-4">Client</th>
              <th className="py-3 px-4">Statut</th>
              <th className="py-3 px-4">Mode & Pièces</th>
              <th className="py-3 px-4 text-right">Montant</th>
              <th className="py-3 px-4 text-right">Solde</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {initialOrders.length > 0 ? (
              initialOrders.map((order) => {
                const isCancelledOrRejected = order.status === 'CANCELLED' || order.status === 'REJECTED';
                const isSolded = isCancelledOrRejected || Number(order.balance_due) <= 0;
                return (
                  <tr key={order.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <p className="font-mono font-bold text-white">
                        {order.ticket_number || order.request_code}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {new Date(order.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </td>

                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-200">{order.client_name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {formatPhoneDisplay(order.client_phone)}
                      </p>
                    </td>

                    <td className="py-3 px-4">{getStatusBadge(order.status)}</td>

                    <td className="py-3 px-4">
                      <p className="text-slate-300 font-medium">{order.mode}</p>
                      {order.items_count_in && (
                        <p className="text-[11px] text-slate-500">{order.items_count_in} pièces</p>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                      {Number(order.total_amount).toLocaleString('fr-FR')} FCFA
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold">
                      <span className={isCancelledOrRejected ? 'text-slate-400' : (Number(order.balance_due) <= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {isCancelledOrRejected ? '-' : `${Number(order.balance_due).toLocaleString('fr-FR')} FCFA`}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {order.invoice_token && (
                          <Link
                            href={`/f/${order.invoice_token}`}
                            target="_blank"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            title="Consulter Facture"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        )}
                        <Link
                          href={`/admin/commandes/${order.id}`}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center transition"
                        >
                          Gérer
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  Aucune commande enregistrée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
