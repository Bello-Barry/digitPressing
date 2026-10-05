// =============================================================================
// VALIDATIONS ZOD - COMMANDES & DEMANDES EN LIGNE
// =============================================================================

import { z } from 'zod';
import { normalizePhoneNumber } from '@/lib/whatsapp';

export const orderItemSchema = z.object({
  service_id: z.string().uuid().optional().nullable(),
  service_name: z.string().min(1, 'Le nom de l\'article est requis'),
  quantity: z.number().int().min(1, 'La quantité minimale est de 1'),
  unit_price: z.number().min(0, 'Le prix unitaire doit être positif ou nul'),
  notes: z.string().optional().nullable(),
});

export const publicOrderRequestSchema = z.object({
  org_id: z.string().uuid('Organisation invalide'),
  client_name: z.string().min(2, 'Le nom doit comporter au moins 2 caractères').max(100),
  client_phone: z
    .string()
    .min(6, 'Numéro de téléphone trop court')
    .max(20, 'Numéro de téléphone trop long')
    .transform((val) => normalizePhoneNumber(val)),
  mode: z.enum(['DROP_OFF', 'PICKUP', 'DELIVERY']).default('DROP_OFF'),
  address: z.string().max(255).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  requested_at: z.string().datetime().optional().nullable(),
  items: z.array(orderItemSchema).min(1, 'Veuillez sélectionner au moins un article'),
  honeypot: z.string().max(0, 'Tentative de spam détectée').optional().default(''),
});

export type PublicOrderRequestInput = z.infer<typeof publicOrderRequestSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
