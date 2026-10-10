// =============================================================================
// VALIDATIONS ZOD - COMMANDES & DEMANDES EN LIGNE
// =============================================================================

import { z } from 'zod';
import { normalizePhoneNumber, isValidCongoMobile } from '@/lib/whatsapp';

export const orderItemSchema = z.object({
  service_id: z.string().uuid('Service invalide'),
  service_name: z.string().min(1, 'Le nom de l\'article est requis').max(100),
  quantity: z.number().int().min(1, 'La quantité minimale est de 1').max(50),
  unit_price: z.number().finite().min(0, 'Le prix unitaire doit être positif ou nul'),
  notes: z.string().max(1000).optional().nullable(),
  item_type: z.string().max(100).optional().nullable(),
  color: z.string().max(50).optional().nullable(),
  pattern: z.string().max(50).optional().nullable(),
  brand: z.string().max(100).optional().nullable(),
  size: z.string().max(50).optional().nullable(),
  item_notes: z.string().max(1000).optional().nullable(),
});

export const publicOrderRequestSchema = z.object({
  org_id: z.string().uuid('Organisation invalide'),
  client_name: z.string().min(2, 'Le nom doit comporter au moins 2 caractères').max(100),
  client_phone: z
    .string()
    .min(6, 'Numéro de téléphone trop court')
    .max(20, 'Numéro de téléphone trop long')
    .transform((val) => normalizePhoneNumber(val))
    .refine((val) => isValidCongoMobile(val), {
      message: 'Numéro invalide : exemple 06 731 1016',
    }),
  mode: z.enum(['DROP_OFF', 'PICKUP', 'DELIVERY']).default('DROP_OFF'),
  address: z.string().max(255).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  requested_at: z.string().datetime().optional().nullable(),
  items: z.array(orderItemSchema).min(1, 'Veuillez sélectionner au moins un article'),
  honeypot: z.string().max(0, 'Tentative de spam détectée').optional().default(''),
}).superRefine((order, context) => {
  if ((order.mode === 'PICKUP' || order.mode === 'DELIVERY') && !order.address?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['address'],
      message: 'Une adresse est requise pour ce mode de service.',
    });
  }
  if (order.items.length > 50) {
    context.addIssue({
      code: z.ZodIssueCode.too_big,
      maximum: 50,
      inclusive: true,
      type: 'array',
      path: ['items'],
      message: 'Une commande ne peut pas dépasser 50 lignes d’articles.',
    });
  }
});

export type PublicOrderRequestInput = z.infer<typeof publicOrderRequestSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
