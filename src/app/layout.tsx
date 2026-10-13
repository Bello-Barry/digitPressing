import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { BRAND_CONFIG } from '@/config/brand';
import { cn } from '@/lib/utils';
import { Providers } from './providers';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(BRAND_CONFIG.siteUrl),
  title: {
    default: `${BRAND_CONFIG.name} | Pressing & Blanchisserie à Brazzaville`,
    template: `%s | ${BRAND_CONFIG.name}`,
  },
  description: BRAND_CONFIG.description,
  authors: [{ name: 'Digit Pressing Team' }],
  creator: BRAND_CONFIG.name,
  publisher: BRAND_CONFIG.name,
  icons: {
    icon: [
      { url: BRAND_CONFIG.assets.icons.faviconIco },
      { url: BRAND_CONFIG.assets.icons.favicon32, sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: BRAND_CONFIG.assets.icons.appleTouch }],
  },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: BRAND_CONFIG.siteUrl,
    title: `${BRAND_CONFIG.name} | Pressing & Blanchisserie à Brazzaville`,
    description: BRAND_CONFIG.description,
    siteName: BRAND_CONFIG.name,
    images: [
      {
        url: `${BRAND_CONFIG.siteUrl}${BRAND_CONFIG.assets.ogImage}`,
        width: 1200,
        height: 630,
        alt: BRAND_CONFIG.name,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND_CONFIG.name} | Pressing & Blanchisserie à Brazzaville`,
    description: BRAND_CONFIG.description,
    images: [`${BRAND_CONFIG.siteUrl}${BRAND_CONFIG.assets.ogImage}`],
  },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: BRAND_CONFIG.colors.nightBlue,
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
