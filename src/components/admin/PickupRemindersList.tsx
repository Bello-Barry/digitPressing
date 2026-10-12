'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { logReminderAction } from '@/actions/admin';
import {
  generateWhatsAppLink,
  renderWhatsAppMessage,
  normalizePhoneNumber,
  isValidCongoMobile,
  formatPhoneDisplay,
  DEFAULT_MESSAGE_TEMPLATES,
} from '@/lib/whatsapp';
import { toast } from 'sonner';
import {
  MessageCircle,
  Clock,
  Shirt,
  AlertCircle,
  CheckCircle2,
  Phone,
  Truck,
  Building2,
  RefreshCw,
  Loader2,
} from 'lucide-react';

export interface ReminderOrder {
  id: string;
  ticket_number: string | null;
  request_code: string | null;
  client_name: string;
  client_phone: string;
  mode: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  ready_at: string;
  days_ready: number;
  reminders_count: number;
  last_reminder_at: string | null;
}

interface PickupRemindersListProps {
  orders: ReminderOrder[];
  orgName: string;
  customTemplate?: string | null;
}

export function PickupRemindersList({
  orders,
  orgName,
  customTemplate,
}: PickupRemindersListProps) {
  const router = useRouter();
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);

  const handleSendReminder = async (order: ReminderOrder) => {
    const rawPhone = order.client_phone;
    const normalized = normalizePhoneNumber(rawPhone, '242');

    if (!isValidCongoMobile(normalized)) {
      toast.error('Numéro de téléphone invalide pour un rappel WhatsApp');
      return;
    }

    // Vérification du délai de 48 heures depuis le dernier rappel
    if (order.last_reminder_at) {
      const lastDate = new Date(order.last_reminder_at).getTime();
      const now = Date.now();
      const diffHours = (now - lastDate) / (1000 * 60 * 60);

      if (diffHours < 48) {
        const hoursText = Math.floor(diffHours);
        const confirmMsg = `Déjà rappelé il y a ${hoursText} h. Voulez-vous envoyer un nouveau rappel ?`;
        if (!window.confirm(confirmMsg)) {
          return;
        }
      }
    }

    setLoadingOrderId(order.id);

    try {
      // 1. Enregistrer le rappel via la RPC / Server Action
      const res = await logReminderAction(order.id, 'READY_PICKUP');
      if (!res.success) {
        toast.error(res.error || 'Erreur lors de l\'enregistrement du rappel');
        setLoadingOrderId(null);
        return;
      }

      // 2. Générer le message WhatsApp
      const ticket = order.ticket_number || order.request_code || 'Inconnu';
      const template = customTemplate || DEFAULT_MESSAGE_TEMPLATES.PICKUP_REMINDER;
      const formattedBalance = order.balance_due.toLocaleString('fr-FR');

      const message = renderWhatsAppMessage(template, {
        nom: order.client_name,
        ticket,
        jours: order.days_ready,
        pressing_nom: orgName,
        reste_a_payer: formattedBalance,
      });

      // 3. Ouvrir le lien wa.me
      const waUrl = generateWhatsAppLink(order.client_phone, message);
      window.open(waUrl, '_blank', 'noopener,noreferrer');

      toast.success(`Rappel enregistré pour le ticket ${ticket}`);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur imprévue');
    } finally {
      setLoadingOrderId(null);
    }
  };

  if (orders.length === 0) {
    return (
      <div className="p-8 sm:p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-white">Rien à relancer</h2>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Toutes les commandes prêtes ont été récupérées ou sont prêtes depuis moins longtemps que le délai configuré.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const normalizedPhone = normalizePhoneNumber(order.client_phone, '242');
        const phoneValid = isValidCongoMobile(normalizedPhone);
        const ticketCode = order.ticket_number || order.request_code || 'LB-0000';
        const isProcessing = loadingOrderId === order.id;

        // Calcul heures depuis dernier rappel
        let hoursSinceLast: number | null = null;
        if (order.last_reminder_at) {
          hoursSinceLast = Math.floor(
            (Date.now() - new Date(order.last_reminder_at).getTime()) / (1000 * 60 * 60)
          );
        }

        return (
          <div
            key={order.id}
            className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition space-y-3 shadow-md"
          >
            {/* Entête de carte : Ticket & statut de délai */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-black text-base text-amber-400">
                    {ticketCode}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Prête depuis {order.days_ready} {order.days_ready > 1 ? 'jours' : 'jour'}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white mt-1">{order.client_name}</h3>
              </div>

              <div className="text-right">
                <span className="text-xs font-mono font-bold text-amber-400 block">
                  {order.balance_due.toLocaleString('fr-FR')} FCFA
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Reste à régler
                </span>
              </div>
            </div>

            {/* Infos détails mobile-first */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-2 border-y border-slate-800/80 text-xs text-slate-300">
              <div className="flex items-center space-x-2">
                <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="font-mono">{formatPhoneDisplay(order.client_phone)}</span>
              </div>

              <div className="flex items-center space-x-2">
                {order.mode === 'DELIVERY' ? (
                  <>
                    <Truck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Livraison à domicile</span>
                  </>
                ) : (
                  <>
                    <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Retrait au pressing</span>
                  </>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>
                  Prête le {new Date(order.ready_at).toLocaleDateString('fr-FR')}
                </span>
              </div>
            </div>

            {/* Historique des relances */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="text-[11px] text-slate-400 flex items-center space-x-1.5">
                <RefreshCw className="w-3 h-3 text-slate-500" />
                {order.reminders_count > 0 ? (
                  <span>
                    Rappelé <strong className="text-white">{order.reminders_count} fois</strong>
                    {order.last_reminder_at && (
                      <>, dernier rappel le {new Date(order.last_reminder_at).toLocaleDateString('fr-FR')} à {new Date(order.last_reminder_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} ({hoursSinceLast} h)</>
                    )}
                  </span>
                ) : (
                  <span className="italic text-slate-500">Aucun rappel enregistré pour l'instant</span>
                )}
              </div>

              {/* Bouton d'action */}
              <div>
                {!phoneValid ? (
                  <button
                    disabled
                    className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-slate-800 text-slate-500 text-xs font-semibold flex items-center justify-center space-x-1.5 cursor-not-allowed"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Numéro invalide</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleSendReminder(order)}
                    disabled={isProcessing}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 transition disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <MessageCircle className="w-4 h-4" />
                    )}
                    <span>Rappeler sur WhatsApp</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
