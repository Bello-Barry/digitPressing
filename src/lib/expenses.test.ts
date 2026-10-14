/**
 * @jest-environment node
 */

import { can } from './permissions';

describe('Logique métier & Validations des Dépenses (Tâche 4.8)', () => {
  // 1. Matrice des permissions
  describe('Matrice des permissions relatives aux dépenses', () => {
    test('Saisie de dépense (record_expense)', () => {
      expect(can('OWNER', 'record_expense')).toBe(true);
      expect(can('MANAGER', 'record_expense')).toBe(true);
      expect(can('CASHIER', 'record_expense')).toBe(true);
      expect(can('DELIVERY', 'record_expense')).toBe(false);
    });

    test('Gestion des catégories de dépenses réservée à l\'OWNER (manage_expense_categories)', () => {
      expect(can('OWNER', 'manage_expense_categories')).toBe(true);
      expect(can('MANAGER', 'manage_expense_categories')).toBe(false);
      expect(can('CASHIER', 'manage_expense_categories')).toBe(false);
      expect(can('DELIVERY', 'manage_expense_categories')).toBe(false);
    });

    test('Annulation de dépense (void_expense)', () => {
      expect(can('OWNER', 'void_expense')).toBe(true);
      expect(can('MANAGER', 'void_expense')).toBe(true);
      expect(can('CASHIER', 'void_expense')).toBe(false);
      expect(can('DELIVERY', 'void_expense')).toBe(false);
    });

    test('Consultation du Résultat financier (view_results)', () => {
      expect(can('OWNER', 'view_results')).toBe(true);
      expect(can('MANAGER', 'view_results')).toBe(false);
      expect(can('CASHIER', 'view_results')).toBe(false);
      expect(can('DELIVERY', 'view_results')).toBe(false);
    });
  });

  // 2. Validation des montants FCFA (Entiers positifs > 0)
  describe('Validation des montants en FCFA entiers', () => {
    const isValidFcfaAmount = (val: number): boolean => {
      return Number.isFinite(val) && val > 0 && Number.isInteger(val);
    };

    test('Montants entiers positifs sont valides', () => {
      expect(isValidFcfaAmount(5000)).toBe(true);
      expect(isValidFcfaAmount(10000)).toBe(true);
      expect(isValidFcfaAmount(1)).toBe(true);
    });

    test('Montants nuls ou négatifs sont invalides', () => {
      expect(isValidFcfaAmount(0)).toBe(false);
      expect(isValidFcfaAmount(-5000)).toBe(false);
    });

    test('Montants avec décimales sont invalides', () => {
      expect(isValidFcfaAmount(5000.5)).toBe(false);
      expect(isValidFcfaAmount(10.01)).toBe(false);
    });
  });

  // 3. Validation des dates pour caissier (aujourd'hui ou hier uniquement)
  describe('Règles de date pour le caissier (CASHIER)', () => {
    const isCashierDateAllowed = (dateStr: string, todayStr: string): boolean => {
      const target = new Date(dateStr);
      const today = new Date(todayStr);
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      const targetIso = target.toISOString().split('T')[0];
      const todayIso = today.toISOString().split('T')[0];
      const yesterdayIso = yesterday.toISOString().split('T')[0];

      return targetIso === todayIso || targetIso === yesterdayIso;
    };

    const today = '2026-10-14';

    test('Date d\'aujourd\'hui est autorisée', () => {
      expect(isCashierDateAllowed('2026-10-14', today)).toBe(true);
    });

    test('Date d\'hier est autorisée', () => {
      expect(isCashierDateAllowed('2026-10-13', today)).toBe(true);
    });

    test('Date antérieure de 2 jours ou plus est refusée', () => {
      expect(isCashierDateAllowed('2026-10-12', today)).toBe(false);
    });

    test('Date future est refusée', () => {
      expect(isCashierDateAllowed('2026-10-15', today)).toBe(false);
    });
  });

  // 4. Contrôle du plafond caissier
  describe('Contrôle du plafond de dépense caissier', () => {
    const isUnderLimit = (amount: number, limit: number): boolean => {
      return amount <= limit;
    };

    test('Montant inférieur ou égal au plafond est accepté', () => {
      expect(isUnderLimit(5000, 10000)).toBe(true);
      expect(isUnderLimit(10000, 10000)).toBe(true);
    });

    test('Montant supérieur au plafond est refusé', () => {
      expect(isUnderLimit(10001, 10000)).toBe(false);
      expect(isUnderLimit(15000, 10000)).toBe(false);
    });
  });
});
