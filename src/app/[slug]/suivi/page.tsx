'use client';

// =============================================================================
// PUBLIC ORDER TRACKING PAGE (/{slug}/suivi)
// Timeline State Progression: REQUEST -> VALIDATED -> RECEIVED -> PROCESSING -> READY -> DELIVERED
// =============================================================================

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Search,
  CheckCircle,
  Clock,
  Shirt,
  Truck,
  XCircle,
  FileText,
  MessageCircle,
  Package
} from 'lucide-react';
import { LB_PRESSING_ORGANIZATION, MOCK_ORDERS } from '@/lib/fixtures';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Invoice } from '@/types';

const TIMELINE_STEPS = [
  { key: 'REQUEST', label: 'Demande Soumise', icon: Clock },
  { key: 'VALIDATED', label: 'Validée', icon: CheckCircle },
  { key: 'RECEIVED', label: 'Linge Reçu (Ticket Officiel)', icon: Shirt },
  { key: 'PROCESSING', label: 'En Traitement / Nettoyage', icon: Package },
  { key: 'READY', label: 'Prêt au Retrait', icon: CheckCircle },
  { key: 'DELIVERED', label: 'Retiré / Livré', icon: Truck },
];

export default function PublicOrderTrackingPage() {
  const params = useParams();
  const slug = (params?.slug as string) || 'lb-pressing';

  const [searchQuery, setSearchQuery] = useState('');
  const [searchedOrder, setSearchedOrder] = useState<Invoice | null>(MOCK_ORDERS[0] || null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const term = searchQuery.trim().toLowerCase();
    const found = MOCK_ORDERS.find(
      o => o.number.toLowerCase() === term || (o.clientPhone && o.clientPhone.includes(term))
    );

    setSearchedOrder(found || null);
  };

  // Determine active step index in timeline
  const getActiveStepIndex = (order: Invoice) => {
    if (order.withdrawn) return 5; // DELIVERED
    if (order.paid && order.number.startsWith('LB-')) return 4; // READY
    if (order.number.startsWith('LB-')) return 2; // RECEIVED
    return 0; // REQUEST
  };

  const currentStepIdx = searchedOrder ? getActiveStepIndex(searchedOrder) : 0;

  return (
    <div className="min-h-screen bg-black text-amber-50 flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-amber-500/20 bg-black/90 backdrop-blur-md px-4 lg:px-8 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href={`/${slug}`} className="flex items-center space-x-2 text-amber-300 hover:text-amber-200 text-sm font-semibold">
            <ArrowLeft className="h-4 w-4" />
            <span>Accueil</span>
          </Link>
          <span className="font-extrabold text-white text-lg">{LB_PRESSING_ORGANIZATION.name}</span>
          <span className="text-xs text-amber-400 font-bold border border-amber-500/30 px-2.5 py-1 rounded-full">
            Suivi Client
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Suivi de Commande en Temps Réel</h1>
          <p className="text-xs sm:text-sm text-neutral-400">
            Entrez votre numéro de ticket (ex: LB-0042) ou votre numéro WhatsApp.
          </p>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <Input
              placeholder="Numéro de ticket (LB-XXXX) ou téléphone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-neutral-900 border-neutral-800 text-white h-12 text-sm focus:border-amber-400"
            />
          </div>
          <Button
            type="submit"
            className="bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold px-6 h-12"
          >
            Rechercher
          </Button>
        </form>

        {/* Search Result View */}
        {searchedOrder ? (
          <Card className="bg-neutral-900 border-amber-500/30 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-800 pb-4 gap-2">
              <div>
                <span className="text-xs text-amber-400 font-bold uppercase tracking-wider block">Ticket Officiel</span>
                <h2 className="text-2xl font-black text-white">{searchedOrder.number}</h2>
                <p className="text-xs text-neutral-400">Client : {searchedOrder.clientName}</p>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-xs text-neutral-400 block">Total</span>
                <span className="text-lg font-extrabold text-amber-400">{formatCurrency(searchedOrder.total)}</span>
              </div>
            </div>

            {/* Timeline Progress */}
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Progression de votre linge</h3>

              <div className="space-y-4 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-800">
                {TIMELINE_STEPS.map((step, idx) => {
                  const isDone = idx <= currentStepIdx;
                  const isCurrent = idx === currentStepIdx;
                  const StepIcon = step.icon;

                  return (
                    <div key={step.key} className="flex items-center space-x-4 relative z-10">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                          isDone
                            ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
                            : 'bg-neutral-800 text-neutral-500'
                        }`}
                      >
                        <StepIcon className="h-4 w-4" />
                      </div>

                      <div className="flex-1">
                        <p className={`text-xs sm:text-sm font-bold ${isDone ? 'text-white' : 'text-neutral-500'}`}>
                          {step.label}
                        </p>
                        {isCurrent && (
                          <p className="text-[11px] text-amber-400 font-semibold mt-0.5">
                            Étape en cours
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-neutral-800 flex flex-col sm:flex-row gap-3">
              <Link href={`/f/${searchedOrder.id}`} className="w-full">
                <Button variant="outline" className="w-full border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-xs py-3 h-11">
                  <FileText className="mr-2 h-4 w-4" />
                  Consulter la Facture Digitale
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <Card className="bg-neutral-900 border-neutral-800 p-8 text-center text-neutral-400 space-y-2">
            <Package className="h-10 w-10 mx-auto text-neutral-600 mb-2" />
            <p className="text-sm font-semibold text-white">Aucune commande trouvée</p>
            <p className="text-xs">Veuillez vérifier votre numéro de ticket ou votre numéro de téléphone.</p>
          </Card>
        )}
      </main>
    </div>
  );
}
