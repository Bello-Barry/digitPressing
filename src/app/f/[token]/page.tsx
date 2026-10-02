'use client';

// =============================================================================
// PUBLIC DIGITAL INVOICE (/f/[token])
// Printable Invoice with QR Code, Line Items, WhatsApp wa.me Link
// =============================================================================

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Shirt,
  Printer,
  MessageCircle,
  CheckCircle2,
  MapPin,
  Phone,
  Calendar,
  QrCode
} from 'lucide-react';
import { LB_PRESSING_ORGANIZATION, MOCK_ORDERS } from '@/lib/fixtures';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function PublicInvoicePage() {
  const params = useParams();
  const token = (params?.token as string) || 'ord-001';

  // Find order by token / ID
  const order = MOCK_ORDERS.find(o => o.id === token || o.number === token) || MOCK_ORDERS[0];

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const waNumber = LB_PRESSING_ORGANIZATION.settings.whatsappNumber || '242068000000';
  const waText = encodeURIComponent(
    `Bonjour LB Pressing, je consulte ma facture officielle ${order.number} pour un montant de ${order.total} FCFA.`
  );
  const whatsappUrl = `https://wa.me/${waNumber}?text=${waText}`;

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-sans p-4 sm:p-8 flex flex-col items-center justify-center">
      {/* Printable Invoice Container */}
      <div className="max-w-2xl w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-2xl p-6 sm:p-10 space-y-8 shadow-xl print:border-none print:shadow-none print:p-0">

        {/* Header Branding */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center text-amber-400 font-bold">
              <Shirt className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">{LB_PRESSING_ORGANIZATION.name}</h1>
              <p className="text-xs text-neutral-500">{LB_PRESSING_ORGANIZATION.settings.address as string}</p>
              <p className="text-xs text-neutral-500">Tél : {LB_PRESSING_ORGANIZATION.phone}</p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs text-neutral-400 uppercase font-bold tracking-widest block">Facture / Ticket Officiel</span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 block">{order.number}</span>
            <span className="text-xs text-neutral-500 block">{formatDate(order.createdAt)}</span>
          </div>
        </div>

        {/* Client & Status Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800">
          <div>
            <span className="font-bold text-neutral-400 uppercase block mb-1">Informations Client</span>
            <p className="font-bold text-sm text-neutral-900 dark:text-white">{order.clientName}</p>
            <p className="text-neutral-500">{order.clientPhone}</p>
            {order.clientAddress && <p className="text-neutral-500">{order.clientAddress}</p>}
          </div>

          <div className="space-y-1">
            <span className="font-bold text-neutral-400 uppercase block mb-1">État du Règlement</span>
            <div className="flex items-center gap-2">
              <span className={`font-bold px-2.5 py-0.5 rounded-full text-[11px] ${
                order.paid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {order.paid ? 'PAYÉ IN TÉGRALEMENT' : 'PAIEMENT EN ATTENTE'}
              </span>
            </div>
            <p className="text-neutral-500 pt-1">Émis par : {order.createdByName}</p>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Détail des Prestations</h2>
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden text-xs sm:text-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 font-bold">
                  <th className="p-3">Designation</th>
                  <th className="p-3 text-center">Qté</th>
                  <th className="p-3 text-right">P.U</th>
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {order.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-3 font-medium">{item.name}</td>
                    <td className="p-3 text-center">{item.quantity}</td>
                    <td className="p-3 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="p-3 text-right font-bold">{formatCurrency(item.quantity * item.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals Summary */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-6 pt-4 border-t border-neutral-200 dark:border-neutral-800">
          {/* QR Code Container */}
          <div className="flex items-center space-x-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40">
            <QrCode className="h-12 w-12 text-black dark:text-white" />
            <div className="text-[11px] text-neutral-500">
              <p className="font-bold text-neutral-800 dark:text-neutral-200">Authenticité Vérifiée</p>
              <p>LB Pressing Digital Ticket</p>
            </div>
          </div>

          {/* Pricing Totals */}
          <div className="w-full sm:w-auto space-y-1 text-right text-xs sm:text-sm">
            <div className="flex justify-between sm:justify-end gap-6 text-neutral-500">
              <span>Sous-total:</span>
              <span className="font-bold">{formatCurrency(order.subtotal)}</span>
            </div>
            {order.discount ? (
              <div className="flex justify-between sm:justify-end gap-6 text-emerald-600 font-bold">
                <span>Remise:</span>
                <span>-{formatCurrency(order.discount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between sm:justify-end gap-6 text-lg font-black text-amber-600 dark:text-amber-400 pt-2 border-t">
              <span>Total Général:</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Print / Share Buttons (Hidden on Print) */}
        <div className="no-print pt-6 flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handlePrint}
            variant="outline"
            className="w-full font-bold py-3 h-11"
          >
            <Printer className="mr-2 h-4 w-4" />
            Imprimer la Facture
          </Button>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-3 px-6 rounded-xl transition-all shadow-md shadow-emerald-600/20"
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Partager sur WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
