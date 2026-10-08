export type TreatmentType = 'WASH' | 'IRON' | 'WASH_IRON' | 'DRY_CLEAN' | 'STAIN_REMOVAL';

export const TREATMENT_LABELS: Record<TreatmentType, string> = {
  WASH: 'Lavage',
  IRON: 'Repassage',
  WASH_IRON: 'Lavage + repassage',
  DRY_CLEAN: 'Nettoyage à sec',
  STAIN_REMOVAL: 'Détachage',
};

/**
 * Normalise un nom (minuscules, sans accents, espaces nettoyés)
 * pour éviter les doublons ("Serviette", "serviete", "serviette ")
 */
export function normalizeCatalogName(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .replace(/\s+/g, ' '); // Remplace les espaces multiples par un seul
}

/**
 * Génère le nom d'affichage du service : "{article} · {traitement}"
 * ou conserve le nom personnalisé si l'article/traitement n'est pas renseigné.
 */
export function formatServiceName(
  garmentTypeName?: string | null,
  treatment?: TreatmentType | string | null,
  fallbackName?: string
): string {
  if (garmentTypeName && treatment && TREATMENT_LABELS[treatment as TreatmentType]) {
    return `${garmentTypeName} · ${TREATMENT_LABELS[treatment as TreatmentType]}`;
  }
  if (garmentTypeName) {
    return garmentTypeName;
  }
  return fallbackName || 'Prestation sans nom';
}
