'use client';

// =============================================================================
// COMPOSANT FACTURE IMPRIMABLE & TICKET DE CAISSE
// Conforme copilote.md : CSS print, QR code vers suivi, WhatsApp, solde immuable
// =============================================================================

import React from 'react';
import Link from 'next/link';
import { generateWhatsAppLink, formatPhoneDisplay } from '@/lib/whatsapp';
import {
  Printer,
  MessageCircle,
  Share2,
  CheckCircle2,
  Clock,
  ShieldCheck,
  MapPin,
  Phone,
} from 'lucide-react';

interface InvoiceData {
  order: {
    id: string;
    request_code: string;
    ticket_number: string | null;
    status: string;
    client_name: string;
    client_phone: string;
    mode: string;
    subtotal: number;
    delivery_fee: number;
    discount_amount: number;
    total_amount: number;
    items_count_in: number | null;
    created_at: string;
    requested_at: string | null;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    ticket_prefix: string;
    phone_1: string | null;
    phone_2: string | null;
    email: string | null;
    address: string | null;
    currency: string;
    footer_text: string | null;
  };
  items: Array<{
    id: string;
    service_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    notes: string | null;
    item_type?: string | null;
    color?: string | null;
    pattern?: string | null;
    brand?: string | null;
    size?: string | null;
    item_notes?: string | null;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    method: string;
    collected_at: string;
  }> | null;
  summary: {
    paid_amount: number;
    balance_due: number;
  };
}

interface InvoicePrintViewProps {
  data: InvoiceData;
  token: string;
}

export function InvoicePrintView({ data, token }: InvoicePrintViewProps) {
  const { order, organization, items, payments, summary } = data;

  const handlePrint = () => {
    window.print();
  };

  const trackingCode = order.ticket_number || order.request_code;
  const trackingUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/${organization.slug}/suivi?code=${trackingCode}&tel=${encodeURIComponent(order.client_phone)}`
    : `https://digitpressing.cg/${organization.slug}/suivi?code=${trackingCode}&tel=${encodeURIComponent(order.client_phone)}`;

  // URL QR Code instantané haute résolution
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=2&data=${encodeURIComponent(
    trackingUrl
  )}`;

  // Partage WhatsApp vers le client
  const clientWhatsAppMessage = `Bonjour ${order.client_name} 👋
Voici votre facture officielle de pressing chez *${organization.name}* :
🎫 Ticket : *${order.ticket_number || order.request_code}*
💰 Total : *${Number(order.total_amount).toLocaleString('fr-FR')} FCFA*
💳 Reste à payer : *${Number(summary.balance_due).toLocaleString('fr-FR')} FCFA*
📄 Accédez à votre facture détaillée ici :
${typeof window !== 'undefined' ? window.location.href : `https://digitpressing.cg/f/${token}`}

Merci pour votre confiance !`;

  const clientWhatsAppLink = generateWhatsAppLink(
    order.client_phone,
    clientWhatsAppMessage
  );

  const statusLabels: Record<string, string> = {
    REQUEST: 'Demande en attente',
    VALIDATED: 'Validée',
    RECEIVED: 'Linge Réceptionné',
    PROCESSING: 'En cours de traitement',
    READY: 'Prêt pour retrait / livraison',
    DELIVERED: 'Livré & Clôturé',
    CANCELLED: 'Annulée',
    REJECTED: 'Refusée',
  };

  const isPaid = Number(summary.balance_due) <= 0;

  return (
    <div className="space-y-4">
      {/* Barre d'actions supérieure (masquée à l'impression) */}
      <div className="print:hidden p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <Link
          href={`/${organization.slug}`}
          className="text-xs font-semibold text-slate-300 hover:text-white"
        >
          ← {organization.name}
        </Link>

        <div className="flex items-center space-x-2">
          <a
            href={clientWhatsAppLink}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center transition shadow-md shadow-emerald-600/20"
          >
            <MessageCircle className="w-4 h-4 mr-1.5" />
            Envoyer sur WhatsApp
          </a>

          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center transition shadow-md shadow-amber-500/20"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            Imprimer / PDF
          </button>
        </div>
      </div>

      {/* FEUILLE DE FACTURE / REÇU (imprimable) */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 md:p-8 space-y-6 shadow-2xl print:bg-white print:border-none print:shadow-none print:p-4 print:text-black">
        {/* Entête du pressing */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-6 border-b border-slate-800 print:border-neutral-300 gap-4">
          <div className="space-y-1">
            <div className="inline-block px-3 py-1 rounded-lg bg-amber-500/10 print:bg-neutral-100 text-amber-400 print:text-neutral-900 font-black text-sm tracking-wider">
              {organization.ticket_prefix} PRESSING
            </div>
            <h1 className="text-2xl font-black text-white print:text-black tracking-tight">
              {organization.name}
            </h1>
            <p className="text-xs text-slate-400 print:text-neutral-600 flex items-center">
              <MapPin className="w-3.5 h-3.5 mr-1 text-amber-400 print:text-black shrink-0" />
              {organization.address || 'Brazzaville, Congo'}
            </p>
            <p className="text-xs text-slate-400 print:text-neutral-600 flex items-center">
              <Phone className="w-3.5 h-3.5 mr-1 text-amber-400 print:text-black shrink-0" />
              {formatPhoneDisplay(organization.phone_1 || '')}{' '}
              {organization.phone_2 && `• ${formatPhoneDisplay(organization.phone_2)}`}
            </p>
          </div>

          <div className="sm:text-right space-y-1">
            <p className="text-xs uppercase font-bold text-slate-400 print:text-neutral-500">
              {order.ticket_number ? 'Ticket de Dépôt Officiel' : 'Demande de Pressing'}
            </p>
            <p className="text-2xl md:text-3xl font-black font-mono text-amber-400 print:text-black tracking-wider">
              {order.ticket_number || order.request_code}
            </p>
            <p className="text-xs text-slate-400 print:text-neutral-600">
              Date : {new Date(order.created_at).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            <div className="pt-1">
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  isPaid
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 print:border-black print:text-black'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 print:border-black print:text-black'
                }`}
              >
                {isPaid ? 'RÉGLÉ' : 'SOLDE EN ATTENTE'} • {statusLabels[order.status] || order.status}
              </span>
            </div>
          </div>
        </div>

        {/* Coordonnées Client */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-950/60 print:bg-neutral-50 border border-slate-800 print:border-neutral-200 text-xs">
          <div>
            <p className="font-semibold text-slate-400 print:text-neutral-500">Client :</p>
            <p className="font-bold text-white print:text-black text-sm mt-0.5">
              {order.client_name}
            </p>
            <p className="font-mono text-slate-300 print:text-neutral-700">
              {formatPhoneDisplay(order.client_phone)}
            </p>
          </div>

          <div>
            <p className="font-semibold text-slate-400 print:text-neutral-500">
              Mode de Service :
            </p>
            <p className="font-bold text-white print:text-black text-sm mt-0.5">
              {order.mode === 'DROP_OFF'
                ? 'Dépôt au pressing'
                : order.mode === 'PICKUP'
                ? 'Collecte à domicile'
                : 'Livraison complète'}
            </p>
            {order.items_count_in && (
              <p className="text-slate-400 print:text-neutral-600 mt-0.5">
                Nombre de pièces comptées : <span className="font-bold">{order.items_count_in}</span>
              </p>
            )}
          </div>
        </div>

        {/* Tableau des Articles */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 print:border-neutral-300 text-slate-400 print:text-neutral-700 font-bold">
                <th className="py-2.5 px-2">Article / Prestation</th>
                <th className="py-2.5 px-2 text-center w-16">Qté</th>
                <th className="py-2.5 px-2 text-right w-24">P.U (FCFA)</th>
                <th className="py-2.5 px-2 text-right w-28">Total (FCFA)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 print:divide-neutral-200">
              {items && items.length > 0 ? (
                items.map((item) => (
                  <tr key={item.id} className="text-slate-200 print:text-black">
                    <td className="py-2.5 px-2">
                      <p className="font-semibold">{item.service_name}</p>
                      {(item.color || item.pattern || item.brand || item.size || item.item_notes || item.notes) && (
                        <div className="text-[11px] text-slate-400 print:text-neutral-600 mt-0.5 flex flex-wrap gap-x-2">
                          {item.color && <span>Couleur: {item.color}</span>}
                          {item.pattern && <span>Motif: {item.pattern}</span>}
                          {item.brand && <span>Marque: {item.brand}</span>}
                          {item.size && <span>Taille: {item.size}</span>}
                          {item.item_notes && <span className="text-amber-300 print:text-neutral-800 font-medium">Obs: {item.item_notes}</span>}
                          {item.notes && !item.item_notes && <span>{item.notes}</span>}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono font-bold">
                      {item.quantity}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-400 print:text-neutral-700">
                      {Number(item.unit_price).toLocaleString('fr-FR')}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-white print:text-black">
                      {Number(item.line_total).toLocaleString('fr-FR')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-slate-500">
                    Aucun article spécifié
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Décompte Financier */}
        <div className="pt-4 border-t border-slate-800 print:border-neutral-300 flex flex-col sm:flex-row justify-between items-start gap-6">
          {/* QR Code de Suivi Rapide */}
          <div className="flex items-center space-x-3 p-3 rounded-2xl bg-slate-950/80 print:bg-white border border-slate-800 print:border-neutral-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrCodeUrl}
              alt="QR Code Suivi"
              width={80}
              height={80}
              className="rounded-lg shrink-0 print:border print:border-black"
            />
            <div className="space-y-0.5 text-[11px] text-slate-400 print:text-neutral-600">
              <p className="font-bold text-white print:text-black">Scanner pour le suivi</p>
              <p>Scannez pour consulter l'avancement en direct de votre linge.</p>
            </div>
          </div>

          {/* Totaux & Solde */}
          <div className="w-full sm:w-64 space-y-1.5 text-xs text-right">
            <div className="flex justify-between text-slate-400 print:text-neutral-600">
              <span>Sous-total :</span>
              <span className="font-mono text-white print:text-black">
                {Number(order.subtotal).toLocaleString('fr-FR')} FCFA
              </span>
            </div>

            {Number(order.delivery_fee) > 0 && (
              <div className="flex justify-between text-slate-400 print:text-neutral-600">
                <span>Frais de livraison :</span>
                <span className="font-mono text-white print:text-black">
                  +{Number(order.delivery_fee).toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            )}

            {Number(order.discount_amount) > 0 && (
              <div className="flex justify-between text-emerald-400 print:text-black">
                <span>Remise accordée :</span>
                <span className="font-mono">
                  -{Number(order.discount_amount).toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            )}

            <div className="flex justify-between pt-1 border-t border-slate-800 print:border-neutral-300 text-sm font-bold text-white print:text-black">
              <span>Total Commande :</span>
              <span className="font-mono text-amber-400 print:text-black">
                {Number(order.total_amount).toLocaleString('fr-FR')} FCFA
              </span>
            </div>

            <div className="flex justify-between text-emerald-400 print:text-neutral-800">
              <span>Acompte payé :</span>
              <span className="font-mono">
                {Number(summary.paid_amount).toLocaleString('fr-FR')} FCFA
              </span>
            </div>

            <div className="flex justify-between pt-1 border-t border-slate-800 print:border-neutral-400 font-extrabold text-sm">
              <span className="text-white print:text-black">Reste à payer :</span>
              <span
                className={`font-mono ${
                  Number(summary.balance_due) > 0
                    ? 'text-red-400 print:text-black'
                    : 'text-emerald-400 print:text-black'
                }`}
              >
                {Number(summary.balance_due).toLocaleString('fr-FR')} FCFA
              </span>
            </div>
          </div>
        </div>

        {/* Historique des Règlements si existants */}
        {payments && payments.length > 0 && (
          <div className="p-3 rounded-xl bg-slate-950/40 print:bg-neutral-50 border border-slate-800/60 print:border-neutral-200 text-[11px] space-y-1">
            <p className="font-bold text-slate-400 print:text-neutral-600">
              Règlements enregistrés :
            </p>
            {payments.map((p) => (
              <div
                key={p.id}
                className="flex justify-between text-slate-300 print:text-neutral-800 font-mono"
              >
                <span>
                  {new Date(p.collected_at).toLocaleDateString('fr-FR')} • {p.method}
                </span>
                <span className="font-bold">
                  {Number(p.amount).toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Pied de Facture & Conditions */}
        <div className="pt-4 border-t border-slate-800 print:border-neutral-300 text-center text-[10px] text-slate-400 print:text-neutral-600 space-y-1">
          <p className="font-semibold text-slate-300 print:text-neutral-700">
            {organization.footer_text || 'Merci pour votre confiance !'}
          </p>
          <p>
            Tout vêtement non retiré après un délai de 30 jours fera l'objet d'une majoration. Le ticket officiel fait foi pour le retrait du linge.
          </p>
        </div>
      </div>
    </div>
  );
}
