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
      after: { status: 'CANCELLED', cancellation_reason: 'Client a changé d\'avis' },
      order_code: 'LB-1001',
    });

    expect(result.title).toBe('Statut commande changé : Reçue → Annulée');
    expect(result.description).toBe('Commande LB-1001');
    expect(result.badgeColor).toBe('rose');
    expect(result.reason).toBe('Client a changé d\'avis');
  });

  it('formats order items insertion with ticket code correctly', () => {
    const result = formatAuditAction({
      object_type: 'order_items',
      action: 'INSERT',
      after: { service_name: 'Robe longue / soirée', quantity: 1, unit_price: 5000 },
      order_code: 'D-0006',
    });

    expect(result.title).toBe('Article ajouté à la commande D-0006 : Robe longue / soirée × 1');
    expect(result.badgeColor).toBe('emerald');
  });

  it('formats price update correctly', () => {
    const result = formatAuditAction({
      object_type: 'services',
      action: 'UPDATE',
      before: { name: 'Chemise', price: 3000 },
      after: { name: 'Chemise', price: 3500 },
    });

    expect(result.title).toMatch(/Prix modifié : 3[\s\u202f]000 FCFA → 3[\s\u202f]500 FCFA/);
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
