import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { BRAND_CONFIG } from '@/config/brand';

export const revalidate = 86400; // 1 jour

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  let orgName = BRAND_CONFIG.name;

  try {
    const db = await createServerSupabaseClient();
    const { data: org } = await db
      .from('organizations')
      .select('name')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (org?.name) {
      orgName = org.name;
    }
  } catch (error) {
    console.error('Erreur récupération nom organisation pour manifeste:', error);
  }

  const manifest = {
    id: `/${slug}/`,
    name: orgName,
    short_name: orgName,
    description: `Commander vos services de pressing en ligne chez ${orgName}.`,
    start_url: `/${slug}?source=pwa`,
    scope: `/${slug}/`,
    display: 'standalone',
    orientation: 'portrait',
    lang: 'fr',
    categories: ['business', 'shopping'],
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
  };

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=86400',
    },
  });
}
