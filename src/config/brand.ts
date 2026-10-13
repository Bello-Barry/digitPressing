// Config centralisée de la marque LB Pressing
// Conforme à la spec Task 2.11 - Aucune valeur dispersée dans les composants.

export const BRAND_CONFIG = {
  name: 'LB Pressing',
  shortName: 'LB Pressing',
  description: 'Blanchisserie & Pressing Haute Qualité à Brazzaville. Soin de linge professionnel, livraison et suivi en ligne.',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://digit-pressing.vercel.app',
  colors: {
    nightBlue: '#041C4C',
    goldPrimary: '#FFC72C',
    goldSecondary: '#F5A300',
    royalBlue: '#0B5CE1',
    white: '#FFFFFF',
  },
  assets: {
    logos: {
      mark: '/brand/logo-mark.png',
      horizontalLight: '/brand/logo-horizontal-light.png',
      horizontalDark: '/brand/logo-horizontal-dark.png',
    },
    icons: {
      faviconIco: '/icons/favicon.ico',
      favicon32: '/icons/favicon-32.png',
      appleTouch: '/icons/apple-touch-icon.png',
      icon192: '/icons/icon-192.png',
      icon512: '/icons/icon-512.png',
      iconMaskable512: '/icons/icon-maskable-512.png',
    },
    ogImage: '/brand/og-image.png',
  },
} as const;
