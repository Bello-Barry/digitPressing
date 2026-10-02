'use client';

// =============================================================================
// ESPACE CLIENT PUBLIC LB PRESSING - HOMEPAGE (/{slug})
// Premium Black / White / Gold Theme, Mobile-First
// =============================================================================

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Shirt,
  Clock,
  MapPin,
  Phone,
  MessageCircle,
  ArrowRight,
  Search,
  Sparkles,
  ShieldCheck,
  Truck
} from 'lucide-react';
import { LB_PRESSING_ORGANIZATION, LB_PRESSING_SERVICES } from '@/lib/fixtures';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function PublicPressingLandingPage() {
  const params = useParams();
  const router = useRouter();
  const slug = (params?.slug as string) || 'lb-pressing';

  // Format WhatsApp Link
  const waNumber = LB_PRESSING_ORGANIZATION.settings.whatsappNumber || '242068000000';
  const waText = encodeURIComponent("Bonjour LB Pressing, je souhaite avoir des informations sur vos services de pressing.");
  const whatsappUrl = `https://wa.me/${waNumber}?text=${waText}`;

  return (
    <div className="min-h-screen bg-black text-amber-50 flex flex-col font-sans selection:bg-amber-400 selection:text-black">
      {/* Header Mobile / Desktop avec Logo Gold */}
      <header className="sticky top-0 z-50 border-b border-amber-500/20 bg-black/90 backdrop-blur-md px-4 lg:px-8 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href={`/${slug}`} className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-200 p-[2px] shadow-lg shadow-amber-500/10">
              <div className="w-full h-full bg-black rounded-full flex items-center justify-center">
                <Shirt className="h-5 w-5 text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-wider bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500 bg-clip-text text-transparent">
                {LB_PRESSING_ORGANIZATION.name}
              </span>
              <span className="block text-[10px] text-amber-400/70 tracking-widest uppercase font-semibold">
                Soin & Prestige Textile
              </span>
            </div>
          </Link>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/${slug}/suivi`)}
              className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200 text-xs sm:text-sm px-3 py-2 h-9"
            >
              <Search className="h-3.5 w-3.5 mr-1.5" />
              Suivre
            </Button>

            <Button
              size="sm"
              onClick={() => router.push(`/${slug}/commander`)}
              className="bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-black font-bold text-xs sm:text-sm px-4 py-2 h-9 shadow-md shadow-amber-500/20"
            >
              Commander
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-12">
        {/* Banner Hero */}
        <section className="relative rounded-2xl border border-amber-500/30 bg-gradient-to-b from-neutral-900 via-black to-neutral-950 p-6 sm:p-12 overflow-hidden shadow-2xl">
          <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl space-y-6 text-left">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Premier Pressing Haute Qualité du Congo</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Soin d'exception pour vos <span className="bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 bg-clip-text text-transparent">vêtements précieux</span>
            </h1>

            <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
              LB Pressing combine techniques traditionnelles de repassage et soins modernes pour préserver l'éclat de vos habits, costumes, robes et textiles de maison.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                onClick={() => router.push(`/${slug}/commander`)}
                className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-black font-extrabold text-base py-6 px-8 rounded-xl shadow-xl shadow-amber-500/20 active:scale-95 transition-all"
              >
                Passer une commande
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center border border-emerald-500/40 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/40 font-bold text-base py-3.5 px-6 rounded-xl transition-all active:scale-95"
              >
                <MessageCircle className="mr-2 h-5 w-5 text-emerald-400" />
                Commander par WhatsApp
              </a>
            </div>
          </div>
        </section>

        {/* Engagements / Advantages */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl border border-amber-500/20 bg-neutral-900/50 flex items-start space-x-4">
            <ShieldCheck className="h-8 w-8 text-amber-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base">Garantie Zéro Tache</h3>
              <p className="text-xs text-neutral-400 mt-1">Inspection méticuleuse à la réception et traitement détachant ciblé.</p>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-amber-500/20 bg-neutral-900/50 flex items-start space-x-4">
            <Clock className="h-8 w-8 text-amber-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base">Délais Respectés</h3>
              <p className="text-xs text-neutral-400 mt-1">Vos vêtements prêts en 24h à 72h selon le niveau d'urgence choisi.</p>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-amber-500/20 bg-neutral-900/50 flex items-start space-x-4">
            <Truck className="h-8 w-8 text-amber-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base">Livraison à Domicile</h3>
              <p className="text-xs text-neutral-400 mt-1">Ramassage et dépôt directement à votre domicile ou bureau.</p>
            </div>
          </div>
        </section>

        {/* Tarifs Principaux */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-wide">Aperçu des Services & Tarifs</h2>
              <p className="text-xs sm:text-sm text-neutral-400">Prix transparents en FCFA / XAF</p>
            </div>
            <Link
              href={`/${slug}/services`}
              className="text-xs sm:text-sm font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              Voir tout
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {LB_PRESSING_SERVICES.slice(0, 6).map((service) => (
              <div
                key={service.id}
                className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/80 hover:border-amber-500/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <h3 className="font-bold text-white text-base">{service.name}</h3>
                    <span className="text-amber-400 font-extrabold text-base ml-2">
                      {formatCurrency(service.defaultPrice)}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-2 line-clamp-2">{service.description}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
                  <span>Délai: {service.estimatedDays} jours</span>
                  <Link href={`/${slug}/commander`} className="text-amber-400 font-bold hover:underline">
                    Choisir →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Informations Pratiques & Contact */}
        <section className="p-6 sm:p-8 rounded-2xl border border-amber-500/30 bg-neutral-900/60 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <MapPin className="h-5 w-5 text-amber-400" />
              Nos Coordonnées
            </h2>
            <div className="space-y-3 text-sm text-neutral-300">
              <p className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-amber-400 flex-shrink-0" />
                <span>{LB_PRESSING_ORGANIZATION.settings.address as string}</span>
              </p>
              <p className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-amber-400 flex-shrink-0" />
                <span>{LB_PRESSING_ORGANIZATION.phone}</span>
              </p>
              <p className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-amber-400 flex-shrink-0" />
                <span>{LB_PRESSING_ORGANIZATION.settings.businessHours as string}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-center space-y-4 border-t md:border-t-0 md:border-l border-neutral-800 pt-6 md:pt-0 md:pl-8">
            <h3 className="font-bold text-white">Besoin d'une assistance immédiate ?</h3>
            <p className="text-xs text-neutral-400">
              Notre équipe répond directement sur WhatsApp pour toute demande urgente de dépôt ou livraison.
            </p>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-3 px-6 rounded-xl transition-all shadow-md shadow-emerald-600/20"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Discuter avec nous sur WhatsApp
            </a>
          </div>
        </section>
      </main>

      {/* Footer Minimaliste Mobile */}
      <footer className="border-t border-neutral-800 bg-black py-6 text-center text-xs text-neutral-500">
        <p>&copy; {new Date().getFullYear()} LB Pressing — Tous droits réservés.</p>
      </footer>
    </div>
  );
}
