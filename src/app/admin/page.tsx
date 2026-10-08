import React from 'react';
import Link from 'next/link';
import { getAdminDashboardStats } from '@/actions/admin';
import { createServerSupabaseClient, getServerUserMembership } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { generateWhatsAppLink } from '@/lib/whatsapp';
import { can } from '@/lib/permissions';
import {
  ShoppingBag,
  Clock,
  Sparkles,
  DollarSign,
  ArrowRight,
  MessageCircle,
  Truck,
} from 'lucide-react';

export default async function AdminDashboardPage() {
  const profile = await getServerUserMembership();
  if (!profile?.membership?.is_active) redirect('/admin/login');
  const orgId = profile.membership.organization_id;
  const role = profile.membership.role;
  const db = await createServerSupabaseClient();

  const canViewStats = can(role, 'view_stats_and_daily_summary') || Boolean(profile.isPlatformAdmin);
  const isDelivery = role === 'DELIVERY';

  // Récupérer les stats réelles si autorisé
  let stats = {
    toValidateCount: 0,
    inProcessCount: 0,
    readyCount: 0,
    caToday: 0,
    cashToday: 0,
    momoToday: 0,
  };

  if (canViewStats) {
    const statsRes = await getAdminDashboardStats(orgId);
    if (statsRes.success && statsRes.stats) {
      stats = statsRes.stats;
    }
  } else {
    // Si caissier/livreur : récupérer uniquement les comptages opérationnels anonymisés sans CA
    const [toValidate, inProcess, ready] = await Promise.all([
      db.from('orders').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'REQUEST'),
      db.from('orders').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).in('status', ['RECEIVED', 'PROCESSING']),
      db.from('orders').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'READY'),
    ]);
    stats.toValidateCount = toValidate.count || 0;
    stats.inProcessCount = inProcess.count || 0;
    stats.readyCount = ready.count || 0;
  }

  // Récupérer les 5 dernières commandes réelles (ou livraisons du jour si livreur)
  let recentOrdersQuery = db
    .from('orders')
    .select(`
      id,
      request_code,
      ticket_number,
      client_name,
      client_phone,
      total_amount,
      status,
      created_at
    `)
    .eq('organization_id', orgId);

  if (isDelivery) {
    recentOrdersQuery = recentOrdersQuery.in('status', ['READY', 'DELIVERED']);
  }

  const { data: recentOrders } = await recentOrdersQuery
    .order('created_at', { ascending: false })
    .limit(5);

  // Lien WhatsApp résumé propriétaire (affiché seulement si autorisé)
  const todayStr = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const summaryMessage = `📊 *RÉSUMÉ LB PRESSING DU ${todayStr}*
---------------------------------------
💰 CA encaissé aujourd'hui : *${stats.caToday.toLocaleString('fr-FR')} FCFA*
💵 Espèces : *${stats.cashToday.toLocaleString('fr-FR')} FCFA*
📱 Mobile Money : *${stats.momoToday.toLocaleString('fr-FR')} FCFA*
⏳ À valider : *${stats.toValidateCount}*
👕 En cours : *${stats.inProcessCount}*
✨ Prêtes : *${stats.readyCount}*
---------------------------------------
Généré via Digit Pressing.`;

  const ownerWhatsAppUrl = generateWhatsAppLink(profile.organization?.phone_1 || '', summaryMessage);

  return (
    <div className="space-y-6">
      {/* Header avec action rapide */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Tableau de Bord — LB Pressing
          </h1>
          <p className="text-xs text-slate-400">
            Aperçu des opérations et de l'activité en temps réel ({role}).
          </p>
        </div>

        {canViewStats && (
          <a
            href={ownerWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition self-start sm:self-auto"
          >
            <MessageCircle className="w-4 h-4 mr-1.5" />
            Envoyer le résumé du jour (WhatsApp)
          </a>
        )}
      </div>

      {/* Cartes d'indicateurs clés */}
      <div className={`grid grid-cols-2 ${canViewStats ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3 sm:gap-4`}>
        {/* À Valider */}
        {!isDelivery && (
          <Link
            href="/admin/commandes?status=REQUEST"
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 transition group space-y-1"
          >
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>À Valider</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-white group-hover:text-amber-400 transition">
              {stats.toValidateCount}
            </p>
            <p className="text-[11px] text-amber-400/80 font-medium">Demandes en ligne reçues</p>
          </Link>
        )}

        {/* En Traitement */}
        {!isDelivery && (
          <Link
            href="/admin/commandes?status=PROCESSING"
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-500/50 transition group space-y-1"
          >
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>En Traitement</span>
              <ShoppingBag className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-white group-hover:text-blue-400 transition">
              {stats.inProcessCount}
            </p>
            <p className="text-[11px] text-blue-400/80 font-medium">Linge reçu au pressing</p>
          </Link>
        )}

        {/* Commandes Prêtes / À Livrer */}
        <Link
          href="/admin/commandes?status=READY"
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 transition group space-y-1"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Prêtes à Livrer</span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black font-mono text-white group-hover:text-emerald-400 transition">
            {stats.readyCount}
          </p>
          <p className="text-[11px] text-emerald-400/80 font-medium">À retirer ou livrer</p>
        </Link>

        {/* Carte Chiffre d'Affaires - Affichée UNIQUEMENT pour OWNER et MANAGER */}
        {canViewStats && (
          <Link
            href="/admin/paiements"
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 transition group space-y-1"
          >
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>CA Encaissé (Jour)</span>
              <DollarSign className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-xl sm:text-2xl font-black font-mono text-amber-400">
              {stats.caToday.toLocaleString('fr-FR')} <span className="text-xs font-normal text-slate-400">FCFA</span>
            </p>
            <p className="text-[11px] text-slate-400">
              Espèces : {stats.cashToday.toLocaleString('fr-FR')} | MoMo : {stats.momoToday.toLocaleString('fr-FR')}
            </p>
          </Link>
        )}

        {/* Accès rapide Livraisons pour le Livreur */}
        {isDelivery && (
          <Link
            href="/admin/commandes"
            className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 hover:border-amber-500 transition group space-y-1"
          >
            <div className="flex items-center justify-between text-xs text-amber-400 font-bold">
              <span>Mes Livraisons du jour</span>
              <Truck className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-sm text-white font-semibold pt-1">
              Consulter les adresses & montants à encaisser
            </p>
          </Link>
        )}
      </div>

      {/* Dernières Commandes Récentes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center">
            <ShoppingBag className="w-4 h-4 mr-2 text-amber-400" />
            {isDelivery ? 'Livraisons du Jour' : 'Commandes Récentes'}
          </h2>
          <Link
            href="/admin/commandes"
            className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center"
          >
            Toutes les commandes
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden divide-y divide-slate-800">
          {recentOrders && recentOrders.length > 0 ? (
            recentOrders.map((order: any) => (
              <Link
                key={order.id}
                href={`/admin/commandes/${order.id}`}
                className="p-4 flex items-center justify-between hover:bg-slate-800/50 transition group"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-sm text-white group-hover:text-amber-400 transition">
                      {order.ticket_number || order.request_code}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        order.status === 'REQUEST'
                          ? 'bg-amber-500/10 text-amber-400'
                          : order.status === 'READY'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : order.status === 'DELIVERED'
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-blue-500/10 text-blue-400'
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    {order.client_name} • <span className="font-mono text-slate-400">{order.client_phone}</span>
                  </p>
                </div>

                <div className="text-right space-y-0.5">
                  <p className="font-mono font-bold text-sm text-amber-400">
                    {Number(order.total_amount).toLocaleString('fr-FR')} FCFA
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {new Date(order.created_at).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </Link>
            ))
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              Aucune commande enregistrée pour le moment.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
