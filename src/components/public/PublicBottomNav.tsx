'use client';

// =============================================================================
// BARRE DE NAVIGATION CLIENT (MOBILE ONLY)
// Fixe en bas de l'écran, avec env(safe-area-inset-bottom)
// Absente dans l'admin et l'impression. Alignement rigoureux des libellés.
// =============================================================================

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Shirt, ShoppingBag, Search, MessageCircle } from 'lucide-react';
import { generateWhatsAppLink } from '@/lib/whatsapp';
import { BRAND_CONFIG } from '@/config/brand';

interface PublicBottomNavProps {
  slug: string;
  phone1?: string | null;
  orgName?: string;
}

export function PublicBottomNav({ slug, phone1, orgName }: PublicBottomNavProps) {
  const pathname = usePathname();

  // Ne jamais afficher dans l'admin, les factures ou les pages hors slug
  if (pathname.startsWith('/admin') || pathname.startsWith('/f/') || pathname.startsWith('/invoices')) {
    return null;
  }

  const phone = phone1 || BRAND_CONFIG.contact.phone1;
  const name = orgName || BRAND_CONFIG.name;
  const whatsappUrl = generateWhatsAppLink(
    phone,
    `Bonjour ${name} 👋 Je souhaite poser une question sur mes vêtements ou une commande.`
  );

  const homeHref = `/${slug}`;
  const tarifsHref = `/${slug}/tarifs`;
  const orderHref = `/${slug}/commander`;
  const trackingHref = `/${slug}/suivi`;

  const isHome = pathname === `/${slug}`;
  const isTarifs = pathname === `/${slug}/tarifs` || pathname === `/${slug}/services`;
  const isOrder = pathname === `/${slug}/commander`;
  const isTracking = pathname === `/${slug}/suivi`;

  return (
    <nav
      aria-label="Navigation principale client"
      className="fixed bottom-0 left-0 right-0 z-50 bg-[#041C4C] text-white border-t border-slate-800 shadow-2xl md:hidden print:hidden pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5 items-end justify-items-center h-16 max-w-md mx-auto px-1 pb-1">
        {/* 1. Accueil */}
        <Link
          href={homeHref}
          className={`flex flex-col items-center justify-end w-full h-full pb-1 text-[10px] font-medium transition ${
            isHome ? 'text-[#FFC72C] font-extrabold' : 'text-white/70 hover:text-white'
          }`}
        >
          <Home className="w-5 h-5 mb-1" />
          <span className="leading-none">Accueil</span>
        </Link>

        {/* 2. Tarifs */}
        <Link
          href={tarifsHref}
          className={`flex flex-col items-center justify-end w-full h-full pb-1 text-[10px] font-medium transition ${
            isTarifs ? 'text-[#FFC72C] font-extrabold' : 'text-white/70 hover:text-white'
          }`}
        >
          <Shirt className="w-5 h-5 mb-1" />
          <span className="leading-none">Tarifs</span>
        </Link>

        {/* 3. Commander (Bouton central en relief doré, libellé aligné) */}
        <Link
          href={orderHref}
          aria-label="Passer une commande"
          className={`relative flex flex-col items-center justify-end w-full h-full pb-1 text-[10px] font-medium transition ${
            isOrder ? 'text-[#FFC72C] font-extrabold' : 'text-white/70 hover:text-white'
          }`}
        >
          <div className="absolute -top-3 w-12 h-12 rounded-full bg-[#FFC72C] text-[#041C4C] flex items-center justify-center shadow-lg border-4 border-[#041C4C] transition active:scale-95">
            <ShoppingBag className="w-5 h-5 stroke-[2.5]" />
          </div>
          <span className="leading-none">Commander</span>
        </Link>

        {/* 4. Suivi */}
        <Link
          href={trackingHref}
          className={`flex flex-col items-center justify-end w-full h-full pb-1 text-[10px] font-medium transition ${
            isTracking ? 'text-[#FFC72C] font-extrabold' : 'text-white/70 hover:text-white'
          }`}
        >
          <Search className="w-5 h-5 mb-1" />
          <span className="leading-none">Suivi</span>
        </Link>

        {/* 5. WhatsApp */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-end w-full h-full pb-1 text-[10px] font-medium text-white/70 hover:text-white transition"
        >
          <MessageCircle className="w-5 h-5 mb-1 text-emerald-400" />
          <span className="leading-none">WhatsApp</span>
        </a>
      </div>
    </nav>
  );
}
