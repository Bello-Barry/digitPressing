import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Providers } from './providers';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://zua-pressing.vercel.app'), // ✅ ajouté
  title: {
    default: 'Digit Pressing - Gestion Digitale',
    template: '%s | Digit Pressing',
  },
  description:
    "Application PWA professionnelle pour la gestion digitale des pressings. Remplace le système papier traditionnel par une solution numérique complète.",
  authors: [{ name: 'Digit Pressing Team' }],
  creator: 'Barry Bello',
  publisher: 'Barry Bello',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: 'https://zua-pressing.vercel.app',
    title: 'Digit Pressing - Gestion Digitale',
    description:
      "Application PWA professionnelle pour la gestion digitale des pressings.",
    siteName: 'ZUA Pressing',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Digit Pressing - Gestion Digitale',
      },
    ],
  },
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased safe-top safe-bottom',
          inter.variable
        )}
      >
        <Providers>
          <main className="flex-1">{children}</main>
          <Toaster
            position="top-center"
            expand
            richColors
            closeButton
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--background)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
