// =============================================================================
// MIDDLEWARE DE PROTECTION SUPABASE - SAAS PRESSING
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const { pathname } = req.nextUrl;

  // Permettre l'accès aux pages publiques, assets et routes auth
  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/public') ||
    pathname === '/' ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.json') ||
    pathname.endsWith('.svg')
  ) {
    return res;
  }

  // Extraire les cookies d'authentification Supabase
  const sbAccessToken = req.cookies.get('sb-access-token')?.value ||
                        req.cookies.get('supabase-auth-token')?.value;

  // Protection des routes /dashboard et /admin
  if (!sbAccessToken && (pathname.startsWith('/dashboard') || pathname.startsWith('/admin'))) {
    const redirectUrl = new URL('/auth/login', req.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/api/protected/:path*',
  ],
};
