'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions-server';
import { AuditLogEntry } from '@/lib/audit-formatter';

export interface GetAuditLogsParams {
  period?: 'today' | '7days' | '30days' | 'all';
  authorId?: string;
  objectType?: string;
  cursor?: string; // date created_at pour pagination
  limit?: number;
}

export async function getAuditLogs(params: GetAuditLogsParams = {}) {
  // 1. Contrôle d'accès : OWNER ou MANAGER uniquement
  const { user, orgId, role } = await requirePermission('view_audit_logs');

  if (role !== 'OWNER' && role !== 'MANAGER') {
    throw new Error("Accès refusé : Seuls le propriétaire (OWNER) et le gérant (MANAGER) ont accès au journal d'audit.");
  }

  const supabase = await createServerSupabaseClient();
  const limit = params.limit || 20;

  // 2. Construction de la requête SQL/Supabase
  let query = supabase
    .from('audit_logs')
    .select(`
      id,
      organization_id,
      user_id,
      changed_by,
      object_type,
      table_name,
      object_id,
      record_id,
      action,
      before,
      old_values,
      after,
      new_values,
      created_at
    `)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  // Filtre par période
  if (params.period && params.period !== 'all') {
    const now = new Date();
    let startDate = new Date();
    if (params.period === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (params.period === '7days') {
      startDate.setDate(now.getDate() - 7);
    } else if (params.period === '30days') {
      startDate.setDate(now.getDate() - 30);
    }
    query = query.gte('created_at', startDate.toISOString());
  }

  // Filtre par auteur
  if (params.authorId) {
    query = query.or(`user_id.eq.${params.authorId},changed_by.eq.${params.authorId}`);
  }

  // Filtre par type d'objet
  if (params.objectType) {
    query = query.or(`object_type.eq.${params.objectType},table_name.eq.${params.objectType}`);
  }

  // Masquage strict de 'service_costs' pour le rôle MANAGER
  if (role !== 'OWNER') {
    query = query.neq('object_type', 'service_costs').neq('table_name', 'service_costs');
  }

  // Pagination par curseur
  if (params.cursor) {
    query = query.lt('created_at', params.cursor);
  }

  const { data: rawLogs, error } = await query;

  if (error) {
    console.error('Erreur lors de la récupération du journal d\'audit:', error);
    throw new Error('Impossible de charger le journal d\'audit.');
  }

  const hasNextPage = rawLogs && rawLogs.length > limit;
  const logsList = hasNextPage ? rawLogs.slice(0, limit) : rawLogs || [];
  const nextCursor = hasNextPage ? logsList[logsList.length - 1].created_at : null;

  // 3. Récupération des informations sur les auteurs (memberships / user details)
  const userIds = Array.from(new Set(logsList.map((l) => l.user_id || l.changed_by).filter(Boolean)));
  let userMap: Record<string, { name: string; email: string; role: string }> = {};

  if (userIds.length > 0) {
    const { data: members } = await supabase
      .from('memberships')
      .select('user_id, role, full_name, email')
      .eq('organization_id', orgId)
      .in('user_id', userIds);

    if (members) {
      members.forEach((m) => {
        userMap[m.user_id] = {
          name: m.full_name || m.email || 'Utilisateur',
          email: m.email || '',
          role: m.role || 'Personnel',
        };
      });
    }
  }

  // 4. Mappage et normalisation des entrées
  const formattedLogs: AuditLogEntry[] = logsList.map((log) => {
    const authorId = log.user_id || log.changed_by;
    const author = authorId ? userMap[authorId] : null;

    return {
      id: log.id,
      organization_id: log.organization_id,
      user_id: authorId,
      object_type: log.object_type || log.table_name || 'inconnu',
      object_id: log.object_id || log.record_id,
      action: log.action,
      before: log.before || log.old_values || null,
      after: log.after || log.new_values || null,
      created_at: log.created_at,
      user_name: author?.name || (authorId ? 'Auteur inconnu' : 'Système / Clé de service'),
      user_email: author?.email || null,
      user_role: author?.role || null,
    };
  });

  return {
    logs: formattedLogs,
    nextCursor,
    hasNextPage,
  };
}

export async function getAuditAuthors() {
  const { orgId, role } = await requirePermission('view_audit_logs');
  if (role !== 'OWNER' && role !== 'MANAGER') {
    return [];
  }

  const supabase = await createServerSupabaseClient();
  const { data: members } = await supabase
    .from('memberships')
    .select('user_id, full_name, email, role')
    .eq('organization_id', orgId);

  return (members || []).map((m) => ({
    id: m.user_id,
    name: m.full_name || m.email || 'Membre',
    role: m.role,
  }));
}
