import { normalizeCatalogName, formatServiceName, TREATMENT_LABELS } from '@/lib/catalog';

describe('Catalog Utils', () => {
  it('normalizes names properly', () => {
    expect(normalizeCatalogName('  Serviette  ')).toBe('serviette');
    expect(normalizeCatalogName('serviete')).toBe('serviete');
    expect(normalizeCatalogName(' SERVÎETTE ')).toBe('serviette');
    expect(normalizeCatalogName('Chemise   sur   cintre')).toBe('chemise sur cintre');
  });

  it('formats service names properly', () => {
    expect(formatServiceName('Chemise', 'WASH')).toBe('Chemise · Lavage');
    expect(formatServiceName('Pantalon', 'IRON')).toBe('Pantalon · Repassage');
    expect(formatServiceName('Costume', 'WASH_IRON')).toBe('Costume · Lavage + repassage');
  });

  it('handles fallbacks properly', () => {
    expect(formatServiceName('Chemise', null, 'Chemise Bazin')).toBe('Chemise');
    expect(formatServiceName(null, null, 'Nom Libellé')).toBe('Nom Libellé');
  });

  it('has correct treatment labels', () => {
    expect(TREATMENT_LABELS.WASH).toBe('Lavage');
    expect(TREATMENT_LABELS.IRON).toBe('Repassage');
  });
});
