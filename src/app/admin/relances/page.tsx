import React from 'react';
import Link from 'next/link';
import { createServerSupabaseClient, getServerUserMembership } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions-server';
import { redirect } from 'next/navigation';
import { AccessDenied } from '@/components/admin/AccessDenied';
import { PickupRemindersList, ReminderOrder } from '@/components/admin/PickupRemindersList';
import { BellRing, ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';

export default async function AdminRelancesPage() {
  const auth = await requirePermission('send_reminders');

  if (!auth.authorized || !auth.profile?.membership?.is_active) {
    if (!auth.profile) {
      redirect('/admin/login');
    }
    return (
      <AccessDenied
        title="Accès restreint"
        message="La relance des clients pour linge prêt est réservée au personnel de caisse et de gestion (OWNER, MANAGER, CASHIER)."
      />
    );
  }

  const orgId = auth.profile.membership.organization_id;
  const db = await createServerSupabaseClient();

  let errorMessage: string | null = null;
  let reminderOrders: ReminderOrder[] = [];
  let orgName = auth.profile.organization?.name || 'LB Pressing';
  let pickupDays = 3;
  let customTemplate: string | null = null;

  try {
    // 1. Récupérer les paramètres de l'organisation
    const { data: orgData, error: orgErr } = await db
      .from('organizations')
      .select('name, pickup_reminder_days')
      .eq('id', orgId)
      .single();

    if (orgErr) {
      console.error('Erreur Supabase lors de la lecture de l\'organisation:', orgErr);
      errorMessage = 'Impossible de charger la configuration de l\'établissement.';
    } else if (orgData) {
      orgName = orgData.name || orgName;
      pickupDays = orgData.pickup_reminder_days ?? 3;
    }

    // 2. Modèle de message personnalisé si configuré
    const { data: tplData } = await db
      .from('message_templates')
      .select('template_body')
      .eq('organization_id', orgId)
      .eq('event_type', 'PICKUP_REMINDER')
      .maybeSingle();

    if (tplData?.template_body) {
      customTemplate = tplData.template_body;
    }

    // 3. Date seuil : commandes PRÊTES depuis au moins N jours
    const thresholdDate = new Date(Date.now() - pickupDays * 24 * 60 * 60 * 1000).toISOString();

    // 4. Charger les commandes READY avec ready_at <= thresholdDate
    const { data: rawOrders, error: ordersErr } = await db
      .from('orders')
      .select(`
        id,
        ticket_number,
        request_code,
        client_name,
        client_phone,
        mode,
        total_amount,
        ready_at,
        created_at,
        payments(amount)
      `)
      .eq('organization_id', orgId)
      .eq('status', 'READY')
      .lte('ready_at', thresholdDate)
      .order('ready_at', { ascending: true });

    if (ordersErr) {
      console.error('Erreur Supabase lors du chargement des commandes pour relances:', ordersErr);
      errorMessage = 'Erreur lors du chargement des commandes prêtes non récupérées.';
    } else if (rawOrders && rawOrders.length > 0) {
      const orderIds = rawOrders.map((o) => o.id);

      // Charger les rappels enregistrés pour ces commandes
      const { data: rawReminders, error: remErr } = await db
        .from('customer_reminders')
        .select('order_id, created_at')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false });

      if (remErr) {
        console.error('Erreur Supabase lors du chargement des rappels:', remErr);
      }

      // Regrouper les rappels par order_id
      const remindersByOrder: Record<string, { count: number; last_at: string | null }> = {};
      if (rawReminders) {
        for (const rem of rawReminders) {
          if (!rem.order_id) continue;
          if (!remindersByOrder[rem.order_id]) {
            remindersByOrder[rem.order_id] = { count: 0, last_at: rem.created_at };
          }
          remindersByOrder[rem.order_id].count += 1;
        }
      }

      const nowTime = Date.now();

      reminderOrders = rawOrders.map((order: any) => {
        const totalPaid = (order.payments || []).reduce(
          (sum: number, p: any) => sum + Number(p.amount || 0),
          0
        );
        const totalAmount = Number(order.total_amount || 0);
        const balanceDue = Math.max(0, totalAmount - totalPaid);

        const readyTimestamp = order.ready_at ? new Date(order.ready_at).getTime() : new Date(order.created_at).getTime();
        const daysReady = Math.floor((nowTime - readyTimestamp) / (1000 * 60 * 60 * 24));

        const remInfo = remindersByOrder[order.id] || { count: 0, last_at: null };

        return {
          id: order.id,
          ticket_number: order.ticket_number,
          request_code: order.request_code,
          client_name: order.client_name,
          client_phone: order.client_phone,
          mode: order.mode,
          total_amount: totalAmount,
          paid_amount: totalPaid,
          balance_due: balanceDue,
          ready_at: order.ready_at || order.created_at,
          days_ready: Math.max(pickupDays, daysReady),
          reminders_count: remInfo.count,
          last_reminder_at: remInfo.last_at,
        };
      });
    }
  } catch (err: unknown) {
    console.error('Exception lors du chargement de la page /admin/relances:', err);
    errorMessage = 'Erreur système lors du chargement des relances.';
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* En-tête de la page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center">
            <BellRing className="w-6 h-6 mr-2 text-amber-400" />
            Relances Clients
          </h1>
          <p className="text-xs text-slate-400">
            Gestion du linge prêt non récupéré (seuil configuré : {pickupDays} jours).
          </p>
        </div>

        <Link
          href="/admin"
          className="inline-flex items-center px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition self-start sm:self-auto"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Retour au dashboard
        </Link>
      </div>

      {/* Onglets de navigation */}
      <div className="flex border-b border-slate-800 space-x-4 text-xs font-semibold">
        <button className="pb-2.5 border-b-2 border-amber-400 text-amber-400 flex items-center space-x-2">
          <span>À récupérer ({reminderOrders.length})</span>
        </button>
      </div>

      {/* Message d'erreur serveur si présent */}
      {errorMessage ? (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      ) : (
        /* Liste mobile-first des commandes à relancer */
        <PickupRemindersList
          orders={reminderOrders}
          orgName={orgName}
          customTemplate={customTemplate}
        />
      )}
    </div>
  );
}
