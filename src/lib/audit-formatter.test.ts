import { formatAuditAction } from './audit-formatter';

describe('Audit Formatter', () => {
  it('formats order insertion correctly', () => {
    const result = formatAuditAction({
      object_type: 'orders',
      action: 'INSERT',
      after: { ticket_number: 'LB-1001', total_amount: 15000 },
    });

    expect(result.title).toBe('Commande créée : LB-1001');
    expect(result.badgeColor).toBe('blue');
  });

  it('formats order status update to CANCELLED correctly', () => {
    const result = formatAuditAction({
      object_type: 'orders',
      action: 'UPDATE',
      before: { status: 'RECEIVED' },
      after: { status: 'CANCELLED' },
      item_label: 'LB-1001',
    });

    expect(result.title).toContain('Statut commande changé');
    expect(result.title).toContain('Annulée');
    expect(result.badgeColor).toBe('rose');
  });

  it('formats price update correctly', () => {
    const result = formatAuditAction({
      object_type: 'services',
      action: 'UPDATE',
      before: { name: 'Chemise', price: 3000 },
      after: { name: 'Chemise', price: 3500 },
    });

    expect(result.title).toBe('Prix modifié : 3 000 FCFA → 3 500 FCFA');
    expect(result.badgeColor).toBe('amber');
  });

  it('formats role update correctly', () => {
    const result = formatAuditAction({
      object_type: 'memberships',
      action: 'UPDATE',
      before: { role: 'CASHIER' },
      after: { role: 'MANAGER' },
    });

    expect(result.title).toBe('Rôle modifié : CASHIER → MANAGER');
    expect(result.badgeColor).toBe('amber');
  });
});
