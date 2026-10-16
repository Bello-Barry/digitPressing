'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { BRAND_CONFIG } from '@/config/brand';
import { Home, ShoppingBag, ArrowLeft } from 'lucide-react';

export default function NotFoundPage(): JSX.Element {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 p-6 text-white">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 text-center space-y-6">
        <div className="flex justify-center">
          <Image
            src={BRAND_CONFIG.assets.logos.horizontalDark}
            alt={BRAND_CONFIG.name}
            width={220}
            height={60}
            priority
            className="h-12 w-auto object-contain"
          />
        </div>

        <div className="space-y-2">
          <span className="text-amber-400 font-extrabold text-sm tracking-widest uppercase">Erreur 404</span>
          <h1 className="text-2xl font-black text-white">Cette page n'existe pas</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            La page que vous recherchez est introuvable ou a été déplacée.
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <Link
            href="/"
            className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-lg shadow-amber-500/10 flex items-center justify-center space-x-2"
          >
            <Home className="w-4 h-4" />
            <span>Retour à l'accueil</span>
          </Link>

          <Link
            href="/lb-pressing/commander"
            className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition flex items-center justify-center space-x-2"
          >
            <ShoppingBag className="w-4 h-4 text-amber-400" />
            <span>Commander en ligne</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
