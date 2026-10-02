'use client';

// =============================================================================
// CATALOGUE DES SERVICES PUBLIC LB PRESSING (/{slug}/services)
// Premium Black / White / Gold Theme
// =============================================================================

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Shirt, Sparkles, CheckCircle2 } from 'lucide-react';
import { LB_PRESSING_ORGANIZATION, LB_PRESSING_SERVICES } from '@/lib/fixtures';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function PublicServicesPage() {
  const params = useParams();
  const router = useRouter();
  const slug = (params?.slug as string) || 'lb-pressing';

  return (
    <div className="min-h-screen bg-black text-amber-50 flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-amber-500/20 bg-black/90 backdrop-blur-md px-4 lg:px-8 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href={`/${slug}`} className="flex items-center space-x-2 text-amber-300 hover:text-amber-200 text-sm font-semibold">
            <ArrowLeft className="h-4 w-4" />
            <span>Retour à l'accueil</span>
          </Link>
          <span className="font-extrabold text-white text-lg">{LB_PRESSING_ORGANIZATION.name}</span>
          <Button
            size="sm"
            onClick={() => router.push(`/${slug}/commander`)}
            className="bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-bold text-xs px-4"
          >
            Commander
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>Tarification Transparente FCFA / XAF</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Catalogue Officiel des Services</h1>
          <p className="text-sm text-neutral-400 max-w-lg mx-auto">
            Tous nos tarifs incluent le traitement détachant, le repassage haute précision et l'emballage sous housse protectrice.
          </p>
        </div>

        {/* Services List */}
        <div className="space-y-4">
          {LB_PRESSING_SERVICES.map((service) => (
            <div
              key={service.id}
              className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/80 hover:border-amber-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Shirt className="h-4 w-4 text-amber-400" />
                  <h2 className="font-bold text-white text-base">{service.name}</h2>
                </div>
                <p className="text-xs text-neutral-400">{service.description}</p>
                <div className="flex items-center gap-2 pt-1 text-[11px] text-neutral-500">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  <span>Délai standard: {service.estimatedDays} jours ouvrés</span>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 border-neutral-800 pt-3 sm:pt-0">
                <span className="text-amber-400 font-extrabold text-lg sm:text-xl">
                  {formatCurrency(service.defaultPrice)}
                </span>
                <Button
                  size="sm"
                  onClick={() => router.push(`/${slug}/commander`)}
                  className="bg-neutral-800 hover:bg-amber-500 hover:text-black text-amber-300 font-bold text-xs"
                >
                  Sélectionner
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Action Bottom */}
        <div className="p-6 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-black to-amber-500/10 text-center space-y-4">
          <h3 className="text-lg font-bold text-white">Vous avez plusieurs articles à faire laver ?</h3>
          <p className="text-xs text-neutral-400 max-w-md mx-auto">
            Soumettez votre demande en ligne en quelques secondes. Aucun compte client n'est requis.
          </p>
          <Button
            size="lg"
            onClick={() => router.push(`/${slug}/commander`)}
            className="bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold text-sm px-8 py-6 rounded-xl shadow-lg shadow-amber-500/20"
          >
            Faire une demande de dépôt
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800 bg-black py-6 text-center text-xs text-neutral-500">
        <p>&copy; {new Date().getFullYear()} LB Pressing — Tous droits réservés.</p>
      </footer>
    </div>
  );
}
