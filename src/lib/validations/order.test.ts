import { publicOrderRequestSchema } from './order';

const validOrder = {
  org_id: '11111111-1111-4111-8111-111111111111',
  client_name: 'Client Pressing',
  client_phone: '+242 06 123 4567',
  mode: 'DROP_OFF' as const,
  items: [{
    service_id: '22222222-2222-4222-8222-222222222222',
    service_name: 'Chemise',
    quantity: 2,
    unit_price: 500,
  }],
};

describe('publicOrderRequestSchema', () => {
  it('accepts a valid order and normalizes its phone number', () => {
    const result = publicOrderRequestSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.client_phone).toBe('242061234567');
  });

  it.each(['PICKUP', 'DELIVERY'] as const)('requires an address for %s orders', (mode) => {
    const result = publicOrderRequestSchema.safeParse({ ...validOrder, mode });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.path.includes('address'))).toBe(true);
  });

  it('rejects honeypot submissions, invalid quantities, and prices', () => {
    expect(publicOrderRequestSchema.safeParse({ ...validOrder, honeypot: 'bot' }).success).toBe(false);
    expect(publicOrderRequestSchema.safeParse({
      ...validOrder,
      items: [{ ...validOrder.items[0], quantity: 51 }],
    }).success).toBe(false);
    expect(publicOrderRequestSchema.safeParse({
      ...validOrder,
      items: [{ ...validOrder.items[0], unit_price: Number.NaN }],
    }).success).toBe(false);
  });
});
