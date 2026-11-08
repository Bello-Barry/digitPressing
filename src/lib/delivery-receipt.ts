export interface ReceiptLineInput {
  order_item_id?: string | null;
  service_name: string;
  item_type?: string | null;
  color?: string | null;
  pattern?: string | null;
  brand?: string | null;
  size?: string | null;
  item_notes?: string | null;
  condition_discrepancy?: boolean;
  condition_note?: string | null;
  expected_quantity: number;
  received_quantity: number;
  discrepancy_note?: string | null;
}

export function validateReceiptLines(lines: ReceiptLineInput[]) {
  if (lines.length === 0) return 'Aucune ligne à contrôler.';
  const seen = new Set<string>();
  for (const line of lines) {
    if (!Number.isInteger(line.received_quantity) || line.received_quantity < 0) {
      return 'Chaque quantité reçue doit être un entier positif ou nul.';
    }
    if (!Number.isInteger(line.expected_quantity) || line.expected_quantity < 0) {
      return 'Chaque quantité facturée doit être un entier positif ou nul.';
    }
    if (line.order_item_id && seen.has(line.order_item_id)) return 'Une ligne de facture apparaît plusieurs fois.';
    if (line.order_item_id) seen.add(line.order_item_id);
    if ((line.expected_quantity !== line.received_quantity || line.condition_discrepancy) && (line.discrepancy_note || line.condition_note || '').trim().length < 5) {
      return `Un motif de cinq caractères minimum est requis pour l’écart sur « ${line.service_name} ».`;
    }
  }
  return null;
}

export function getReceiptStatus(lines: ReceiptLineInput[]) {
  return lines.every((line) => line.expected_quantity === line.received_quantity && !line.condition_discrepancy) ? 'CONFORM' : 'DISCREPANCY';
}
