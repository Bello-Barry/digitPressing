export interface AuditLogEntry {
  id: string;
  organization_id: string;
  user_id: string | null;
  changed_by_name?: string | null;
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
  order_code?: string | null;
  reason?: string | null;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  REQUEST: 'Demande',
  VALIDATED: 'Validée',
  RECEIVED: 'Reçue',
  PROCESSING: 'En traitement',
  READY: 'Prête',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
  REJECTED: 'Rejetée',
  PENDING: 'En attente',
  IN_PROGRESS: 'En traitement',
};

export const ACTION_LABELS: Record<string, string> = {
  INSERT: 'Création',
  UPDATE: 'Modification',
  DELETE: 'Suppression',
};

/**
 * Formatage d'une action d'audit en libellé français lisible.
 * Utilisable pour le journal d'audit et la page des alertes.
 */
export function formatAuditAction(log: Partial<AuditLogEntry>): {
  title: string;
  description: string;
  badgeColor: 'blue' | 'amber' | 'emerald' | 'rose' | 'gray';
  reason?: string | null;
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

  // Extraction du motif éventuel
  const reason =
    after.cancellation_reason ||
    after.rejection_reason ||
    after.reason ||
    before.cancellation_reason ||
    before.rejection_reason ||
    before.reason ||
    log.reason ||
    null;

  // Code de commande
  const orderCode =
    log.order_code ||
    after.ticket_number ||
    after.request_code ||
    before.ticket_number ||
    before.request_code ||
    'Inconnue';

  // 1. ORDER_ITEMS / ARTICLES DE COMMANDE
  if (objectType === 'order_items') {
    const itemName = after.service_name || before.service_name || log.item_label || 'Article';
    const quantity = after.quantity || before.quantity || 1;

    if (action === 'INSERT') {
      return {
        title: `Article ajouté à la commande ${orderCode} : ${itemName} × ${quantity}`,
        description: `Prix unitaire : ${formatMoney(after.unit_price || 0)}`,
        badgeColor: 'emerald',
        reason,
      };
    }
    if (action === 'UPDATE') {
      return {
        title: `Article modifié sur la commande ${orderCode} : ${itemName} × ${quantity}`,
        description: `Modification de ligne d'article`,
        badgeColor: 'amber',
        reason,
      };
    }
    if (action === 'DELETE') {
      return {
        title: `Article retiré de la commande ${orderCode} : ${itemName}`,
        description: `Suppression d'un article`,
        badgeColor: 'rose',
        reason,
      };
    }
  }

  // 2. ORDERS / COMMANDES
  if (objectType === 'orders') {
    if (action === 'INSERT') {
      return {
        title: `Commande créée : ${orderCode}`,
        description: `Montant total : ${formatMoney(after.total_amount)}`,
        badgeColor: 'blue',
        reason,
      };
    }
    if (action === 'UPDATE') {
      if (before.status && after.status && before.status !== after.status) {
        const oldSt = ORDER_STATUS_LABELS[before.status] || before.status;
        const newSt = ORDER_STATUS_LABELS[after.status] || after.status;
        return {
          title: `Statut commande changé : ${oldSt} → ${newSt}`,
          description: `Commande ${orderCode}`,
          badgeColor: after.status === 'CANCELLED' || after.status === 'REJECTED' ? 'rose' : 'amber',
          reason,
        };
      }
      if (before.total_amount !== undefined && after.total_amount !== undefined && before.total_amount !== after.total_amount) {
        return {
          title: `Montant commande modifié : ${formatMoney(before.total_amount)} → ${formatMoney(after.total_amount)}`,
          description: `Commande ${orderCode}`,
          badgeColor: 'amber',
          reason,
        };
      }
      return {
        title: `Commande modifiée : ${orderCode}`,
        description: 'Mise à jour des informations',
        badgeColor: 'blue',
        reason,
      };
    }
    if (action === 'DELETE') {
      return {
        title: `Commande supprimée : ${orderCode}`,
        description: `Suppression définitive`,
        badgeColor: 'rose',
        reason,
      };
    }
  }

  // 3. PAYMENTS / PAIEMENTS
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
        description: orderCode !== 'Inconnue' ? `Pour la commande ${orderCode}` : `Règlement de facture`,
        badgeColor: 'emerald',
        reason,
      };
    }
    return {
      title: `Opération de paiement (${ACTION_LABELS[action] || action})`,
      description: `Montant : ${formatMoney(after.amount || before.amount)}`,
      badgeColor: 'amber',
      reason,
    };
  }

  // 4. SERVICES / TARIFS
  if (objectType === 'services') {
    const serviceName = after.name || before.name || log.item_label || 'Service';
    if (action === 'INSERT') {
      return {
        title: `Nouveau service créé : ${serviceName}`,
        description: `Prix : ${formatMoney(after.price)}`,
        badgeColor: 'emerald',
        reason,
      };
    }
    if (action === 'UPDATE') {
      if (before.price !== undefined && after.price !== undefined && before.price !== after.price) {
        return {
          title: `Prix modifié : ${formatMoney(before.price)} → ${formatMoney(after.price)}`,
          description: `Service : ${serviceName}`,
          badgeColor: 'amber',
          reason,
        };
      }
      return {
        title: `Service modifié : ${serviceName}`,
        description: `Mise à jour du catalogue`,
        badgeColor: 'blue',
        reason,
      };
    }
    if (action === 'DELETE') {
      return {
        title: `Service supprimé : ${serviceName}`,
        description: `Retrait du catalogue`,
        badgeColor: 'rose',
        reason,
      };
    }
  }

  // 5. SERVICE_CATEGORIES / CATÉGORIES
  if (objectType === 'service_categories') {
    const catName = after.name || before.name || log.item_label || 'Catégorie';
    if (action === 'INSERT') {
      return {
        title: `Nouvelle catégorie créée : ${catName}`,
        description: `Gestion des catégories`,
        badgeColor: 'emerald',
        reason,
      };
    }
    if (action === 'UPDATE') {
      return {
        title: `Catégorie modifiée : ${catName}`,
        description: `Mise à jour de la catégorie`,
        badgeColor: 'blue',
        reason,
      };
    }
    if (action === 'DELETE') {
      return {
        title: `Catégorie supprimée : ${catName}`,
        description: `Suppression de catégorie`,
        badgeColor: 'rose',
        reason,
      };
    }
  }

  // 6. GARMENT_TYPES / ARTICLES DU CATALOGUE
  if (objectType === 'garment_types') {
    const garmentName = after.name || before.name || log.item_label || 'Article du catalogue';
    if (action === 'INSERT') {
      return {
        title: `Article du catalogue créé : ${garmentName}`,
        description: `Catalogue de vêtements`,
        badgeColor: 'emerald',
        reason,
      };
    }
    if (action === 'UPDATE') {
      return {
        title: `Article du catalogue modifié : ${garmentName}`,
        description: `Mise à jour du type de vêtement`,
        badgeColor: 'blue',
        reason,
      };
    }
    if (action === 'DELETE') {
      return {
        title: `Article du catalogue supprimé : ${garmentName}`,
        description: `Suppression du type de vêtement`,
        badgeColor: 'rose',
        reason,
      };
    }
  }

  // 7. SERVICE_COSTS / COÛTS
  if (objectType === 'service_costs') {
    if (before.cost_price !== undefined && after.cost_price !== undefined) {
      return {
        title: `Coût de revient modifié : ${formatMoney(before.cost_price)} → ${formatMoney(after.cost_price)}`,
        description: `Coût interne de prestation`,
        badgeColor: 'amber',
        reason,
      };
    }
    return {
      title: `Coût de revient ajusté`,
      description: `Mise à jour du prix de revient`,
      badgeColor: 'amber',
      reason,
    };
  }

  // 8. MEMBERSHIPS / PERSONNEL
  if (objectType === 'memberships') {
    const memberName = after.full_name || before.full_name || after.email || before.email || log.item_label || 'Membre';
    const roleText = after.role || before.role ? ` (${after.role || before.role})` : '';

    if (action === 'INSERT') {
      return {
        title: `Nouveau membre du personnel ajouté : ${memberName}${roleText}`,
        description: `Création de compte membre`,
        badgeColor: 'emerald',
        reason,
      };
    }
    if (action === 'UPDATE') {
      if (before.role !== undefined && after.role !== undefined && before.role !== after.role) {
        return {
          title: `Rôle modifié : ${before.role} → ${after.role}`,
          description: `Membre : ${memberName}`,
          badgeColor: 'amber',
          reason,
        };
      }
      if (before.is_active !== undefined && after.is_active !== undefined) {
        const status = after.is_active ? 'activé' : 'désactivé';
        return {
          title: `Compte utilisateur ${status} : ${memberName}`,
          description: `Changement de statut membre`,
          badgeColor: after.is_active ? 'emerald' : 'rose',
          reason,
        };
      }
      return {
        title: `Membre du personnel modifié : ${memberName}`,
        description: `Mise à jour de profil`,
        badgeColor: 'blue',
        reason,
      };
    }
    if (action === 'DELETE') {
      return {
        title: `Membre du personnel retiré : ${memberName}`,
        description: `Suppression du membre`,
        badgeColor: 'rose',
        reason,
      };
    }
  }

  // 9. ORGANIZATIONS / PARAMÈTRES
  if (objectType === 'organizations') {
    const orgName = after.name || before.name || log.item_label || 'Établissement';
    return {
      title: `Paramètres de l'établissement modifiés : ${orgName}`,
      description: `Mise à jour de la configuration`,
      badgeColor: 'blue',
      reason,
    };
  }

  // DEFAUT
  const actionText = ACTION_LABELS[action] || action;
  return {
    title: `${actionText} sur ${objectType}`,
    description: log.item_label ? `Élément : ${log.item_label}` : `ID : ${log.object_id?.slice(0, 8)}`,
    badgeColor: 'gray',
    reason,
  };
}
