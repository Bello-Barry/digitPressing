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
  title: {
    default: 'Digit Pressing - Gestion Digitale',
    template: '%s | Digit Pressing',
  },
  description: 'Application PWA professionnelle pour la gestion digitale des pressings. Remplace le système papier traditionnel par une solution numérique complète.',
  keywords: [
    'pressing',
    'nettoyage à sec',
    'gestion',
    'factures',
    'digital',
    'PWA',
    'application web',
    'teinturerie',
  ],
  authors: [{ name: 'Digit Pressing Team' }],
  creator: ' Barry bello',
  publisher: 'Barry bello',
  
  // PWA Configuration
  applicationName: 'Digit-Pressing',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ZUA Pressing',
    startupImage: [
      {
        url: '/icons/apple-splash-2048-2732.png',
        media: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)',
      },
      {
        url: '/icons/apple-splash-1668-2388.png',
        media: '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)',
      },
      {
        url: '/icons/apple-splash-1536-2048.png',
        media: '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)',
      },
      {
        url: '/icons/apple-splash-1284-2778.png',
        media: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)',
      },
      {
        url: '/icons/apple-splash-1170-2532.png',
        media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)',
      },
      {
        url: '/icons/apple-splash-1125-2436.png',
        media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)',
      },
      {
        url: '/icons/apple-splash-828-1792.png',
        media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)',
      },
      {
        url: '/icons/apple-splash-750-1334.png',
        media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)',
      },
    ],
  },
  
  // Open Graph
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: 'https://zua-pressing.vercel.app',
    title: 'Digit Pressing - Gestion Digitale',
    description: 'Application PWA professionnelle pour la gestion digitale des pressings.',
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
  
  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'Digit Pressing - Gestion Digitale',
    description: 'Application PWA professionnelle pour la gestion digitale des pressings.',
    images: ['/og-image.png'],
  },
  
  // Icons
  icons: {
    icon: [
      { url: '/icons/icon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      {
        rel: 'mask-icon',
        url: '/icons/safari-pinned-tab.svg',
        color: '#2563eb',
      },
    ],
  },
  
  // Manifest
  manifest: '/manifest.json',
  
  // Other meta tags
  category: 'Business',
  classification: 'Business Application',
  robots: {
    index: false, // Private application
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
  
  // No cache for dynamic content
  other: {
    'msapplication-TileColor': '#2563eb',
    'msapplication-config': '/browserconfig.xml',
    'theme-color': '#2563eb',
  },
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
  colorScheme: 'light dark',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Preload critical resources */}
        <link
          rel="preload"
          href="/fonts/inter-var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        
        {/* DNS prefetch for external resources */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />
        
        {/* Preconnect to critical external domains */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* PWA meta tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ZUA Pressing" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="msapplication-starturl" content="/" />
        
        {/* Splash screens for iOS */}
        <link
          rel="apple-touch-startup-image"
          media="screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
          href="/icons/apple-splash-1290-2796.png"
        />
        
        {/* Prevent zoom on input focus (iOS) */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
      </head>
      
      <body 
        className={cn(
          'min-h-screen bg-background font-sans antialiased safe-top safe-bottom',
          inter.variable
        )}
      >
        <Providers>
          {/* Conteneur principal avec gestion PWA */}
          <div className="relative flex min-h-screen flex-col">
            {/* Barre de statut PWA (iOS) */}
            <div className="safe-top" />
            
            {/* Contenu principal */}
            <main className="flex-1">
              {children}
            </main>
            
            {/* Zone de sécurité bottom (iOS) */}
            <div className="safe-bottom" />
          </div>
          
          {/* Toast notifications */}
          <Toaster
            position="top-center"
            expand={true}
            richColors={true}
            closeButton={true}
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
        
        {/* Scripts pour PWA */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Détection PWA standalone
              if (window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches) {
                document.documentElement.classList.add('pwa-standalone');
              }
              
              // Empêcher le zoom sur double-tap (iOS)
              let lastTouchEnd = 0;
              document.addEventListener('touchend', function (event) {
                const now = (new Date()).getTime();
                if (now - lastTouchEnd <= 300) {
                  event.preventDefault();
                }
                lastTouchEnd = now;
              }, false);
              
              // Gestion des erreurs globales
              window.addEventListener('error', function(e) {
                console.error('Global error:', e.error);
              });
              
              window.addEventListener('unhandledrejection', function(e) {
                console.error('Unhandled promise rejection:', e.reason);
              });
            `,
          }}
        />
      </body>
    </html>
  );
}