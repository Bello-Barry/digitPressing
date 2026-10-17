import React from 'react';
import Image from 'next/image';
import { BRAND_CONFIG } from '@/config/brand';
import { WifiOff } from 'lucide-react';
import { OfflineReloadButton } from './OfflineReloadButton';

export const metadata = {
  title: `Hors ligne | ${BRAND_CONFIG.name}`,
  description: 'Vous êtes actuellement hors ligne. Reconnectez-vous à Internet pour continuer.',
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#EEF4FF] text-[#041C4C] flex flex-col justify-center items-center px-4 font-sans text-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Image
            src={BRAND_CONFIG.assets.logos.horizontalDark}
            alt={BRAND_CONFIG.name}
            width={180}
            height={48}
            priority
            className="h-12 w-auto object-contain mx-auto"
          />
        </div>

        <div className="p-6 rounded-[24px] bg-[#041C4C] text-white border border-[#041C4C] space-y-4 shadow-brand-card">
          <div className="w-12 h-12 rounded-2xl bg-[#FFC72C]/20 text-[#FFC72C] flex items-center justify-center mx-auto">
            <WifiOff className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-extrabold text-white tracking-tight">
              Vous êtes hors ligne
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Une connexion Internet est requise pour accéder aux services de {BRAND_CONFIG.name}.
            </p>
          </div>

          <div className="pt-2">
            <OfflineReloadButton />
          </div>
        </div>

        <p className="text-[11px] text-[#4A5F86]">
          © {new Date().getFullYear()} {BRAND_CONFIG.name} — Brazzaville, Congo.
        </p>
      </div>
    </div>
  );
}
