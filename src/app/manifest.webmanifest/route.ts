import { NextResponse } from 'next/server';
import { BRAND_CONFIG } from '@/config/brand';

export const dynamic = 'force-static';
export const revalidate = 86400; // 1 jour

export async function GET() {
  const manifest = {
    id: '/admin',
    name: BRAND_CONFIG.name,
    short_name: BRAND_CONFIG.shortName,
    description: BRAND_CONFIG.description,
    start_url: '/admin',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'fr',
    categories: ['business', 'productivity'],
    theme_color: BRAND_CONFIG.colors.nightBlue,
    background_color: BRAND_CONFIG.colors.nightBlue,
    icons: [
      {
        src: BRAND_CONFIG.assets.icons.icon192,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: BRAND_CONFIG.assets.icons.icon512,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: BRAND_CONFIG.assets.icons.iconMaskable512,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Commandes',
        short_name: 'Commandes',
        description: 'Gestion des commandes et tickets',
        url: '/admin/commandes',
      },
      {
        name: 'Relances',
        short_name: 'Relances',
        description: 'Relances des retraits de vêtements',
        url: '/admin/relances',
      },
      {
        name: 'Tableau de bord',
        short_name: 'Dashboard',
        description: 'Vue globale et métriques du pressing',
        url: '/admin',
      },
    ],
  };

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=86400',
    },
  });
}
