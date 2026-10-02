'use client';

// =============================================================================
// ANTI-FRAUD & SECURITY ALERTS MODULE - SAAS PRESSING
// Monitor Cancellations, Discounts, Cash Discrepancies, Unpaid Deliveries
// =============================================================================

import React from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  Percent,
  Truck,
  CreditCard,
  Eye,
  CheckCircle
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface AlertItem {
  id: string;
  type: 'cancellation' | 'discount' | 'cash_variance' | 'unpaid_delivery';
  title: string;
  description: string;
  actor: string;
  amount?: number;
  createdAt: string;
  severity: 'high' | 'medium' | 'low';
}

const MOCK_ALERTS: AlertItem[] = [
  {
    id: 'alt-001',
    type: 'cancellation',
    title: 'Annulation de Commande',
    description: 'La commande LB-0038 d\'un montant de 12 000 FCFA a été annulée.',
    actor: 'Mabiala Grâce (Caissier)',
    amount: 12000,
    createdAt: new Date().toISOString(),
    severity: 'high',
  },
  {
    id: 'alt-002',
    type: 'discount',
    title: 'Remise Exceptionnelle Accordée',
    description: 'Une remise de 20% (1 500 FCFA) a été appliquée sur la commande LB-0042.',
    actor: 'Mabiala Grâce (Caissier)',
    amount: 1500,
    createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    severity: 'medium',
  },
  {
    id: 'alt-003',
    type: 'unpaid_delivery',
    title: 'Livraison Non Réglée à la Réception',
    description: 'La commande D-0043 a été livrée sans confirmation immédiate du paiement Mobile Money.',
    actor: 'Livreur Mbemba',
    amount: 7000,
    createdAt: new Date(Date.now() - 7200 * 1000).toISOString(),
    severity: 'high',
  }
];

export default function SecurityAlertsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Alertes de Sécurité & Anti-Détournement</h1>
            <p className="text-sm text-muted-foreground">
              Surveillance automatique des annulations, remises, livraisons impayées et écarts de caisse
            </p>
          </div>
          <Badge variant="destructive" className="text-xs px-3 py-1">
            <ShieldAlert className="h-3.5 w-3.5 mr-1" />
            3 Alertes Récentes
          </Badge>
        </div>

        {/* Security Cards Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="p-4 border-l-4 border-l-red-500">
            <p className="text-xs text-muted-foreground font-semibold">Annulations du Jour</p>
            <p className="text-xl font-bold mt-1 text-red-600">1</p>
          </Card>

          <Card className="p-4 border-l-4 border-l-yellow-500">
            <p className="text-xs text-muted-foreground font-semibold">Remises Accordées</p>
            <p className="text-xl font-bold mt-1 text-yellow-600">1</p>
          </Card>

          <Card className="p-4 border-l-4 border-l-blue-500">
            <p className="text-xs text-muted-foreground font-semibold">Livraisons Impayées</p>
            <p className="text-xl font-bold mt-1 text-blue-600">1</p>
          </Card>

          <Card className="p-4 border-l-4 border-l-emerald-500">
            <p className="text-xs text-muted-foreground font-semibold">Écarts de Caisse</p>
            <p className="text-xl font-bold mt-1 text-emerald-600">0 FCFA</p>
          </Card>
        </div>

        {/* Alerts List */}
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Journal des Événements Sensibles
          </h2>

          <div className="space-y-3">
            {MOCK_ALERTS.map((alert) => (
              <div
                key={alert.id}
                className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{alert.title}</span>
                    <Badge variant={alert.severity === 'high' ? 'destructive' : 'secondary'} className="text-[10px]">
                      Prio {alert.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{alert.description}</p>
                  <p className="text-[11px] text-neutral-500">
                    Déclenché par <strong>{alert.actor}</strong> le {formatDate(alert.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {alert.amount && (
                    <span className="font-extrabold text-sm text-primary">
                      {formatCurrency(alert.amount)}
                    </span>
                  )}
                  <Button size="sm" variant="outline" className="text-xs">
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Inspecter
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
