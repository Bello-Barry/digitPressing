// =============================================================================
// MATRICE DES PERMISSIONS - DIGIT PRESSING (SOURCE UNIQUE DE VÉRITÉ)
// Rôles : OWNER, MANAGER, CASHIER, DELIVERY
// =============================================================================

export type Role = 'OWNER' | 'MANAGER' | 'CASHIER' | 'DELIVERY';

export type Permission =
  | 'create_order'
  | 'change_order_status'
  | 'record_payment'
  | 'view_orders_and_clients'
  | 'view_own_deliveries'
  | 'view_stats_and_daily_summary'
  | 'view_margins_and_service_costs'
  | 'manage_services'
  | 'export_client_data'
  | 'manage_team_and_roles'
  | 'manage_organization_settings';

export const PERMISSION_MATRIX: Record<Permission, Record<Role, boolean>> = {
  create_order: {
    OWNER: true,
    MANAGER: true,
    CASHIER: true,
    DELIVERY: false,
  },
  change_order_status: {
    OWNER: true,
    MANAGER: true,
    CASHIER: true,
    DELIVERY: true, // restreint dans la logique métier au passage 'DELIVERED' pour ses livraisons
  },
  record_payment: {
    OWNER: true,
    MANAGER: true,
    CASHIER: true,
    DELIVERY: true, // restreint dans la logique métier aux encaissements de ses livraisons
  },
  view_orders_and_clients: {
    OWNER: true,
    MANAGER: true,
    CASHIER: true,
    DELIVERY: false,
  },
  view_own_deliveries: {
    OWNER: true,
    MANAGER: true,
    CASHIER: false,
    DELIVERY: true,
  },
  view_stats_and_daily_summary: {
    OWNER: true,
    MANAGER: true,
    CASHIER: false,
    DELIVERY: false,
  },
  view_margins_and_service_costs: {
    OWNER: true,
    MANAGER: false,
    CASHIER: false,
    DELIVERY: false,
  },
  manage_services: {
    OWNER: true,
    MANAGER: true,
    CASHIER: false,
    DELIVERY: false,
  },
  export_client_data: {
    OWNER: true,
    MANAGER: false,
    CASHIER: false,
    DELIVERY: false,
  },
  manage_team_and_roles: {
    OWNER: true,
    MANAGER: false,
    CASHIER: false,
    DELIVERY: false,
  },
  manage_organization_settings: {
    OWNER: true,
    MANAGER: false,
    CASHIER: false,
    DELIVERY: false,
  },
};

/**
 * Fonction pure de vérification d'une permission selon le rôle.
 * Utilisable dans les composants client et serveur.
 */
export function can(role: string | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const normalizedRole = role.toUpperCase() as Role;
  if (!(normalizedRole in PERMISSION_MATRIX[permission])) {
    return false;
  }
  return PERMISSION_MATRIX[permission][normalizedRole] ?? false;
}
