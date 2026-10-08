import { normalizeCatalogName, formatServiceName, TREATMENT_LABELS } from '@/lib/catalog';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

console.log('Running catalog unit tests...');

// 1. Normalization
assert(normalizeCatalogName('  Serviette  ') === 'serviette', 'Normalizes serviette spaces');
assert(normalizeCatalogName('serviete') === 'serviete', 'Leaves serviete');
assert(normalizeCatalogName(' SERVÎETTE ') === 'serviette', 'Removes accents and lowercases');
assert(normalizeCatalogName('Chemise   sur   cintre') === 'chemise sur cintre', 'Cleans multi-spaces');

// 2. Format service name
assert(formatServiceName('Chemise', 'WASH') === 'Chemise · Lavage', 'Formats Chemise WASH');
assert(formatServiceName('Pantalon', 'IRON') === 'Pantalon · Repassage', 'Formats Pantalon IRON');
assert(formatServiceName('Costume', 'WASH_IRON') === 'Costume · Lavage + repassage', 'Formats Costume WASH_IRON');

// 3. Fallbacks
assert(formatServiceName('Chemise', null, 'Chemise Bazin') === 'Chemise', 'Fallback to article name');
assert(formatServiceName(null, null, 'Nom Libellé') === 'Nom Libellé', 'Fallback name');

// 4. Treatment labels
assert(TREATMENT_LABELS.WASH === 'Lavage', 'Treatment WASH');
assert(TREATMENT_LABELS.IRON === 'Repassage', 'Treatment IRON');

console.log('All catalog unit tests PASSED successfully!');
