import fs from 'fs';
import path from 'path';
import { BRAND_CONFIG } from '@/config/brand';

describe('PWA Manifests & Assets Validation', () => {
  const publicDir = path.join(process.cwd(), 'public');

  test('Tous les fichiers de marque et icônes existent dans le dossier public', () => {
    const requiredAssets = [
      BRAND_CONFIG.assets.logos.mark,
      BRAND_CONFIG.assets.logos.horizontalLight,
      BRAND_CONFIG.assets.logos.horizontalDark,
      BRAND_CONFIG.assets.ogImage,
      BRAND_CONFIG.assets.icons.faviconIco,
      BRAND_CONFIG.assets.icons.favicon32,
      BRAND_CONFIG.assets.icons.appleTouch,
      BRAND_CONFIG.assets.icons.icon192,
      BRAND_CONFIG.assets.icons.icon512,
      BRAND_CONFIG.assets.icons.iconMaskable512,
    ];

    requiredAssets.forEach((assetPath) => {
      const fullPath = path.join(publicDir, assetPath.replace(/^\//, ''));
      expect(fs.existsSync(fullPath)).toBe(true);
    });
  });

  test('Configurations du manifeste personnel (id, scope, icons)', () => {
    expect(BRAND_CONFIG.name).toBe('LB Pressing');
    expect(BRAND_CONFIG.shortName).toBe('LB Pressing');
    expect(BRAND_CONFIG.assets.icons.icon192).toBe('/icons/icon-192.png');
    expect(BRAND_CONFIG.assets.icons.icon512).toBe('/icons/icon-512.png');
    expect(BRAND_CONFIG.assets.icons.iconMaskable512).toBe('/icons/icon-maskable-512.png');
  });
});
