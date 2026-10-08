import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface AccessDeniedProps {
  title?: string;
  message?: string;
  backUrl?: string;
  backLabel?: string;
}

export function AccessDenied({
  title = 'Accès refusé',
  message = 'Vous n\'avez pas les permissions nécessaires pour accéder à cette section ou effectuer cette action.',
  backUrl = '/admin',
  backLabel = 'Retour au tableau de bord',
}: AccessDeniedProps) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4 shadow-lg shadow-red-500/5">
        <ShieldAlert className="w-8 h-8" />
      </div>

      <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">
        {title}
      </h1>

      <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
        {message}
      </p>

      <Link
        href={backUrl}
        className="inline-flex items-center px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition active:scale-95 shadow-md"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        {backLabel}
      </Link>
    </div>
  );
}
