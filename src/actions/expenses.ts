'use server';

// =============================================================================
// SERVER ACTIONS - DÉPENSES ET COMPTABILITÉ (TÂCHE 4.8)
// Anti-détournement, plafonds, permissions et traçabilité immuable
// =============================================================================

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions-server';
import { revalidatePath } from 'next/cache';

export interface RecordExpenseInput {
  categoryId: string;
  amount: number;
  expenseDate: string; // ISO date 'YYYY-MM-DD'
  method: 'CASH' | 'MTN_MOMO' | 'AIRTEL_MONEY' | 'BANK' | 'OTHER';
  fromTill: boolean;
  payee?: string;
  reference?: string;
  note?: string;
  periodStart?: string;
  periodEnd?: string;
}

/**
 * 1. Enregistrer une nouvelle dépense via la fonction RPC sécurisée record_expense
 */
export async function recordExpenseAction(input: RecordExpenseInput) {
  try {
    const auth = await requirePermission('record_expense');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Accès refusé.' };
    }

    const orgId = auth.profile.membership.organization_id;
    const db = await createServerSupabaseClient();

    // Validations préliminaires du montant FCFA
    if (!input.amount || !Number.isFinite(input.amount) || input.amount <= 0) {
      return { success: false, error: 'Le montant doit être un nombre supérieur à 0 FCFA.' };
    }

    if (!Number.isInteger(input.amount)) {
      return { success: false, error: 'Les montants doivent être en FCFA entiers sans décimales.' };
    }

    if (!input.categoryId) {
      return { success: false, error: 'Veuillez sélectionner une catégorie de dépense.' };
    }

    if (!input.expenseDate) {
      return { success: false, error: 'La date de dépense est obligatoire.' };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (input.expenseDate > todayStr) {
      return { success: false, error: 'La date de dépense ne peut pas être dans le futur.' };
    }

    if (input.fromTill && input.method !== 'CASH') {
      return { success: false, error: 'Seules les dépenses en espèces (CASH) peuvent être payées depuis la caisse.' };
    }

    // Appel à la fonction PostgreSQL SECURITY DEFINER record_expense
    const { data: expenseId, error } = await db.rpc('record_expense', {
      p_org_id: orgId,
      p_category_id: input.categoryId,
      p_amount: input.amount,
      p_expense_date: input.expenseDate,
      p_method: input.method,
      p_from_till: input.fromTill,
      p_payee: input.payee ? input.payee.trim() : null,
      p_reference: input.reference ? input.reference.trim() : null,
      p_note: input.note ? input.note.trim() : null,
      p_period_start: input.periodStart || null,
      p_period_end: input.periodEnd || null,
    });

    if (error) {
      console.error('Erreur RPC record_expense:', error);
      return { success: false, error: error.message || 'Échec de l\'enregistrement de la dépense.' };
    }

    revalidatePath('/admin/depenses');
    revalidatePath('/admin/paiements');
    revalidatePath('/admin');
    revalidatePath('/admin/journal');

    return { success: true, expenseId: expenseId as string };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur d\'enregistrement de la dépense.',
    };
  }
}

/**
 * 2. Annuler une dépense existante avec motif obligatoire via RPC void_expense
 */
export async function voidExpenseAction(expenseId: string, reason: string) {
  try {
    const auth = await requirePermission('void_expense');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Accès refusé. Rôle réservé aux gérants et propriétaires.' };
    }

    if (!reason || reason.trim().length < 5) {
      return { success: false, error: 'Un motif d\'annulation détaillé (au moins 5 caractères) est obligatoire.' };
    }

    const db = await createServerSupabaseClient();

    const { error } = await db.rpc('void_expense', {
      p_id: expenseId,
      p_reason: reason.trim(),
    });

    if (error) {
      console.error('Erreur RPC void_expense:', error);
      return { success: false, error: error.message || 'Échec de l\'annulation de la dépense.' };
    }

    revalidatePath('/admin/depenses');
    revalidatePath('/admin/paiements');
    revalidatePath('/admin');
    revalidatePath('/admin/journal');

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors de l\'annulation de la dépense.',
    };
  }
}

/**
 * 3. Récupérer la liste des dépenses filtrée
 */
export async function getExpensesAction(options?: {
  period?: 'today' | '7days' | 'month' | 'all';
  categoryId?: string;
  method?: string;
  limit?: number;
  offset?: number;
}) {
  try {
    const auth = await requirePermission('record_expense');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Accès refusé.', expenses: [] };
    }

    const orgId = auth.profile.membership.organization_id;
    const db = await createServerSupabaseClient();

    let query = db
      .from('expenses')
      .select(`
        *,
        category:expense_categories(id, name, kind, counts_in_result, owner_only, cashier_allowed, note_required)
      `)
      .eq('organization_id', orgId)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false });

    // Filtre Période
    if (options?.period === 'today') {
      const today = new Date().toISOString().split('T')[0];
      query = query.eq('expense_date', today);
    } else if (options?.period === '7days') {
      const d7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      query = query.gte('expense_date', d7);
    } else if (options?.period === 'month') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      query = query.gte('expense_date', firstDay);
    }

    if (options?.categoryId) {
      query = query.eq('category_id', options.categoryId);
    }

    if (options?.method) {
      query = query.eq('method', options.method);
    }

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data: expenses, error } = await query;

    if (error) {
      console.error('Erreur lecture dépenses:', error);
      return { success: false, error: error.message, expenses: [] };
    }

    return { success: true, expenses: expenses || [] };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur de chargement des dépenses.',
      expenses: [],
    };
  }
}

/**
 * 4. Récupérer les catégories de dépenses de l'organisation
 */
export async function getExpenseCategoriesAction() {
  try {
    const auth = await requirePermission('record_expense');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Accès refusé.', categories: [] };
    }

    const orgId = auth.profile.membership.organization_id;
    const db = await createServerSupabaseClient();

    const { data: categories, error } = await db
      .from('expense_categories')
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Erreur lecture catégories de dépenses:', error);
      return { success: false, error: error.message, categories: [] };
    }

    return { success: true, categories: categories || [] };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur de chargement des catégories.',
      categories: [],
    };
  }
}

/**
 * 5. Créer une nouvelle catégorie de dépense (OWNER ou MANAGER)
 */
export async function createExpenseCategoryAction(input: {
  name: string;
  kind: 'DAILY' | 'FIXED' | 'TAX' | 'TRANSFER' | 'OTHER';
  countsInResult?: boolean;
  ownerOnly?: boolean;
  cashierAllowed?: boolean;
  noteRequired?: boolean;
}) {
  try {
    const auth = await requirePermission('manage_expense_categories');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Accès réservé au Propriétaire et au Gérant.' };
    }

    if (!input.name || input.name.trim().length < 2) {
      return { success: false, error: 'Le nom de la catégorie doit comporter au moins 2 caractères.' };
    }

    const role = auth.profile.membership.role;
    if (role === 'MANAGER' && input.ownerOnly) {
      return { success: false, error: 'Seul le propriétaire (OWNER) peut créer des catégories réservées aux propriétaires.' };
    }

    const orgId = auth.profile.membership.organization_id;
    const db = await createServerSupabaseClient();

    const { data, error } = await db
      .from('expense_categories')
      .insert({
        organization_id: orgId,
        name: input.name.trim(),
        kind: input.kind,
        counts_in_result: input.kind === 'TRANSFER' ? false : (input.countsInResult ?? true),
        owner_only: input.ownerOnly ?? false,
        cashier_allowed: input.cashierAllowed ?? false,
        note_required: input.noteRequired ?? false,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Une catégorie avec un nom similaire existe déjà.' };
      }
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/parametres');
    revalidatePath('/admin/depenses');

    return { success: true, category: data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors de la création de la catégorie.',
    };
  }
}

/**
 * 6. Modifier ou désactiver une catégorie de dépense (OWNER ou MANAGER)
 */
export async function updateExpenseCategoryAction(
  categoryId: string,
  input: {
    name?: string;
    isActive?: boolean;
    cashierAllowed?: boolean;
    noteRequired?: boolean;
  }
) {
  try {
    const auth = await requirePermission('manage_expense_categories');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Accès réservé au Propriétaire et au Gérant.' };
    }

    const orgId = auth.profile.membership.organization_id;
    const role = auth.profile.membership.role;
    const db = await createServerSupabaseClient();

    // Vérifier la catégorie existante
    const { data: existing } = await db
      .from('expense_categories')
      .select('id, owner_only, organization_id')
      .eq('id', categoryId)
      .single();

    if (!existing || existing.organization_id !== orgId) {
      return { success: false, error: 'Catégorie introuvable.' };
    }

    if (role === 'MANAGER' && existing.owner_only) {
      return { success: false, error: 'Le gérant ne peut pas modifier une catégorie réservée au propriétaire.' };
    }

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined && input.name.trim().length >= 2) {
      payload.name = input.name.trim();
    }
    if (input.isActive !== undefined) payload.is_active = input.isActive;
    if (input.cashierAllowed !== undefined) payload.cashier_allowed = input.cashierAllowed;
    if (input.noteRequired !== undefined) payload.note_required = input.noteRequired;

    const { error } = await db
      .from('expense_categories')
      .update(payload)
      .eq('id', categoryId);

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Une catégorie avec ce nom existe déjà.' };
      }
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/parametres');
    revalidatePath('/admin/depenses');

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur lors de la mise à jour de la catégorie.',
    };
  }
}

/**
 * 7. Mettre à jour le plafond de dépense du caissier (OWNER seulement)
 */
export async function updateCashierExpenseLimitAction(limit: number) {
  try {
    const auth = await requirePermission('manage_organization_settings');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Seul le propriétaire (OWNER) peut modifier le plafond du caissier.' };
    }

    if (!Number.isFinite(limit) || limit < 0 || !Number.isInteger(limit)) {
      return { success: false, error: 'Le plafond doit être un nombre entier positif en FCFA.' };
    }

    const orgId = auth.profile.membership.organization_id;
    const db = await createServerSupabaseClient();

    const { error } = await db
      .from('organizations')
      .update({ cashier_expense_limit: limit, updated_at: new Date().toISOString() })
      .eq('id', orgId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/parametres');
    revalidatePath('/admin/depenses');

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur de mise à jour du plafond.',
    };
  }
}

/**
 * 8. Calculer le résumé financier (Encaissements, Dépenses, RÉSULTAT base caisse) pour le Propriétaire
 */
export async function getExpenseSummaryAction(period: 'today' | 'week' | 'month' = 'month') {
  try {
    const auth = await requirePermission('view_results');
    if (!auth.authorized || !auth.profile?.membership) {
      return { success: false, error: auth.error || 'Accès réservé au propriétaire (OWNER).' };
    }

    const orgId = auth.profile.membership.organization_id;
    const db = await createServerSupabaseClient();

    const now = new Date();
    let startDate: string;

    if (period === 'today') {
      startDate = now.toISOString().split('T')[0];
    } else if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    }

    // 1. Total des encaissements sur la période
    const { data: payments } = await db
      .from('payments')
      .select('amount, method, collected_at')
      .eq('organization_id', orgId)
      .gte('collected_at', `${startDate}T00:00:00.000Z`);

    const totalEncaissement = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    const encaissementCash = payments?.filter((p) => p.method === 'CASH').reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    const encaissementMoMo = payments?.filter((p) => p.method !== 'CASH').reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    // 2. Total des dépenses sur la période (excluant counts_in_result = false)
    const { data: expenses } = await db
      .from('expenses')
      .select(`
        amount,
        method,
        from_till,
        expense_date,
        voided_at,
        category:expense_categories(id, name, kind, counts_in_result)
      `)
      .eq('organization_id', orgId)
      .gte('expense_date', startDate)
      .is('voided_at', null);

    const validExpenses = expenses || [];

    // Total toutes dépenses (incluant retraits/mouvements)
    const totalAllExpenses = validExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const cashExpensesFromTill = validExpenses
      .filter((e) => e.from_till && e.method === 'CASH')
      .reduce((sum, e) => sum + Number(e.amount), 0);

    // Dépenses retenues dans le résultat (counts_in_result = true)
    const resultExpenses = validExpenses.filter((e) => {
      const cat = Array.isArray(e.category) ? e.category[0] : e.category;
      return cat?.counts_in_result !== false;
    });

    const totalResultExpenses = resultExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

    // RÉSULTAT = Encaissements − Dépenses (base caisse)
    const netResult = totalEncaissement - totalResultExpenses;

    // Répartition par catégorie
    const categoryTotalsMap = new Map<string, { name: string; kind: string; total: number; countsInResult: boolean }>();

    for (const exp of validExpenses) {
      const cat = Array.isArray(exp.category) ? exp.category[0] : exp.category;
      if (!cat) continue;
      const existing = categoryTotalsMap.get(cat.id) || {
        name: cat.name,
        kind: cat.kind,
        total: 0,
        countsInResult: cat.counts_in_result ?? true,
      };
      existing.total += Number(exp.amount);
      categoryTotalsMap.set(cat.id, existing);
    }

    const categoryBreakdown = Array.from(categoryTotalsMap.values()).sort((a, b) => b.total - a.total);

    return {
      success: true,
      summary: {
        period,
        startDate,
        totalEncaissement,
        encaissementCash,
        encaissementMoMo,
        totalAllExpenses,
        cashExpensesFromTill,
        totalResultExpenses,
        netResult,
        categoryBreakdown,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur de calcul du résumé financier.',
    };
  }
}
