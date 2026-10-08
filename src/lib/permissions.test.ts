/**
 * @jest-environment node
 */

import { can, PERMISSION_MATRIX, Role, Permission } from './permissions';

describe('Matrice des permissions can(role, permission)', () => {
  const roles: Role[] = ['OWNER', 'MANAGER', 'CASHIER', 'DELIVERY'];
  const permissions = Object.keys(PERMISSION_MATRIX) as Permission[];

  test('Vérification exhaustive de la matrice', () => {
    // Tests explicites selon la matrice demandée
    expect(can('OWNER', 'create_order')).toBe(true);
    expect(can('MANAGER', 'create_order')).toBe(true);
    expect(can('CASHIER', 'create_order')).toBe(true);
    expect(can('DELIVERY', 'create_order')).toBe(false);

    expect(can('OWNER', 'change_order_status')).toBe(true);
    expect(can('MANAGER', 'change_order_status')).toBe(true);
    expect(can('CASHIER', 'change_order_status')).toBe(true);
    expect(can('DELIVERY', 'change_order_status')).toBe(true);

    expect(can('OWNER', 'record_payment')).toBe(true);
    expect(can('MANAGER', 'record_payment')).toBe(true);
    expect(can('CASHIER', 'record_payment')).toBe(true);
    expect(can('DELIVERY', 'record_payment')).toBe(true);

    expect(can('OWNER', 'view_orders_and_clients')).toBe(true);
    expect(can('MANAGER', 'view_orders_and_clients')).toBe(true);
    expect(can('CASHIER', 'view_orders_and_clients')).toBe(true);
    expect(can('DELIVERY', 'view_orders_and_clients')).toBe(false);

    expect(can('OWNER', 'view_own_deliveries')).toBe(true);
    expect(can('MANAGER', 'view_own_deliveries')).toBe(true);
    expect(can('CASHIER', 'view_own_deliveries')).toBe(false);
    expect(can('DELIVERY', 'view_own_deliveries')).toBe(true);

    expect(can('OWNER', 'view_stats_and_daily_summary')).toBe(true);
    expect(can('MANAGER', 'view_stats_and_daily_summary')).toBe(true);
    expect(can('CASHIER', 'view_stats_and_daily_summary')).toBe(false);
    expect(can('DELIVERY', 'view_stats_and_daily_summary')).toBe(false);

    expect(can('OWNER', 'view_margins_and_service_costs')).toBe(true);
    expect(can('MANAGER', 'view_margins_and_service_costs')).toBe(false);
    expect(can('CASHIER', 'view_margins_and_service_costs')).toBe(false);
    expect(can('DELIVERY', 'view_margins_and_service_costs')).toBe(false);

    expect(can('OWNER', 'manage_services')).toBe(true);
    expect(can('MANAGER', 'manage_services')).toBe(true);
    expect(can('CASHIER', 'manage_services')).toBe(false);
    expect(can('DELIVERY', 'manage_services')).toBe(false);

    expect(can('OWNER', 'export_client_data')).toBe(true);
    expect(can('MANAGER', 'export_client_data')).toBe(false);
    expect(can('CASHIER', 'export_client_data')).toBe(false);
    expect(can('DELIVERY', 'export_client_data')).toBe(false);

    expect(can('OWNER', 'manage_team_and_roles')).toBe(true);
    expect(can('MANAGER', 'manage_team_and_roles')).toBe(false);
    expect(can('CASHIER', 'manage_team_and_roles')).toBe(false);
    expect(can('DELIVERY', 'manage_team_and_roles')).toBe(false);

    expect(can('OWNER', 'manage_organization_settings')).toBe(true);
    expect(can('MANAGER', 'manage_organization_settings')).toBe(false);
    expect(can('CASHIER', 'manage_organization_settings')).toBe(false);
    expect(can('DELIVERY', 'manage_organization_settings')).toBe(false);
  });

  test('Gestion des cas de rôles invalides, nulls ou minuscules', () => {
    expect(can(null, 'create_order')).toBe(false);
    expect(can(undefined, 'create_order')).toBe(false);
    expect(can('INVALID_ROLE', 'create_order')).toBe(false);
    expect(can('owner', 'manage_team_and_roles')).toBe(true);
    expect(can('cashier', 'manage_team_and_roles')).toBe(false);
  });

  test('Toutes les combinaisons de la matrice sont définies', () => {
    for (const perm of permissions) {
      for (const role of roles) {
        const value = can(role, perm);
        expect(typeof value).toBe('boolean');
        expect(value).toBe(PERMISSION_MATRIX[perm][role]);
      }
    }
  });
});
