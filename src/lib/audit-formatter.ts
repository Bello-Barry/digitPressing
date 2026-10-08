export interface AuditLogEntry {
  id: string;
  organization_id: string;
  user_id: string | null;
  object_type: string;
  object_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  before: Record<string, any> | null;
  after: Record<string, any> | null;
  created_at: string;
  user_name?: string | null;
  user_email?: string | null;
  user_role?: string | null;
  item_label?: string | null;
}

/**
 * Formatage d'une action d'audit en libellé français lisible.
 * Utilisable pour le journal d'audit et la page des alertes.
 */
export function formatAuditAction(log: Partial<AuditLogEntry>): {
  title: string;
  description: string;
  badgeColor: 'blue' | 'amber' | 'emerald' | 'rose' | 'gray';
} {
  const objectType = log.object_type || 'élément';
  const action = log.action || 'INSERT';
  const after = log.after || {};
  const before = log.before || {};

  // Formateur de devises FCFA
  const formatMoney = (val: any) => {
    const num = Number(val);
    if (isNaN(num)) return `${val || 0} FCFA`;
    return `${num.toLocaleString('fr-FR')} FCFA`;
  };

  // 1. ORDERS / COMMANDES
  if (objectType === 'orders') {
    if (action === 'INSERT') {
      const code = after.ticket_number || after.request_code || 'Nouvelle';
      return {
        title: `Commande créée : ${code}`,
        description: `Montant total : ${formatMoney(after.total_amount)}`,
        badgeColor: 'blue',
      };
    }
    if (action === 'UPDATE') {
      if (before.status && after.status && before.status !== after.status) {
        const statusMap: Record<string, string> = {
          PENDING: 'En attente',
          RECEIVED: 'Reçue / Validée',
          IN_PROGRESS: 'En traitement',
          READY: 'Prête',
          DELIVERED: 'Livrée',
          CANCELLED: 'Annulée',
        };
        const oldSt = statusMap[before.status] || before.status;
        const newSt = statusMap[after.status] || after.status;
        return {
          title: `Statut commande changé : ${oldSt} → ${newSt}`,
          description: log.item_label ? `Commande ${log.item_label}` : `Modification de statut`,
          badgeColor: after.status === 'CANCELLED' ? 'rose' : 'amber',
        };
      }
      if (before.total_amount !== undefined && after.total_amount !== undefined && before.total_amount !== after.total_amount) {
        return {
          title: `Montant commande modifié : ${formatMoney(before.total_amount)} → ${formatMoney(after.total_amount)}`,
          description: log.item_label ? `Commande ${log.item_label}` : 'Ajustement du total',
          badgeColor: 'amber',
        };
      }
      return {
        title: `Commande modifiée`,
        description: log.item_label ? `Commande ${log.item_label}` : 'Mise à jour des informations',
        badgeColor: 'blue',
      };
    }
    if (action === 'DELETE') {
      return {
        title: `Commande supprimée`,
        description: before.ticket_number ? `Ticket ${before.ticket_number}` : `Réf #${log.object_id?.slice(0, 8)}`,
        badgeColor: 'rose',
      };
    }
  }

  // 2. PAYMENTS / PAIEMENTS
  if (objectType === 'payments') {
    if (action === 'INSERT') {
      const methodMap: Record<string, string> = {
        CASH: 'en espèces',
        MOBILE_MONEY: 'par Mobile Money',
        CARD: 'par carte',
      };
      const method = methodMap[after.payment_method] || after.payment_method || '';
      return {
        title: `Paiement enregistré : ${formatMoney(after.amount)} ${method}`.trim(),
        description: log.item_label ? `Pour la commande ${log.item_label}` : `Règlement de facture`,
        badgeColor: 'emerald',
      };
    }
    return {
      title: `Opération de paiement (${action})`,
      description: `Montant : ${formatMoney(after.amount || before.amount)}`,
      badgeColor: 'amber',
    };
  }

  // 3. SERVICES / TARIFS
  if (objectType === 'services') {
    const serviceName = after.name || before.name || log.item_label || 'Service';
    if (action === 'INSERT') {
      return {
        title: `Nouveau service créé : ${serviceName}`,
        description: `Prix : ${formatMoney(after.price)}`,
        badgeColor: 'emerald',
      };
    }
    if (action === 'UPDATE') {
      if (before.price !== undefined && after.price !== undefined && before.price !== after.price) {
        return {
          title: `Prix modifié : ${formatMoney(before.price)} → ${formatMoney(after.price)}`,
          description: `Service : ${serviceName}`,
          badgeColor: 'amber',
        };
      }
      return {
        title: `Service modifié : ${serviceName}`,
        description: `Mise à jour du catalogue`,
        badgeColor: 'blue',
      };
    }
  }

  // 4. SERVICE_COSTS / COÛTS
  if (objectType === 'service_costs') {
    if (before.cost_price !== undefined && after.cost_price !== undefined) {
      return {
        title: `Coût de revient modifié : ${formatMoney(before.cost_price)} → ${formatMoney(after.cost_price)}`,
        description: `Coût interne de prestation`,
        badgeColor: 'amber',
      };
    }
    return {
      title: `Coût de revient ajusté`,
      description: `Mise à jour du prix de revient`,
      badgeColor: 'amber',
    };
  }

  // 5. MEMBERSHIPS / PERSONNEL
  if (objectType === 'memberships') {
    if (action === 'INSERT') {
      return {
        title: `Nouveau membre du personnel ajouté`,
        description: `Rôle : ${after.role}`,
        badgeColor: 'emerald',
      };
    }
    if (action === 'UPDATE') {
      if (before.role !== undefined && after.role !== undefined && before.role !== after.role) {
        return {
          title: `Rôle modifié : ${before.role} → ${after.role}`,
          description: `Membre du personnel`,
          badgeColor: 'amber',
        };
      }
      if (before.is_active !== undefined && after.is_active !== undefined) {
        const status = after.is_active ? 'activé' : 'désactivé';
        return {
          title: `Compte utilisateur ${status}`,
          description: `Changement de statut membre`,
          badgeColor: after.is_active ? 'emerald' : 'rose',
        };
      }
    }
  }

  // 6. ORGANIZATIONS / PARAMÈTRES
  if (objectType === 'organizations') {
    return {
      title: `Paramètres de l'établissement modifiés`,
      description: `Mise à jour de la configuration`,
      badgeColor: 'blue',
    };
  }

  // DEFAUT
  const actionTextMap: Record<string, string> = {
    INSERT: 'Création',
    UPDATE: 'Modification',
    DELETE: 'Suppression',
  };
  const actionText = actionTextMap[action] || action;
  return {
    title: `${actionText} sur ${objectType}`,
    description: log.item_label ? `Élément : ${log.item_label}` : `ID : ${log.object_id?.slice(0, 8)}`,
    badgeColor: 'gray',
  };
}
