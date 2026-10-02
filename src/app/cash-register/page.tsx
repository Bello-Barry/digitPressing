'use client';

// =============================================================================
// CASH REGISTER MODULE - SAAS PRESSING
// Shift Opening, Cash Counting, Variance Analysis, Shift Closing & History
// =============================================================================

import React, { useState } from 'react';
import {
  CreditCard,
  Euro,
  CheckCircle,
  AlertCircle,
  Lock,
  Unlock,
  History,
  Plus
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

export default function CashRegisterPage() {
  const [isOpen, setIsOpen] = useState(true);
  const [openingBalance, setOpeningBalance] = useState(10000);
  const [cashCollected, setCashCollected] = useState(6000);
  const [countedAmount, setCountedAmount] = useState(16000);
  const [closingNotes, setClosingNotes] = useState('');
  const [shiftClosedSuccess, setShiftClosedSuccess] = useState(false);

  const expectedBalance = openingBalance + cashCollected;
  const variance = countedAmount - expectedBalance;

  const handleCloseShift = () => {
    setIsOpen(false);
    setShiftClosedSuccess(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestion de Caisse & Postes</h1>
            <p className="text-sm text-muted-foreground">
              Ouverture de caisse, comptage des espèces et suivi des écarts de clôture
            </p>
          </div>
          <Badge
            variant={isOpen ? 'default' : 'secondary'}
            className={`text-xs px-3 py-1 flex items-center gap-1 ${isOpen ? 'bg-emerald-600' : ''}`}
          >
            {isOpen ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            {isOpen ? 'Caisse Ouverte' : 'Caisse Clôturée'}
          </Badge>
        </div>

        {/* Current Active Register Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 space-y-4 md:col-span-2">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Poste Actuel en Cours
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-muted/40 border">
                <p className="text-xs text-muted-foreground">Fond de Caisse Initial</p>
                <p className="text-base font-bold text-foreground">{formatCurrency(openingBalance)}</p>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border">
                <p className="text-xs text-muted-foreground">Encaissements Espèces</p>
                <p className="text-base font-bold text-emerald-600">+{formatCurrency(cashCollected)}</p>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border">
                <p className="text-xs text-muted-foreground">Total Attendu en Caisse</p>
                <p className="text-base font-bold text-primary">{formatCurrency(expectedBalance)}</p>
              </div>
            </div>

            {/* Shift Closing Controls */}
            {isOpen ? (
              <div className="pt-4 border-t space-y-4">
                <h3 className="text-sm font-bold">Clôture du Poste — Comptage de Caisse</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="counted" className="text-xs font-semibold mb-1 block">
                      Espèces Physiques Comptées (FCFA) *
                    </Label>
                    <Input
                      id="counted"
                      type="number"
                      value={countedAmount}
                      onChange={(e) => setCountedAmount(parseFloat(e.target.value) || 0)}
                      className="h-11"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold mb-1 block">Écart Détecté</Label>
                    <div className={`h-11 rounded-md border px-3 flex items-center font-bold text-sm ${
                      variance === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {variance === 0 ? 'Aucun écart (Parfait)' : `Écart : ${formatCurrency(variance)}`}
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleCloseShift}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3"
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Clôturer le Poste et Valider la Caisse
                </Button>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <p>Le poste est actuellement fermé. Vous pouvez rouvrir un nouveau poste pour la prochaine équipe.</p>
              </div>
            )}
          </Card>

          {/* Quick Actions / Re-open */}
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-bold">Actions Caisse</h2>
            <p className="text-xs text-muted-foreground">
              Toutes les ouvertures et clôtures sont horodatées et associées au membre de l'équipe.
            </p>

            {!isOpen && (
              <Button
                onClick={() => setIsOpen(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              >
                <Unlock className="mr-2 h-4 w-4" />
                Ouvrir la Caisse (Nouveau Poste)
              </Button>
            )}
          </Card>
        </div>

        {/* Shift History Table */}
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Historique des Clôtures de Poste
          </h2>

          <div className="space-y-3 text-sm">
            <div className="p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="font-bold">Poste #104 — Caissier : Mabiala Grâce</p>
                <p className="text-xs text-muted-foreground">Clôturé le {formatDate(new Date())} à 18:30</p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Attendu: {formatCurrency(16000)}</span>
                <Badge variant="outline" className="border-emerald-500 text-emerald-600 text-xs">
                  Compté: {formatCurrency(16000)} (0 FCFA écart)
                </Badge>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
