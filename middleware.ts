// =============================================================================
// MIDDLEWARE DE PROTECTION
// =============================================================================

// middleware.ts
import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Rediriger vers login si pas connecté
    if (!token && pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/auth/login', req.url));
    }

    // Vérifier les permissions pour certaines routes
    if (pathname.startsWith('/admin')) {
      if (token?.role !== 'owner') {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Permettre l'accès aux pages publiques
        const { pathname } = req.nextUrl;
        if (pathname.startsWith('/auth') || pathname === '/') {
          return true;
        }

        // Exiger une session pour les autres pages
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/api/protected/:path*',
  ],
};
