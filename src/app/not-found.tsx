"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "react-lucide";

export default function NoFundePage(): JSX.Element {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-3xl w-full bg-white rounded-2xl shadow-lg p-8 md:p-12 text-center">
        <div className="flex items-center justify-center mb-6">
          <div className="rounded-full bg-amber-100 p-4 inline-flex">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          </div>
        </div>

        <h1 className="text-3xl md:text-4xl font-semibold mb-3 text-slate-900">Page introuvable — NoFunde</h1>
        <p className="text-sm md:text-base text-slate-600 mb-6">
          La page que vous cherchez n'existe pas (ou a été déplacée). Si vous pensez que c'est une erreur,
          contactez l'équipe ou utilisez les boutons ci-dessous pour revenir à l'accueil.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="w-full sm:w-auto">
            <Button variant="default" className="w-full sm:w-auto">
              Retour à l'accueil
            </Button>
          </Link>

          <a
            href="mailto:support@ton-domaine.com?subject=Erreur%20NoFunde%20-%20Page%20introuvable&body=Salut%20%5BRenseignez%20ici%20le%20contexte%5D"
            className="w-full sm:w-auto"
          >
            <Button variant="secondary" className="w-full sm:w-auto">
              Signaler un problème
            </Button>
          </a>
        </div>

        <div className="mt-8 text-xs text-slate-400">
          <p>Si tu es en train de développer — vérifie la route `src/app/nofunde` et le fichier `page.tsx`.</p>
        </div>
      </div>
    </main>
  );
}
