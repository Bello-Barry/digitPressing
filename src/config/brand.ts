// Config centralisée de la marque LB Pressing
// Conforme aux specs Task 2.13c - Palette officielle Bleu Nuit & Jaune

export interface BrandPhoto {
  src: string;
  alt: string;
  title: string;
  objectPosition?: string;
}

export const BRAND_CONFIG = {
  name: 'LB Pressing',
  shortName: 'LB Pressing',
  slogan: 'Vos vêtements, notre priorité.',
  heroSubtitle: 'Lavage, repassage, nettoyage à sec, ramassage et livraison à Brazzaville.',
  description: 'Blanchisserie & Pressing Haute Qualité à Brazzaville. Soin du linge professionnel, livraison et suivi en ligne.',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://digit-pressing.vercel.app',

  // Charte visuelle officielle : Bleu Nuit, Jaune, Bleu Royal, Fond Bleu Très Clair (#EEF4FF)
  colors: {
    nightBlue: '#041C4C',
    goldPrimary: '#FFC72C',
    goldSecondary: '#F5A300', // Uniquement sur accent logo
    royalBlue: '#0B5CE1',
    lightBg: '#EEF4FF',
    cardBg: '#FFFFFF',
    cardBorder: '#D9E4FA',
    textMain: '#041C4C',
    textMuted: '#4A5F86',
  },

  contact: {
    address: 'Brazzaville, République du Congo',
    mapsUrl: 'https://maps.google.com/?q=Brazzaville+Congo',
    phone1: '067311016',
    phone2: '055550000',
    schedule: 'Lundi - Samedi : 07h30 - 18h30 (Dimanche fermé)',
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

  // Photos de vitrine déclarées dans public/photos/
  // Ordre strict : 1. Fer & Chemises (hero.png), 2. Costume & Robe (ceremonie.png), 3. Linge de maison (maison.png)
  photos: {
    hero: {
      src: '/photos/hero.png',
      alt: 'Chemises et vêtements parfaitement repassés et rangés chez LB Pressing',
      title: 'Soin et Repassage Professionnel',
      objectPosition: '80% 85%',
    },
    ceremonie: {
      src: '/photos/ceremonie.png',
      alt: 'Costumes, robes de cérémonie et tenues délicates nettoyés à sec',
      title: 'Tenues de Cérémonie & Soirée',
      objectPosition: 'center 25%',
    },
    maison: {
      src: '/photos/maison.png',
      alt: 'Linge de maison, draps et couettes propres et désinfectés',
      title: 'Linge de Maison & Textile',
      objectPosition: 'center 40%',
    },
  } as Record<string, BrandPhoto>,

  // Pastilles de confiance (4 engagements)
  whyUs: [
    {
      id: 'soigne',
      title: 'Travail soigné',
      description: 'Chaque habit fait l\'objet d\'un traitement attentif.',
      iconKey: 'Sparkles',
    },
    {
      id: 'delais',
      title: 'Respect des délais',
      description: 'Retrait ou livraison garanti dans les temps.',
      iconKey: 'Timer',
    },
    {
      id: 'qualite',
      title: 'Produits de qualité',
      description: 'Lessives écologiques et détachants professionnels.',
      iconKey: 'Leaf',
    },
    {
      id: 'livraison',
      title: 'Ramassage & Livraison',
      description: 'Collecte et retour à domicile à Brazzaville.',
      iconKey: 'Truck',
    },
  ],

  // Comment ça marche (4 étapes ultra compactes pour mobile)
  howItWorks: [
    {
      step: 1,
      title: 'Commandez',
      description: 'En ligne ou WhatsApp',
      iconKey: 'WhatsApp',
    },
    {
      step: 2,
      title: 'Collecte',
      description: 'Dépôt ou coursier',
      iconKey: 'Motorbike',
    },
    {
      step: 3,
      title: 'Traitement',
      description: 'Lavage & repassage',
      iconKey: 'Hanger',
    },
    {
      step: 4,
      title: 'Livraison',
      description: 'Récupération rapide',
      iconKey: 'Package',
    },
  ],
} as const;
