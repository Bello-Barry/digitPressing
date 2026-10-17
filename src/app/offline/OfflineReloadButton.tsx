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
      className="w-full h-[48px] bg-[#FFC72C] hover:bg-[#FFC72C]/90 text-[#041C4C] font-black rounded-2xl text-sm transition shadow-sm flex items-center justify-center space-x-2 active:scale-95"
    >
      <RotateCw className="w-4 h-4" />
      <span>Réessayer</span>
    </button>
  );
}
