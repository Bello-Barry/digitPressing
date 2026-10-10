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
  const auth = await requirePermission('view_audit_logs');
  if (!auth.authorized || !auth.profile?.membership) {
    return {
      logs: [],
      nextCursor: null,
      hasNextPage: false,
      error: auth.error || "Accès refusé : Seuls le propriétaire (OWNER) et le gérant (MANAGER) ont accès au journal d'audit.",
    };
  }

  const role = auth.role;
  const orgId = auth.profile.membership.organization_id;

  if (role !== 'OWNER' && role !== 'MANAGER') {
    return {
      logs: [],
      nextCursor: null,
      hasNextPage: false,
      error: "Accès refusé : Seuls le propriétaire (OWNER) et le gérant (MANAGER) ont accès au journal d'audit.",
    };
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
      changed_by_name,
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
    return {
      logs: [],
      nextCursor: null,
      hasNextPage: false,
      error: 'Impossible de charger le journal d\'audit.',
    };
  }

  const hasNextPage = rawLogs && rawLogs.length > limit;
  const logsList = hasNextPage ? rawLogs.slice(0, limit) : rawLogs || [];
  const nextCursor = hasNextPage ? logsList[logsList.length - 1].created_at : null;

  // 3. Récupération des informations sur les auteurs (memberships / user details)
  const userIds = Array.from(new Set(logsList.map((l: any) => l.user_id || l.changed_by).filter(Boolean)));
  let userMap: Record<string, { name: string; email: string; role: string }> = {};

  if (userIds.length > 0) {
    const { data: members } = await supabase
      .from('memberships')
      .select('user_id, role, full_name, email')
      .eq('organization_id', orgId)
      .in('user_id', userIds);

    if (members) {
      members.forEach((m: any) => {
        userMap[m.user_id] = {
          name: m.full_name || m.email || 'Utilisateur',
          email: m.email || '',
          role: m.role || 'Personnel',
        };
      });
    }
  }

  // Fonction utilitaire pour retirer les secrets d'un objet JSON
  const stripSecrets = (obj: any) => {
    if (!obj || typeof obj !== 'object') return null;
    const clone = { ...obj };
    delete clone.invoice_token;
    delete clone.ip_hash;
    return clone;
  };

  // 3b. Enrichissement des données liées (commandes, services, catégories, vêtements, membres, organisation)
  const orderIds = Array.from(
    new Set(
      logsList
        .map((l: any) => {
          const objType = l.object_type || l.table_name;
          const after = l.after || l.new_values;
          const before = l.before || l.old_values;
          if (objType === 'orders') return l.object_id || l.record_id;
          if (objType === 'order_items' || objType === 'payments') {
            return after?.order_id || before?.order_id;
          }
          return null;
        })
        .filter(Boolean)
    )
  );

  let orderCodeMap: Record<string, string> = {};
  if (orderIds.length > 0) {
    const { data: ordersData } = await supabase
      .from('orders')
      .select('id, ticket_number, request_code')
      .in('id', orderIds);

    if (ordersData) {
      ordersData.forEach((o: any) => {
        orderCodeMap[o.id] = o.ticket_number || o.request_code || 'sans réf.';
      });
    }
  }

  const categoryIds = Array.from(
    new Set(
      logsList
        .filter((l: any) => (l.object_type || l.table_name) === 'service_categories')
        .map((l: any) => l.object_id || l.record_id)
        .filter(Boolean)
    )
  );
  let categoryMap: Record<string, string> = {};
  if (categoryIds.length > 0) {
    const { data: cats } = await supabase
      .from('service_categories')
      .select('id, name')
      .in('id', categoryIds);
    if (cats) {
      cats.forEach((c: any) => {
        categoryMap[c.id] = c.name;
      });
    }
  }

  const garmentIds = Array.from(
    new Set(
      logsList
        .filter((l: any) => (l.object_type || l.table_name) === 'garment_types')
        .map((l: any) => l.object_id || l.record_id)
        .filter(Boolean)
    )
  );
  let garmentMap: Record<string, string> = {};
  if (garmentIds.length > 0) {
    const { data: garments } = await supabase
      .from('garment_types')
      .select('id, name')
      .in('id', garmentIds);
    if (garments) {
      garments.forEach((g: any) => {
        garmentMap[g.id] = g.name;
      });
    }
  }

  const membershipIds = Array.from(
    new Set(
      logsList
        .filter((l: any) => (l.object_type || l.table_name) === 'memberships')
        .map((l: any) => l.object_id || l.record_id)
        .filter(Boolean)
    )
  );
  let membershipMap: Record<string, { name: string; role: string }> = {};
  if (membershipIds.length > 0) {
    const { data: mems } = await supabase
      .from('memberships')
      .select('id, user_id, full_name, email, role')
      .in('id', membershipIds);
    if (mems) {
      mems.forEach((m: any) => {
        const name = m.full_name || m.email || 'Membre';
        membershipMap[m.id] = { name, role: m.role || '' };
        if (m.user_id) membershipMap[m.user_id] = { name, role: m.role || '' };
      });
    }
  }

  let orgName: string | null = null;
  if (logsList.some((l: any) => (l.object_type || l.table_name) === 'organizations')) {
    const { data: orgData } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .maybeSingle();
    if (orgData) orgName = orgData.name;
  }

  // 4. Mappage et normalisation des entrées
  const formattedLogs: AuditLogEntry[] = logsList.map((log: any) => {
    const authorId = log.user_id || log.changed_by;
    const author = authorId ? userMap[authorId] : null;

    // Defect 1 : Résolution de l'auteur
    // 1. changed_by_name si présent
    // 2. Nom retrouvé via user_id / changed_by dans userMap
    // 3. "Système" si pas d'utilisateur lié
    // 4. "Auteur inconnu" pour anciennes lignes avec authorId mais sans nom retrouvé
    let userName: string;
    if (log.changed_by_name && String(log.changed_by_name).trim() !== '') {
      userName = String(log.changed_by_name).trim();
    } else if (author?.name) {
      userName = author.name;
    } else if (!authorId) {
      userName = 'Système';
    } else {
      userName = 'Auteur inconnu';
    }

    const beforeObj = stripSecrets(log.before || log.old_values);
    const afterObj = stripSecrets(log.after || log.new_values);
    const objType = log.object_type || log.table_name || 'inconnu';
    const objId = log.object_id || log.record_id;

    // Extraction du code commande associé
    let orderCode: string | null = null;
    if (objType === 'orders') {
      orderCode = afterObj?.ticket_number || afterObj?.request_code || beforeObj?.ticket_number || beforeObj?.request_code || orderCodeMap[objId] || null;
    } else if (objType === 'order_items' || objType === 'payments') {
      const relOrderId = afterObj?.order_id || beforeObj?.order_id;
      if (relOrderId) {
        orderCode = orderCodeMap[relOrderId] || null;
      }
    }

    // Extraction du libellé d'élément pour Defect 2
    let itemLabel: string | null = null;
    if (objType === 'order_items') {
      itemLabel = afterObj?.service_name || beforeObj?.service_name || null;
    } else if (objType === 'services') {
      itemLabel = afterObj?.name || beforeObj?.name || null;
    } else if (objType === 'service_categories') {
      itemLabel = afterObj?.name || beforeObj?.name || categoryMap[objId] || null;
    } else if (objType === 'garment_types') {
      itemLabel = afterObj?.name || beforeObj?.name || garmentMap[objId] || null;
    } else if (objType === 'memberships') {
      itemLabel = afterObj?.full_name || beforeObj?.full_name || afterObj?.email || beforeObj?.email || membershipMap[objId]?.name || null;
    } else if (objType === 'organizations') {
      itemLabel = afterObj?.name || beforeObj?.name || orgName || null;
    }

    return {
      id: log.id,
      organization_id: log.organization_id,
      user_id: authorId,
      changed_by_name: log.changed_by_name || null,
      object_type: objType,
      object_id: objId,
      action: log.action,
      before: beforeObj,
      after: afterObj,
      created_at: log.created_at,
      user_name: userName,
      user_email: author?.email || null,
      user_role: author?.role || null,
      item_label: itemLabel,
      order_code: orderCode,
    };
  });

  return {
    logs: formattedLogs,
    nextCursor,
    hasNextPage,
    error: null,
  };
}

export async function getAuditAuthors() {
  const auth = await requirePermission('view_audit_logs');
  if (!auth.authorized || !auth.profile?.membership) {
    return [];
  }

  const role = auth.role;
  const orgId = auth.profile.membership.organization_id;

  if (role !== 'OWNER' && role !== 'MANAGER') {
    return [];
  }

  const supabase = await createServerSupabaseClient();
  const { data: members } = await supabase
    .from('memberships')
    .select('user_id, full_name, email, role')
    .eq('organization_id', orgId);

  return (members || []).map((m: any) => ({
    id: m.user_id,
    name: m.full_name || m.email || 'Membre',
    role: m.role,
  }));
}
