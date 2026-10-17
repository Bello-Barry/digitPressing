import fs from 'fs';
import path from 'path';
import { normalizeCatalogName } from '@/lib/catalog';
import { BRAND_CONFIG, BrandPhoto } from '@/config/brand';

export interface CategorySummary {
  rawCategory: string;
  displayCategory: string;
  minPrice: number;
  shortPriceBadge: string;
  count: number;
}

export const DEFAULT_CATEGORY_ICON = 'Sparkles';

/**
 * Mappe le nom d'une catégorie vers une clé d'icône symbolique
 */
export function getCategoryIconKey(categoryName?: string | null): string {
  if (!categoryName) return DEFAULT_CATEGORY_ICON;
  const norm = normalizeCatalogName(categoryName);

  if (norm.includes('vetement') || norm.includes('chemise')) return 'Shirt';
  if (norm.includes('costume') || norm.includes('ceremonie')) return 'Suit';
  if (norm.includes('maison') || norm.includes('linge')) return 'BedDouble';
  if (norm.includes('repassage')) return 'Iron';
  if (norm.includes('chaussure')) return 'Footprints';
  if (norm.includes('cuir')) return 'Sparkles';
  if (norm.includes('livraison')) return 'Truck';

  return DEFAULT_CATEGORY_ICON;
}

// Libellés élégants et complets pour les catégories normalisées
const CATEGORY_DISPLAY_LABELS: Record<string, string> = {
  vetement: 'Vêtements du quotidien',
  vetements: 'Vêtements du quotidien',
  chemise: 'Chemises & Hauts',
  chemises: 'Chemises & Hauts',
  costume: 'Costumes & Cérémonie',
  costumes: 'Costumes & Cérémonie',
  ceremonie: 'Costumes & Cérémonie',
  traditionnel: 'Tenues Traditionnelles',
  maison: 'Linge de Maison',
  'linge de maison': 'Linge de Maison',
  linge: 'Linge de Maison',
  cuir: 'Cuir & Daim',
  chaussure: 'Chaussures & Baskets',
  chaussures: 'Chaussures & Baskets',
  repassage: 'Repassage seul',
  retouche: 'Retouches & Couture',
  retouches: 'Retouches & Couture',
  accessoire: 'Accessoires & Sacs',
  accessoires: 'Accessoires & Sacs',
};

/**
 * Formate un prix en badge court "Dès X F" sur une seule ligne
 */
export function formatShortPriceBadge(price: number): string {
  if (isNaN(price) || price <= 0) return '';
  const formatted = price.toLocaleString('fr-FR');
  return `Dès ${formatted} F`;
}

/**
 * Calcule le prix minimum réel et regroupe par catégorie pour les services actifs
 */
export function calculateCategoryMinPrices(
  services: Array<{ category?: string | null; price: number | string }>
): CategorySummary[] {
  if (!services || services.length === 0) return [];

  const grouped: Record<string, { displayCategory: string; rawCategory: string; prices: number[] }> = {};

  for (const service of services) {
    const rawCategory = service.category?.trim() || 'Vêtements';
    const normalizedKey = normalizeCatalogName(rawCategory);
    const numPrice = Number(service.price);

    if (isNaN(numPrice) || numPrice <= 0) continue;

    const displayCategory = CATEGORY_DISPLAY_LABELS[normalizedKey] || rawCategory;
    const groupKey = normalizeCatalogName(displayCategory);

    if (!grouped[groupKey]) {
      grouped[groupKey] = { displayCategory, rawCategory, prices: [] };
    }

    grouped[groupKey].prices.push(numPrice);
  }

  return Object.values(grouped)
    .map((data) => {
      const minPrice = Math.min(...data.prices);
      return {
        rawCategory: data.rawCategory,
        displayCategory: data.displayCategory,
        minPrice,
        shortPriceBadge: formatShortPriceBadge(minPrice),
        count: data.prices.length,
      };
    })
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
