import fs from 'fs';
import path from 'path';
import { normalizeCatalogName } from '@/lib/catalog';
import { BRAND_CONFIG, BrandPhoto } from '@/config/brand';

export interface CategorySummary {
  rawCategory: string;
  displayCategory: string;
  minPrice: number;
  count: number;
  iconKey: string;
}

// Libellés élégants pour les catégories normalisées
const CATEGORY_DISPLAY_LABELS: Record<string, string> = {
  vetement: 'Vêtements du quotidien',
  vetements: 'Vêtements du quotidien',
  chemise: 'Chemises & Hauts',
  chemises: 'Chemises & Hauts',
  costume: 'Costumes & Cérémonie',
  costumes: 'Costumes & Cérémonie',
  ceremonie: 'Costumes & Cérémonie',
  traditionnel: 'Tenues Traditionnelles (Bazin / Pagne)',
  maison: 'Linge de Maison',
  'linge de maison': 'Linge de Maison',
  linge: 'Linge de Maison',
  cuir: 'Cuir & Daim',
  chaussure: 'Chaussures & Baskets',
  chaussures: 'Chaussures & Baskets',
  repassage: 'Repassage seul',
  retouche: 'Retouches & Coutures',
  retouches: 'Retouches & Coutures',
  accessoire: 'Accessoires & Sacs',
  accessoires: 'Accessoires & Sacs',
};

// Map des catégories vers la clé d'icône correspondante
const CATEGORY_ICON_MAP: Record<string, string> = {
  vetement: 'Shirt',
  vetements: 'Shirt',
  chemise: 'Shirt',
  chemises: 'Shirt',
  costume: 'Suit',
  costumes: 'Suit',
  ceremonie: 'Suit',
  traditionnel: 'Sparkles',
  maison: 'BedDouble',
  'linge de maison': 'BedDouble',
  linge: 'BedDouble',
  cuir: 'ShieldCheck',
  chaussure: 'Footprints',
  chaussures: 'Footprints',
  repassage: 'Iron',
  retouche: 'Sparkles',
  retouches: 'Sparkles',
  accessoire: 'Sparkles',
  accessoires: 'Sparkles',
};

export const DEFAULT_CATEGORY_ICON = 'WashingMachine';

/**
 * Retourne la clé d'icône associée à une catégorie (avec repli par défaut)
 */
export function getCategoryIconKey(categoryName?: string | null): string {
  if (!categoryName) return DEFAULT_CATEGORY_ICON;
  const normalized = normalizeCatalogName(categoryName);

  if (CATEGORY_ICON_MAP[normalized]) return CATEGORY_ICON_MAP[normalized];

  // Recherche par mot-clé si pas de correspondance exacte
  if (normalized.includes('costume') || normalized.includes('ceremonie')) return 'Suit';
  if (normalized.includes('repass')) return 'Iron';
  if (normalized.includes('maison') || normalized.includes('linge') || normalized.includes('drap')) return 'BedDouble';
  if (normalized.includes('chaussur') || normalized.includes('basket')) return 'Footprints';
  if (normalized.includes('cuir')) return 'ShieldCheck';
  if (normalized.includes('vetement') || normalized.includes('chemis')) return 'Shirt';
  if (normalized.includes('tradition') || normalized.includes('bazin') || normalized.includes('pagne')) return 'Sparkles';

  return DEFAULT_CATEGORY_ICON;
}

/**
 * Calcule le prix minimum réel et regroupe par catégorie pour les services actifs
 */
export function calculateCategoryMinPrices(
  services: Array<{ category?: string | null; price: number | string }>
): CategorySummary[] {
  if (!services || services.length === 0) return [];

  const grouped: Record<string, { displayCategory: string; prices: number[]; iconKey: string }> = {};

  for (const service of services) {
    const rawCategory = service.category?.trim() || 'Vêtements';
    const normalizedKey = normalizeCatalogName(rawCategory);
    const numPrice = Number(service.price);

    if (isNaN(numPrice) || numPrice <= 0) continue;

    if (!grouped[normalizedKey]) {
      const displayCategory = CATEGORY_DISPLAY_LABELS[normalizedKey] || rawCategory;
      const iconKey = getCategoryIconKey(rawCategory);
      grouped[normalizedKey] = { displayCategory, prices: [], iconKey };
    }

    grouped[normalizedKey].prices.push(numPrice);
  }

  return Object.entries(grouped)
    .map(([rawCategory, data]) => ({
      rawCategory,
      displayCategory: data.displayCategory,
      minPrice: Math.min(...data.prices),
      count: data.prices.length,
      iconKey: data.iconKey,
    }))
    .filter((cat) => cat.count > 0 && isFinite(cat.minPrice))
    .sort((a, b) => a.minPrice - b.minPrice);
}

/**
 * Vérifie l'existence des photos configurées sur le disque (Server-Side)
 * pour éviter les erreurs 404 ou le rendu d'images cassées.
 */
export function getAvailablePhotos(): BrandPhoto[] {
  const configuredPhotos = Object.values(BRAND_CONFIG.photos);
  const photosDir = path.join(process.cwd(), 'public');

  return configuredPhotos.filter((photo) => {
    try {
      const fullPath = path.join(photosDir, photo.src);
      return fs.existsSync(fullPath);
    } catch {
      return false;
    }
  });
}
