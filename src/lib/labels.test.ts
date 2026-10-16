import {
  formatOrderMode,
  formatOrderStatus,
  formatPaymentMethod,
  formatUserRole,
} from './labels';
import { isValidCongoMobile, normalizePhoneNumber } from './whatsapp';

describe('Dictionnaire de libellés français', () => {
  it('traduit correctement les modes de commande', () => {
    expect(formatOrderMode('DROP_OFF')).toBe('Dépôt au pressing');
    expect(formatOrderMode('PICKUP')).toBe('Ramassage à domicile');
    expect(formatOrderMode('DELIVERY')).toBe('Livraison à domicile');
    expect(formatOrderMode(undefined)).toBe('Non spécifié');
  });

  it('traduit correctement les statuts de commande', () => {
    expect(formatOrderStatus('PENDING')).toBe('En attente de confirmation');
    expect(formatOrderStatus('RECEIVED')).toBe('Reçu / Pris en charge');
    expect(formatOrderStatus('READY')).toBe('Prêt à être récupéré');
    expect(formatOrderStatus('DELIVERED')).toBe('Livré / Remis au client');
    expect(formatOrderStatus('CANCELLED')).toBe('Annulé');
  });

  it('traduit correctement les modes de paiement', () => {
    expect(formatPaymentMethod('CASH')).toBe('Espèces');
    expect(formatPaymentMethod('MTN_MOMO')).toBe('MTN Mobile Money');
    expect(formatPaymentMethod('AIRTEL_MONEY')).toBe('Airtel Money');
    expect(formatPaymentMethod('BANK')).toBe('Virement / Carte bancaire');
  });

  it('traduit correctement les rôles utilisateur', () => {
    expect(formatUserRole('OWNER')).toBe('Propriétaire');
    expect(formatUserRole('MANAGER')).toBe('Gérant');
    expect(formatUserRole('CASHIER')).toBe('Caissier');
    expect(formatUserRole('DELIVERY')).toBe('Livreur');
  });
});

describe('Validation et normalisation de numéro de téléphone congolais', () => {
  it('valide un numéro congolais normalisé', () => {
    expect(isValidCongoMobile(normalizePhoneNumber('06 731 1016'))).toBe(true);
    expect(isValidCongoMobile(normalizePhoneNumber('05 555 1234'))).toBe(true);
    expect(isValidCongoMobile(normalizePhoneNumber('+242067311016'))).toBe(true);
  });

  it('rejette les numéros non conformes', () => {
    expect(isValidCongoMobile(normalizePhoneNumber('12345'))).toBe(false);
    expect(isValidCongoMobile(normalizePhoneNumber('012345678'))).toBe(false);
  });

  it('normalise le numéro au format international sans signe +', () => {
    expect(normalizePhoneNumber('06 731 1016')).toBe('242067311016');
    expect(normalizePhoneNumber('+242067311016')).toBe('242067311016');
  });
});
