'use client';

// =============================================================================
// IMMUTABLE PAYMENTS MODULE - SAAS PRESSING
// Immutable Ledger: CASH, MTN_MOMO, AIRTEL_MONEY, OTHER. Corrections via Reversal
// =============================================================================

import React, { useState } from 'react';
import {
  CreditCard,
  Euro,
  RotateCcw,
  ShieldAlert,
  Search,
  Plus,
  Calendar,
  CheckCircle,
  FileText
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface PaymentLedgerEntry {
  id: string;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  paymentMethod: 'CASH' | 'MTN_MOMO' | 'AIRTEL_MONEY' | 'OTHER';
  isReversal: boolean;
  reversalReason?: string;
  createdBy: string;
  createdAt: string;
}

const MOCK_PAYMENTS: PaymentLedgerEntry[] = [
  {
    id: 'pay-001',
    invoiceNumber: 'LB-0042',
    clientName: 'Matingou Christian',
    amount: 9000,
    paymentMethod: 'CASH',
    isReversal: false,
    createdBy: 'Mabiala Grâce',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'pay-002',
    invoiceNumber: 'LB-0040',
    clientName: 'Sassou Yvonne',
    amount: 7000,
    paymentMethod: 'MTN_MOMO',
    isReversal: false,
    createdBy: 'Mabiala Grâce',
    createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
  },
  {
    id: 'pay-003',
    invoiceNumber: 'LB-0039',
    clientName: 'Kabila Jean',
    amount: -3000,
    paymentMethod: 'CASH',
    isReversal: true,
    reversalReason: 'Correction erreur saisie sur devis',
    createdBy: 'Barry Bello (Owner)',
    createdAt: new Date(Date.now() - 7200 * 1000).toISOString(),
  }
];

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentLedgerEntry[]>(MOCK_PAYMENTS);
  const [selectedPaymentForReversal, setSelectedPaymentForReversal] = useState<PaymentLedgerEntry | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  const handleCreateReversal = () => {
    if (!selectedPaymentForReversal || !reversalReason.trim()) return;

    const reversalEntry: PaymentLedgerEntry = {
      id: `pay-rev-${Date.now()}`,
      invoiceNumber: selectedPaymentForReversal.invoiceNumber,
      clientName: selectedPaymentForReversal.clientName,
      amount: -Math.abs(selectedPaymentForReversal.amount),
      paymentMethod: selectedPaymentForReversal.paymentMethod,
      isReversal: true,
      reversalReason: reversalReason.trim(),
      createdBy: 'Propriétaire (Écriture d\'inversion)',
      createdAt: new Date().toISOString(),
    };

    setPayments([reversalEntry, ...payments]);
    setSelectedPaymentForReversal(null);
    setReversalReason('');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Livre Journal des Paiements</h1>
            <p className="text-sm text-muted-foreground">
              Écritures comptables immuables — Toute correction s'effectue par écriture inverse avec motif.
            </p>
          </div>
          <Badge variant="outline" className="text-xs px-3 py-1 border-emerald-500 text-emerald-600">
            Journal Immuable Actif
          </Badge>
        </div>

        {/* Payment Methods Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="p-4 border-l-4 border-l-emerald-500">
            <p className="text-xs text-muted-foreground font-semibold">Espèces (CASH)</p>
            <p className="text-xl font-bold mt-1">{formatCurrency(6000)}</p>
          </Card>

          <Card className="p-4 border-l-4 border-l-yellow-500">
            <p className="text-xs text-muted-foreground font-semibold">MTN Mobile Money</p>
            <p className="text-xl font-bold mt-1">{formatCurrency(7000)}</p>
          </Card>

          <Card className="p-4 border-l-4 border-l-red-500">
            <p className="text-xs text-muted-foreground font-semibold">Airtel Money</p>
            <p className="text-xl font-bold mt-1">{formatCurrency(0)}</p>
          </Card>

          <Card className="p-4 border-l-4 border-l-purple-500">
            <p className="text-xs text-muted-foreground font-semibold">Total Net</p>
            <p className="text-xl font-bold text-primary mt-1">{formatCurrency(13000)}</p>
          </Card>
        </div>

        {/* Ledger Entries Table */}
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-bold">Historique Inaltérable</h2>

          <div className="space-y-3">
            {payments.map((p) => (
              <div
                key={p.id}
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  p.isReversal ? 'border-red-200 bg-red-50/40 dark:bg-red-950/20' : 'border-neutral-200 dark:border-neutral-800'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{p.invoiceNumber} — {p.clientName}</span>
                    <Badge variant={p.isReversal ? 'destructive' : 'default'} className="text-[10px]">
                      {p.paymentMethod}
                    </Badge>
                    {p.isReversal && (
                      <Badge variant="outline" className="text-[10px] border-red-500 text-red-600">
                        Inversion / Compensation
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enregistré par {p.createdBy} le {formatDate(p.createdAt)}
                  </p>
                  {p.reversalReason && (
                    <p className="text-xs text-red-600 dark:text-red-400 font-semibold">
                      Motif d'inversion : {p.reversalReason}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <span className={`font-extrabold text-base ${p.amount < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {p.amount < 0 ? '' : '+'}{formatCurrency(p.amount)}
                  </span>

                  {!p.isReversal && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedPaymentForReversal(p)}
                      className="text-xs text-red-600 hover:bg-red-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Inverser
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Reversal Confirmation Modal */}
      <Dialog open={!!selectedPaymentForReversal} onOpenChange={() => setSelectedPaymentForReversal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Écriture Compensatoire d'Inversion</DialogTitle>
            <DialogDescription>
              Avertissement : Les encaissements ne sont pas supprimés. Une écriture négative opposée sera enregistrée dans le journal immuable.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-bold block mb-1">Montant à Inverser</Label>
              <p className="text-lg font-bold text-red-600">-{formatCurrency(selectedPaymentForReversal?.amount || 0)}</p>
            </div>

            <div>
              <Label htmlFor="reason" className="text-xs font-bold block mb-1">Motif obligatoire d'annulation/remboursement *</Label>
              <Textarea
                id="reason"
                rows={3}
                placeholder="Ex: Erreur de saisie caisse, remboursement accordé par le manager..."
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPaymentForReversal(null)}>
              Annuler
            </Button>
            <Button
              onClick={handleCreateReversal}
              disabled={!reversalReason.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Enregistrer l'Inversion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
