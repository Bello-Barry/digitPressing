import React from 'react';
import Link from 'next/link';
import { createServerSupabaseClient, getServerUserMembership } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { formatPhoneDisplay, generateWhatsAppLink } from '@/lib/whatsapp';
import { Users, Search, Phone, ShoppingBag, MessageCircle, ExternalLink } from 'lucide-react';

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function AdminClientsPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const profile = await getServerUserMembership();
  if (!profile?.membership?.is_active) redirect('/admin/login');
  const orgId = profile.membership.organization_id;
  const db = await createServerSupabaseClient();

  let query = db
    .from('customers')
    .select('*')
    .eq('organization_id', orgId)
    .order('total_spent', { ascending: false });

  if (q) {
    query = query.or(`full_name.ilike.%${q}%,phone_normalized.ilike.%${q}%`);
  }

  const { data: customers } = await query;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center">
            <Users className="w-5 h-5 mr-2 text-amber-400" />
            Répertoire des Clients
          </h1>
          <p className="text-xs text-slate-400">
            Fiches clients, volume de commandes et total dépensé chez LB Pressing.
          </p>
        </div>
      </div>

      {/* Barre de recherche */}
      <form method="GET" className="relative max-w-md">
        <input
          type="text"
          name="q"
          defaultValue={q || ''}
          placeholder="Rechercher par nom ou numéro..."
          className="w-full px-3.5 py-2 pl-9 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-amber-500 transition"
        />
        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
      </form>

      {/* VUE MOBILE : Cartes clients */}
      <div className="md:hidden space-y-3">
        {customers && customers.length > 0 ? (
          customers.map((c: any) => {
            const waLink = generateWhatsAppLink(
              c.phone_normalized,
              `Bonjour ${c.full_name} 👋 Merci de votre confiance chez LB Pressing !`
            );

            return (
              <div
                key={c.id}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-white text-sm">{c.full_name}</h3>
                    <a
                      href={`tel:${c.phone_normalized}`}
                      className="font-mono text-xs text-amber-400 hover:underline flex items-center mt-0.5"
                    >
                      <Phone className="w-3 h-3 mr-1" />
                      {formatPhoneDisplay(c.phone_display || c.phone_normalized)}
                    </a>
                  </div>

                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white transition"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </a>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                  <div>
                    <span className="text-slate-400">Commandes :</span>
                    <span className="font-mono font-bold text-white ml-1.5">
                      {c.total_orders || 0}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400">Total :</span>
                    <span className="font-mono font-bold text-amber-400 ml-1.5">
                      {Number(c.total_spent || 0).toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                </div>

                {c.address && (
                  <p className="text-[11px] text-slate-400 border-t border-slate-800/60 pt-1.5 truncate">
                    Adresse : {c.address}
                  </p>
                )}
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-500 text-xs">
            Aucun client enregistré pour l'instant.
          </div>
        )}
      </div>

      {/* VUE DESKTOP : Tableau clients */}
      <div className="hidden md:block rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-bold">
              <th className="py-3 px-4">Client</th>
              <th className="py-3 px-4">Téléphone WhatsApp</th>
              <th className="py-3 px-4">Adresse habituelle</th>
              <th className="py-3 px-4 text-center">Commandes</th>
              <th className="py-3 px-4 text-right">Total Dépensé</th>
              <th className="py-3 px-4 text-right">Contact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {customers && customers.length > 0 ? (
              customers.map((c: any) => {
                const waLink = generateWhatsAppLink(
                  c.phone_normalized,
                  `Bonjour ${c.full_name} 👋 Merci de votre confiance chez LB Pressing !`
                );

                return (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-bold text-white">{c.full_name}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {formatPhoneDisplay(c.phone_display || c.phone_normalized)}
                    </td>
                    <td className="py-3 px-4 text-slate-400">{c.address || '—'}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-white">
                      {c.total_orders || 0}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                      {Number(c.total_spent || 0).toLocaleString('fr-FR')} FCFA
                    </td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white transition font-semibold text-[11px]"
                      >
                        <MessageCircle className="w-3.5 h-3.5 mr-1" />
                        WhatsApp
                      </a>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  Aucun client enregistré.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
