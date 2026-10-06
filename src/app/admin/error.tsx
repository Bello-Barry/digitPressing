'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function AdminErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Journalisation de l'erreur côté serveur / console client
    console.error('An unhandled error occurred in the /admin section:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full p-6 sm:p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-5 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto shadow-inner">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
            Une erreur s'est produite
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            L'application a rencontré un problème imprévu lors du chargement de cette page.
          </p>
        </div>

        {/* Détails de l'erreur et Digest */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-left space-y-1">
          <p className="text-[11px] font-mono text-slate-300 break-words">
            {error.message || 'Erreur inconnue'}
          </p>
          {error.digest && (
            <p className="text-[10px] font-mono text-slate-500">
              Ref digest: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-md shadow-amber-500/20"
          >
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Réessayer
          </button>

          <Link
            href="/admin"
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition"
          >
            <Home className="w-4 h-4 mr-1.5" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
