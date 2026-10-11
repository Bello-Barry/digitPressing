'use client';

// =============================================================================
// COMPOSANT GESTION DÉTAILLÉE D'UNE COMMANDE ADMIN
// Actions métier, attribution atomique du ticket LB-XXXX, encaissement, WhatsApp
// =============================================================================

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  validateOrderAction,
  receiveOrderAction,
  updateOrderStatusAction,
  recordPaymentAction,
  cancelOrderAction,
} from '@/actions/admin';
import { generateWhatsAppLink, formatPhoneDisplay } from '@/lib/whatsapp';
import { ORDER_STATUS_LABELS } from '@/lib/audit-formatter';
import {
  ArrowLeft,
  CheckCircle2,
  PackageCheck,
  DollarSign,
  Printer,
  MessageCircle,
  AlertCircle,
  Truck,
  Building,
  User,
  ShieldCheck,
  XCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';

interface OrderDetailClientProps {
  order: any;
  userRole: string;
}

export function OrderDetailClient({
  order: initialOrder,
  userRole,
}: OrderDetailClientProps) {
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder);
  const [isLoading, setIsLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Formulaires modaux / encarts
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [itemsCount, setItemsCount] = useState(
    initialOrder.items_count_in ||
      initialOrder.order_items?.reduce((s: number, i: any) => s + i.quantity, 0) ||
      1
  );

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(initialOrder.balance_due || 0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'MTN_MOMO' | 'AIRTEL_MONEY' | 'OTHER'>('CASH');
  const [paymentRef, setPaymentRef] = useState('');

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const [showDeliveryOverrideModal, setShowDeliveryOverrideModal] = useState(false);
  const [deliveryOverrideReason, setDeliveryOverrideReason] = useState('');

  // 1. Validation de la demande
  const handleValidate = async () => {
    setIsLoading(true);
    setMsg(null);
    try {
      const res = await validateOrderAction(order.id, order.delivery_fee || 0);
      if (res.success) {
        setMsg({ type: 'success', text: 'Commande validée avec succès.' });
        router.refresh();
      } else {
        setMsg({ type: 'error', text: res.error || 'Erreur de validation.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Réception du linge et attribution du ticket officiel sans trou
  const handleReceiveOrder = async () => {
    setIsLoading(true);
    setMsg(null);
    try {
      const res = await receiveOrderAction(order.id, itemsCount);
      if (res.success && res.ticketNumber) {
        setMsg({
          type: 'success',
          text: `Ticket officiel attribué avec succès : ${res.ticketNumber}`,
        });
        setShowReceiveModal(false);
        router.refresh();
      } else {
        setMsg({ type: 'error', text: res.error || 'Erreur d\'attribution du ticket.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Changement de statut de traitement
  const handleStatusChange = async (newStatus: any, overrideNote?: string) => {
    setIsLoading(true);
    setMsg(null);
    try {
      const res = await updateOrderStatusAction(order.id, newStatus, {
        overrideReason: overrideNote,
      });

      if (res.success) {
        setMsg({ type: 'success', text: `Statut mis à jour : ${newStatus}` });
        setShowDeliveryOverrideModal(false);
        router.refresh();
      } else {
        if (res.error?.includes('dérogation')) {
          setShowDeliveryOverrideModal(true);
        }
        setMsg({ type: 'error', text: res.error || 'Erreur de mise à jour.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Enregistrement d'un paiement
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentAmount <= 0) return;

    setIsLoading(true);
    setMsg(null);
    try {
      const res = await recordPaymentAction(
        order.id,
        paymentAmount,
        paymentMethod,
        paymentRef
      );

      if (res.success) {
        setMsg({ type: 'success', text: 'Paiement enregistré avec succès.' });
        setShowPaymentModal(false);
        router.refresh();
      } else {
        setMsg({ type: 'error', text: res.error || 'Échec de l\'encaissement.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Annulation
  const handleCancelOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMsg(null);
    try {
      const res = await cancelOrderAction(order.id, cancelReason);
      if (res.success) {
        setMsg({ type: 'success', text: 'Commande annulée et consignée dans l\'audit.' });
        setShowCancelModal(false);
        router.refresh();
      } else {
        setMsg({ type: 'error', text: res.error || 'Échec de l\'annulation.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Liens WhatsApp
  const invoiceUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://digitpressing.cg'}/f/${order.invoice_token}`;

  const sendInvoiceMsg = `Bonjour ${order.client_name} 👋
Votre commande de pressing a été enregistrée chez *${order.organization?.name || 'LB Pressing'}*.
🎫 Ticket : *${order.ticket_number || order.request_code}*
💰 Montant : *${Number(order.total_amount).toLocaleString('fr-FR')} FCFA*
💳 Reste à payer : *${Number(order.balance_due).toLocaleString('fr-FR')} FCFA*
📄 Consultez votre facture officielle ici :
${invoiceUrl}`;

  const readyMsg = `Bonjour ${order.client_name} 👋
Bonne nouvelle ! Vos vêtements pour le ticket *${order.ticket_number || order.request_code}* sont lavés, repassés et prêts chez *${order.organization?.name || 'LB Pressing'}*.
💳 Montant à régler : *${Number(order.balance_due).toLocaleString('fr-FR')} FCFA*.
À très bientôt !`;

  const sendInvoiceWhatsApp = generateWhatsAppLink(order.client_phone, sendInvoiceMsg);
  const sendReadyWhatsApp = generateWhatsAppLink(order.client_phone, readyMsg);

  const isSolded = Number(order.balance_due) <= 0;
  const isManagement = userRole === 'OWNER' || userRole === 'MANAGER';
  const canOperateOrder = isManagement || userRole === 'CASHIER';
  const canCollectPayment = isManagement || userRole === 'CASHIER';
  const canDeliver = canOperateOrder || userRole === 'DELIVERY';

  return (
    <div className="space-y-6">
      {/* Barre de retour et titre */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <Link
            href="/admin/commandes"
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-black font-mono text-white">
                {order.ticket_number || order.request_code}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${
                order.status === 'CANCELLED'
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
                {ORDER_STATUS_LABELS[order.status] || order.status}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Créée le {new Date(order.created_at).toLocaleDateString('fr-FR')} à{' '}
              {new Date(order.created_at).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>

        {/* Liens rapides externes */}
        <div className="flex items-center space-x-2">
          {order.invoice_token && (
            <Link
              href={`/f/${order.invoice_token}`}
              target="_blank"
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold flex items-center transition"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1 text-amber-400" />
              Facture client
            </Link>
          )}

          <a
            href={sendInvoiceWhatsApp}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center transition shadow-md shadow-emerald-600/20"
          >
            <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
            WhatsApp Facture
          </a>
        </div>
      </div>

      {order.status === 'CANCELLED' && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-900 text-rose-200 space-y-1">
          <div className="flex items-center space-x-2 font-bold text-rose-400 text-sm">
            <XCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>Commande Annulée</span>
          </div>
          {order.cancellation_reason ? (
            <p className="text-xs text-rose-300 pl-7">
              <span className="font-semibold text-rose-400">Motif d'annulation : </span>
              <span className="italic">{order.cancellation_reason}</span>
            </p>
          ) : (
            <p className="text-xs text-rose-300 pl-7 italic">Aucun motif d'annulation renseigné.</p>
          )}
        </div>
      )}

      {msg && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center space-x-2 ${
            msg.type === 'success'
              ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-200'
              : 'bg-red-950/80 border border-red-800 text-red-200'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* BARRE D'ACTIONS OPÉRATIONNELLES (Flux métier) */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <h2 className="text-xs uppercase font-bold text-slate-400 tracking-wider">
          Actions Métier Disponibles
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          {/* Étape 1 : Valider la demande en ligne */}
          {canOperateOrder && order.status === 'REQUEST' && (
            <button
              onClick={handleValidate}
              disabled={isLoading}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              1. Valider la demande
            </button>
          )}

          {/* Étape 2 : Réception du linge & Génération Ticket LB-XXXX */}
          {canOperateOrder && order.status === 'VALIDATED' && !order.ticket_number && (
            <button
              onClick={() => setShowReceiveModal(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-md shadow-amber-500/20 transition flex items-center"
            >
              <PackageCheck className="w-4 h-4 mr-1.5" />
              2. Réceptionner le linge & Générer le Ticket officiel
            </button>
          )}

          {/* Étape 3 : Démarrer le traitement */}
          {canOperateOrder && order.status === 'RECEIVED' && (
            <button
              onClick={() => handleStatusChange('PROCESSING')}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white font-bold text-xs rounded-xl transition flex items-center"
            >
              <Clock className="w-4 h-4 mr-1.5" />
              3. Lancer le lavage / repassage (PROCESSING)
            </button>
          )}

          {/* Étape 4 : Marquer Prêt */}
          {canOperateOrder && order.status === 'PROCESSING' && (
            <button
              onClick={() => handleStatusChange('READY')}
              disabled={isLoading}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              4. Marquer Prêt pour Retrait / Livraison (READY)
            </button>
          )}

          {/* Alerte WhatsApp Commande prête */}
          {canDeliver && order.status === 'READY' && (
            <a
              href={sendReadyWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition flex items-center shadow-md shadow-emerald-600/20"
            >
              <MessageCircle className="w-4 h-4 mr-1.5" />
              Prévenir le client par WhatsApp (Commande prête)
            </a>
          )}

          {/* Étape 5 : Livrer / Remettre */}
          {order.status === 'READY' && (
            <button
              onClick={() => handleStatusChange('DELIVERED')}
              disabled={isLoading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition flex items-center"
            >
              <Truck className="w-4 h-4 mr-1.5" />
              5. Remettre / Livrer au client (DELIVERED)
            </button>
          )}

          {/* Encaissement de Paiement (disponible à tout moment si solde > 0) */}
          {canCollectPayment && !isSolded && order.status !== 'CANCELLED' && (
            <button
              onClick={() => {
                setPaymentAmount(order.balance_due);
                setShowPaymentModal(true);
              }}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center ml-auto"
            >
              <DollarSign className="w-4 h-4 mr-1" />
              Encaisser un paiement
            </button>
          )}

          {/* Annulation réservée OWNER / MANAGER */}
          {isManagement && order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="px-3 py-2 bg-red-950/40 hover:bg-red-950 text-red-400 font-bold text-xs rounded-xl transition flex items-center"
            >
              <XCircle className="w-4 h-4 mr-1" />
              Annuler
            </button>
          )}
        </div>
      </div>

      {/* Grille principale : Informations client, Articles, Finances */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Colonne gauche : Articles de la commande */}
        <div className="md:col-span-2 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h2 className="font-bold text-white text-sm">
              Articles commandés ({order.order_items?.length || 0})
            </h2>

            <div className="divide-y divide-slate-800/80">
              {order.order_items?.map((item: any) => (
                <div key={item.id} className="py-2.5 flex items-start justify-between text-xs">
                  <div>
                    <p className="font-semibold text-white">{item.service_name}</p>
                    <p className="text-[11px] text-slate-400">
                      {item.quantity} x {Number(item.unit_price).toLocaleString('fr-FR')} FCFA
                    </p>
                    {(item.color || item.pattern || item.brand || item.size || item.item_notes || item.notes) && (
                      <div className="flex flex-wrap gap-1 mt-1 text-[10px] text-slate-300">
                        {item.color && <span className="bg-slate-800 px-1.5 py-0.5 rounded">Couleur: {item.color}</span>}
                        {item.pattern && <span className="bg-slate-800 px-1.5 py-0.5 rounded">Motif: {item.pattern}</span>}
                        {item.brand && <span className="bg-slate-800 px-1.5 py-0.5 rounded">Marque: {item.brand}</span>}
                        {item.size && <span className="bg-slate-800 px-1.5 py-0.5 rounded">Taille: {item.size}</span>}
                        {item.item_notes && <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-medium">Remarque: {item.item_notes}</span>}
                        {item.notes && !item.item_notes && <span className="bg-slate-800 px-1.5 py-0.5 rounded">{item.notes}</span>}
                      </div>
                    )}
                  </div>
                  <p className="font-mono font-bold text-white whitespace-nowrap ml-2">
                    {Number(item.line_total).toLocaleString('fr-FR')} FCFA
                  </p>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-between text-xs font-bold text-white">
              <span>Sous-total articles :</span>
              <span className="font-mono text-amber-400">
                {Number(order.subtotal).toLocaleString('fr-FR')} FCFA
              </span>
            </div>
          </div>

          {/* Historique des paiements encaissés */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h2 className="font-bold text-white text-sm flex items-center justify-between">
              <span>Écritures d'encaissement</span>
              <span className="font-mono text-xs text-emerald-400">
                Total réglé : {Number(order.paid_amount).toLocaleString('fr-FR')} FCFA
              </span>
            </h2>

            {order.payments && order.payments.length > 0 ? (
              <div className="space-y-2">
                {order.payments.map((p: any) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-white font-mono">
                        {Number(p.amount).toLocaleString('fr-FR')} FCFA
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {p.method} • {new Date(p.collected_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    {p.reference && (
                      <span className="text-[10px] font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                        Réf: {p.reference}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-2">Aucun versement enregistré pour le moment.</p>
            )}
          </div>
        </div>

        {/* Colonne droite : Coordonnées Client & Décompte Solde */}
        <div className="space-y-4">
          {/* Fiche Client */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
            <h2 className="font-bold text-white text-sm flex items-center">
              <User className="w-4 h-4 mr-1.5 text-amber-400" />
              Fiche Client
            </h2>

            <div className="space-y-1.5">
              <p className="text-slate-400">Nom :</p>
              <p className="font-bold text-white text-sm">{order.client_name}</p>
            </div>

            <div className="space-y-1.5">
              <p className="text-slate-400">Téléphone WhatsApp :</p>
              <a
                href={`tel:${order.client_phone}`}
                className="font-mono font-bold text-amber-400 hover:underline block"
              >
                {formatPhoneDisplay(order.client_phone)}
              </a>
            </div>

            <div className="space-y-1.5">
              <p className="text-slate-400">Mode de service :</p>
              <p className="font-semibold text-white">{order.mode}</p>
              {order.delivery_address && (
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Adresse : {order.delivery_address}
                </p>
              )}
            </div>

            {order.notes && (
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <p className="text-slate-400">Consignes client :</p>
                <p className="text-slate-300 italic">{order.notes}</p>
              </div>
            )}
          </div>

          {/* État Financier & Reste à Payer */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
            <h2 className="font-bold text-white text-sm flex items-center">
              <DollarSign className="w-4 h-4 mr-1.5 text-amber-400" />
              Bilan Financier
            </h2>

            <div className="space-y-1.5 text-slate-300">
              <div className="flex justify-between">
                <span>Total commande :</span>
                <span className="font-mono font-bold text-white">
                  {Number(order.total_amount).toLocaleString('fr-FR')} FCFA
                </span>
              </div>

              <div className="flex justify-between">
                <span>Acompte encaissé :</span>
                <span className="font-mono text-emerald-400">
                  {Number(order.paid_amount).toLocaleString('fr-FR')} FCFA
                </span>
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-sm">
                <span>Reste à payer :</span>
                <span
                  className={`font-mono ${
                    isSolded ? 'text-emerald-400' : 'text-red-400 font-extrabold'
                  }`}
                >
                  {Number(order.balance_due).toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1 : RÉCEPTION & ATTRIBUTION TICKET LB-XXXX */}
      {showReceiveModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center">
              <PackageCheck className="w-5 h-5 mr-2 text-amber-400" />
              Réception & Comptage Linge
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              Le linge a-t-il été vérifié au comptoir ? Le ticket officiel sans trou (ex: <span className="font-mono text-amber-400 font-bold">LB-0001</span>) va être généré.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Nombre de pièces comptées physiquement
              </label>
              <input
                type="number"
                min="1"
                required
                value={itemsCount}
                onChange={(e) => setItemsCount(parseInt(e.target.value) || 1)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowReceiveModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleReceiveOrder}
                disabled={isLoading}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold"
              >
                Attribuer Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2 : ENCAISSEMENT PAIEMENT */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleRecordPayment}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl"
          >
            <h3 className="text-base font-bold text-white flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-emerald-400" />
              Enregistrer un Encaissement
            </h3>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Montant encaissé (FCFA)
              </label>
              <input
                type="number"
                min="1"
                required
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Mode de règlement
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value="CASH">Espèces (CASH)</option>
                <option value="MTN_MOMO">MTN Mobile Money</option>
                <option value="AIRTEL_MONEY">Airtel Money</option>
                <option value="OTHER">Autre</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Référence transaction (Optionnel pour MoMo)
              </label>
              <input
                type="text"
                placeholder="Ex: TX-98432"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold"
              >
                Valider l'encaissement
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3 : DÉROGATION LIVRAISON IMPAYÉE (Anti-détournement) */}
      {showDeliveryOverrideModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-800/80 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-red-400 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              Dérogation Livraison Impayée
            </h3>

            <p className="text-xs text-slate-300">
              Cette commande présente un solde impayé de <span className="font-bold text-red-400 font-mono">{Number(order.balance_due).toLocaleString('fr-FR')} FCFA</span>. La politique anti-détournement exige un motif formel consigné dans l'audit.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Motif de la dérogation (créance client)
              </label>
              <textarea
                required
                rows={3}
                placeholder="Ex: Client fidèle entreprise, accord paiement fin de mois..."
                value={deliveryOverrideReason}
                onChange={(e) => setDeliveryOverrideReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeliveryOverrideModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('DELIVERED', deliveryOverrideReason)}
                disabled={isLoading || deliveryOverrideReason.trim().length < 5}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold"
              >
                Confirmer Dérogation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4 : ANNULATION AVEC MOTIF OBLIGATOIRE */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCancelOrder}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl"
          >
            <h3 className="text-base font-bold text-white flex items-center">
              <XCircle className="w-5 h-5 mr-2 text-red-400" />
              Annulation de Commande
            </h3>

            <p className="text-xs text-slate-300">
              Aucune suppression physique n'est autorisée. L'annulation sera tracée dans le journal d'audit.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Motif d'annulation obligatoire
              </label>
              <textarea
                required
                rows={3}
                placeholder="Ex: Erreur de saisie client, commande en double..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Retour
              </button>
              <button
                type="submit"
                disabled={isLoading || cancelReason.trim().length < 5}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold"
              >
                Confirmer Annulation
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
