'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions-server';
import { revalidatePath } from 'next/cache';
import { validateReceiptLines, type ReceiptLineInput } from '@/lib/delivery-receipt';

export async function inspectDeliveryReceiptAction(missionId: string, lines: ReceiptLineInput[]): Promise<{
  success: boolean;
  error?: string;
  status?: string;
  ticket_number?: string;
  message?: string;
}> {
  const auth = await requirePermission('create_order');
  if (!auth.authorized || !auth.profile?.membership) {
    return { success: false, error: auth.error || 'Permission insuffisante pour réceptionner.' };
  }
  const validationError = validateReceiptLines(lines);
  if (validationError) return { success: false, error: validationError };
  try {
    const db = await createServerSupabaseClient();
    const { data, error } = await db.rpc('inspect_delivery_receipt', {
      p_mission_id: missionId,
      p_lines_json: lines as unknown as never,
    });
    if (error) return { success: false, error: error.message };
    const result = data as { ok?: boolean; status?: string; ticket_number?: string; message?: string };
    revalidatePath('/admin/missions');
    revalidatePath('/admin/commandes');
    revalidatePath('/admin');
    if (result.status === 'CONFORM') revalidatePath('/admin/journal');
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Échec du contrôle de réception.' };
  }
}

export async function resolveDeliveryReceiptAction(missionId: string, resolutionNote: string): Promise<{
  success: boolean;
  error?: string;
  status?: string;
  ticket_number?: string;
}> {
  const auth = await requirePermission('manage_missions');
  if (!auth.authorized || !auth.profile?.membership) {
    return { success: false, error: auth.error || 'Seul un responsable peut traiter un écart.' };
  }
  if (resolutionNote.trim().length < 5) {
    return { success: false, error: 'Le motif de résolution doit contenir au moins cinq caractères.' };
  }
  try {
    const db = await createServerSupabaseClient();
    const { data, error } = await db.rpc('resolve_delivery_receipt', {
      p_mission_id: missionId,
      p_resolution_note: resolutionNote.trim(),
    });
    if (error) return { success: false, error: error.message };
    const result = data as { ok?: boolean; status?: string; ticket_number?: string };
    revalidatePath('/admin/missions');
    revalidatePath('/admin/commandes');
    revalidatePath('/admin');
    revalidatePath('/admin/journal');
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Échec de résolution de l’écart.' };
  }
}
