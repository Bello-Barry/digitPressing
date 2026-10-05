import Link from 'next/link';
import { Shirt, ShoppingBag, ShieldCheck, ArrowRight, Search, Lock, MapPin, Phone } from 'lucide-react';

export const metadata = {
  title: 'LB Pressing | Blanchisserie & Pressing Haute Qualité Brazzaville',
  description: 'Application de pressing et commande en ligne à Brazzaville. Suivi en direct et livraison à domicile.',
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 font-black flex items-center justify-center text-sm shadow-md shadow-amber-500/20">
              LB
            </div>
            <div>
              <span className="font-extrabold text-base text-white tracking-tight">LB Pressing</span>
              <span className="block text-[10px] text-amber-400 font-medium">Brazzaville, Congo</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Link
              href="/admin"
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold flex items-center transition"
            >
              <Lock className="w-3.5 h-3.5 mr-1 text-slate-400" />
              Espace Admin
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 md:py-16 space-y-10">
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Service Officiel LB Pressing</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            L'excellence du pressing pour vos habits précieux.
          </h1>

          <p className="text-sm md:text-base text-slate-300">
            Confiez vos costumes, robes de cérémonie, bazins et tissus délicats à notre atelier à Brazzaville. Commandez sans compte en 1 minute.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/lb-pressing/commander"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-extrabold text-sm shadow-xl shadow-amber-500/20 flex items-center justify-center transition"
            >
              <ShoppingBag className="w-4 h-4 mr-2" />
              Passer une commande
            </Link>

            <Link
              href="/lb-pressing/suivi"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-semibold text-sm flex items-center justify-center transition"
            >
              <Search className="w-4 h-4 mr-2 text-amber-400" />
              Suivre mon linge
            </Link>
          </div>
        </div>

        {/* Accès Rapides */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          <Link
            href="/lb-pressing"
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 transition group space-y-2"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Shirt className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm group-hover:text-amber-400 transition">
              Accueil LB Pressing
            </h3>
            <p className="text-xs text-slate-400">
              Présentation, garanties, horaires d'ouverture et coordonnées.
            </p>
          </Link>

          <Link
            href="/lb-pressing/services"
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 transition group space-y-2"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm group-hover:text-amber-400 transition">
              Prestations & Tarifs
            </h3>
            <p className="text-xs text-slate-400">
              Grille tarifaire officielle complète pour chaque type de vêtement.
            </p>
          </Link>

          <Link
            href="/admin"
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 transition group space-y-2"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm group-hover:text-amber-400 transition">
              Espace Personnel & Admin
            </h3>
            <p className="text-xs text-slate-400">
              Validation des demandes, réception, tickets LB-XXXX et caisse.
            </p>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500 space-y-1">
        <p>© {new Date().getFullYear()} LB Pressing — Brazzaville, Congo.</p>
        <p className="text-[11px] text-slate-600">
          Plateforme SaaS développée sur Digit Pressing.
        </p>
      </footer>
    </div>
  );
}
