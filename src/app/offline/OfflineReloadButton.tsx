'use client';

import React from 'react';
import { RotateCw } from 'lucide-react';

export function OfflineReloadButton() {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }}
      className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2"
    >
      <RotateCw className="w-4 h-4" />
      <span>Réessayer</span>
    </button>
  );
}
