// =============================================================================
// LIBELLÉS DE TRADUCTION CENTRALISÉS EN FRANÇAIS (LB PRESSING)
// Évite tout affichage de clés techniques (DELIVERY, DROP_OFF, MTN_MOMO, etc.)
// =============================================================================

export const ORDER_MODE_LABELS: Record<string, string> = {
  DROP_OFF: 'Dépôt au pressing',
  PICKUP: 'Ramassage à domicile',
  DELIVERY: 'Livraison à domicile',
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente de confirmation',
  RECEIVED: 'Reçu / Pris en charge',
  IN_PROGRESS: 'En cours de nettoyage',
  READY: 'Prêt à être récupéré',
  DELIVERED: 'Livré / Remis au client',
  CANCELLED: 'Annulé',
  REJECTED: 'Refusé',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  MTN_MOMO: 'MTN Mobile Money',
  AIRTEL_MONEY: 'Airtel Money',
  BANK: 'Virement / Carte bancaire',
  OTHER: 'Autre mode de paiement',
};

export const USER_ROLE_LABELS: Record<string, string> = {
  OWNER: 'Propriétaire',
  MANAGER: 'Gérant',
  CASHIER: 'Caissier',
  DELIVERY: 'Livreur',
  employee: 'Employé',
  caissier: 'Caissier',
};

export function formatOrderMode(mode?: string | null): string {
  if (!mode) return 'Non spécifié';
  return ORDER_MODE_LABELS[mode] || mode;
}

export function formatOrderStatus(status?: string | null): string {
  if (!status) return 'Inconnu';
  return ORDER_STATUS_LABELS[status] || status;
}

export function formatPaymentMethod(method?: string | null): string {
  if (!method) return 'Non spécifié';
  return PAYMENT_METHOD_LABELS[method] || method;
}

export function formatUserRole(role?: string | null): string {
  if (!role) return 'Membre';
  return USER_ROLE_LABELS[role] || role;
}
