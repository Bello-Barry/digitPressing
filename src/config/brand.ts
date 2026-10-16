// Config centralisée de la marque LB Pressing
// Conforme à la spec Task 2.13 - Aucune valeur dispersée dans les composants.

export interface BrandPhoto {
  src: string;
  alt: string;
  title: string;
}

export const BRAND_CONFIG = {
  name: 'LB Pressing',
  shortName: 'LB Pressing',
  slogan: 'Vos vêtements, notre priorité.',
  heroSubtitle: 'Lavage, repassage, nettoyage à sec, ramassage et livraison à Brazzaville. Commandez en 1 minute, sans compte.',
  description: 'Blanchisserie & Pressing Haute Qualité à Brazzaville. Soin du linge professionnel, livraison et suivi en ligne.',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://digit-pressing.vercel.app',

  // Couleurs de la charte visuelle (thème clair pour vitrine publique)
  colors: {
    nightBlue: '#041C4C',
    goldPrimary: '#FFC72C',
    goldSecondary: '#F5A300',
    royalBlue: '#0B5CE1',
    lightBg: '#F7F9FC',
    cardBg: '#FFFFFF',
    textMain: '#041C4C',
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
  photos: {
    hero: {
      src: '/photos/hero.png',
      alt: 'Chemises et vêtements parfaitement repassés et rangés chez LB Pressing',
      title: 'Soin et Repassage Professionnel',
    },
    ceremonie: {
      src: '/photos/ceremonie.png',
      alt: 'Costumes, robes de cérémonie et tenues délicates nettoyés à sec',
      title: 'Tenues de Cérémonie & Soirée',
    },
    maison: {
      src: '/photos/maison.png',
      alt: 'Linge de maison, draps et couettes propres et désinfectés',
      title: 'Linge de Maison & Textile',
    },
  } as Record<string, BrandPhoto>,

  // Engagement / Pourquoi nous choisir (4 éléments)
  whyUs: [
    {
      id: 'soigne',
      title: 'Travail soigné',
      description: 'Chaque habit fait l\'objet d\'un traitement attentif selon sa matière et sa couleur.',
      iconKey: 'Sparkles',
    },
    {
      id: 'delais',
      title: 'Respect des délais',
      description: 'Retrait ou livraison garanti selon le délai annoncé lors de votre commande.',
      iconKey: 'Timer',
    },
    {
      id: 'qualite',
      title: 'Produits de qualité',
      description: 'Lessives écologiques et détachants professionnels préservant la fibre textile.',
      iconKey: 'Leaf',
    },
    {
      id: 'livraison',
      title: 'Ramassage & Livraison',
      description: 'Option de collecte et retour directement à votre domicile ou bureau à Brazzaville.',
      iconKey: 'Truck',
    },
  ],

  // Comment ça marche (4 étapes)
  howItWorks: [
    {
      step: 1,
      title: 'Commander en ligne ou sur WhatsApp',
      description: 'Choisissez vos prestations en 1 minute sans création de compte.',
      iconKey: 'Shirt',
    },
    {
      step: 2,
      title: 'Nous collectons ou vous déposez',
      description: 'Déposez au pressing ou optez pour notre service de coursier.',
      iconKey: 'MapPin',
    },
    {
      step: 3,
      title: 'Traitement soigné',
      description: 'Lavage, détachage, repassage et contrôle qualité rigoureux.',
      iconKey: 'Sparkles',
    },
    {
      step: 4,
      title: 'Récupération ou livraison',
      description: 'Soyez notifié par message dès que vos vêtements sont prêts.',
      iconKey: 'Truck',
    },
  ],
} as const;
