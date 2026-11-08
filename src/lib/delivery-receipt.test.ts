/* global describe, it, expect */
import { getReceiptStatus, validateReceiptLines } from './delivery-receipt';
import type { ReceiptLineInput } from './delivery-receipt';

const line = (overrides: Partial<ReceiptLineInput> = {}): ReceiptLineInput => ({
  order_item_id: 'line-1',
  service_name: 'Chemise',
  expected_quantity: 2,
  received_quantity: 2,
  discrepancy_note: '',
  ...overrides,
});

describe('contrôle de réception D3', () => {
  it('accepte une ligne conforme', () => {
    expect(validateReceiptLines([line()])).toBeNull();
    expect(getReceiptStatus([line()])).toBe('CONFORM');
  });

  it('exige un motif pour une quantité différente', () => {
    expect(validateReceiptLines([line({ received_quantity: 1 })])).toContain('motif');
    expect(validateReceiptLines([line({ received_quantity: 1, discrepancy_note: 'Tache visible' })])).toBeNull();
    expect(getReceiptStatus([line({ received_quantity: 1, discrepancy_note: 'Tache visible' })])).toBe('DISCREPANCY');
  });

  it('rejette les doublons, les fractions et les quantités négatives', () => {
    expect(validateReceiptLines([line(), line()])).toContain('plusieurs fois');
    expect(validateReceiptLines([line({ received_quantity: 1.5 })])).toContain('entier');
    expect(validateReceiptLines([line({ received_quantity: -1 })])).toContain('entier');
  });

  it('exige un motif pour les pièces hors facture', () => {
    const extra = line({ order_item_id: null, expected_quantity: 0, received_quantity: 1, service_name: 'Pantalon ajouté' });
    expect(validateReceiptLines([extra])).toContain('motif');
    expect(validateReceiptLines([{ ...extra, discrepancy_note: 'Article non facturé' }])).toBeNull();
  });

  it('traite un état endommagé comme un écart même si le compte est identique', () => {
    const damaged = line({ condition_discrepancy: true, condition_note: 'Tache non signalée' });
    expect(validateReceiptLines([damaged])).toBeNull();
    expect(getReceiptStatus([damaged])).toBe('DISCREPANCY');
    expect(validateReceiptLines([line({ condition_discrepancy: true })])).toContain('motif');
  });
});
