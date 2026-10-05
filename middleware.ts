// =============================================================================
// MIDDLEWARE DE PROTECTION SUPABASE - SAAS PRESSING
// Protection des routes et contrôle d'accès RBAC (Server-Side)
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type SetAllCookies } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  let response = NextResponse.next({ request: req });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: ((cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        response = NextResponse.next({ request: req });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }) as SetAllCookies,
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  // 1. Redirection si non authentifié
  if (!user && pathname !== '/admin/login') {
    const redirectUrl = new URL(pathname.startsWith('/admin') || pathname.startsWith('/users') ? '/admin/login' : '/auth/login', req.url);
    redirectUrl.searchParams.set('redirect', pathname);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  // 2. Redirection si déjà authentifié sur /admin/login
  if (user && pathname === '/admin/login') {
    const redirectResponse = NextResponse.redirect(new URL('/admin', req.url));
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  // 3. Contrôle RBAC sur les routes réservées (ex: /users uniquement accessible par OWNER)
  if (user && (pathname.startsWith('/users'))) {
    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!membership || membership.role !== 'OWNER') {
      const redirectResponse = NextResponse.redirect(new URL('/admin', req.url));
      response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
      return redirectResponse;
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/users',
    '/users/:path*',
    '/api/protected/:path*',
  ],
};
