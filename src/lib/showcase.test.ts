import {
  calculateCategoryMinPrices,
  getCategoryIconKey,
  getAvailablePhotos,
  DEFAULT_CATEGORY_ICON,
} from '@/lib/showcase';

describe('Showcase Unit Tests', () => {
  describe('calculateCategoryMinPrices', () => {
    it('should calculate the minimum price for each active category', () => {
      const mockServices = [
        { category: 'Vêtements', price: 2000 },
        { category: 'Vêtements', price: 1500 },
        { category: 'Costumes', price: 5000 },
        { category: 'Costumes', price: 4500 },
        { category: 'Linge de maison', price: 3000 },
      ];

      const minPrices = calculateCategoryMinPrices(mockServices);

      expect(minPrices.length).toBe(3);
      const vetementCat = minPrices.find((c) => c.rawCategory === 'vetements');
      expect(vetementCat?.minPrice).toBe(1500);

      const costumeCat = minPrices.find((c) => c.rawCategory === 'costumes');
      expect(costumeCat?.minPrice).toBe(4500);
    });

    it('should ignore services with invalid or 0 prices', () => {
      const mockServices = [
        { category: 'Vêtements', price: 0 },
        { category: 'Vêtements', price: -500 },
        { category: 'Vêtements', price: 'invalid' as unknown as number },
      ];

      const minPrices = calculateCategoryMinPrices(mockServices);
      expect(minPrices).toEqual([]);
    });

    it('should return empty array if services list is empty', () => {
      expect(calculateCategoryMinPrices([])).toEqual([]);
    });
  });

  describe('getCategoryIconKey', () => {
    it('should return the correct icon key for known categories', () => {
      expect(getCategoryIconKey('vetement')).toBe('Shirt');
      expect(getCategoryIconKey('Costumes')).toBe('Suit');
      expect(getCategoryIconKey('Linge de maison')).toBe('BedDouble');
      expect(getCategoryIconKey('Repassage')).toBe('Iron');
      expect(getCategoryIconKey('Chaussures')).toBe('Footprints');
    });

    it('should fallback to default icon for unknown categories', () => {
      expect(getCategoryIconKey('Catégorie Inconnue Exotique')).toBe(DEFAULT_CATEGORY_ICON);
      expect(getCategoryIconKey(null)).toBe(DEFAULT_CATEGORY_ICON);
      expect(getCategoryIconKey(undefined)).toBe(DEFAULT_CATEGORY_ICON);
    });
  });

  describe('getAvailablePhotos', () => {
    it('should return photos that actually exist on disk without throwing errors', () => {
      const photos = getAvailablePhotos();
      expect(Array.isArray(photos)).toBe(true);
      // All returned photos must have src, alt, and title
      photos.forEach((photo) => {
        expect(photo).toHaveProperty('src');
        expect(photo).toHaveProperty('alt');
        expect(photo).toHaveProperty('title');
      });
    });
  });
});
