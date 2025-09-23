// =============================================================================
// STORE USERS - Digit PRESSING
// =============================================================================

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import type {
  User,
  UserFilters,
  UserSort,
  UserPermission,
  LoadingState
} from '@/types';
import { useAuthStore } from './auth';

interface UsersState extends LoadingState {
  // État des utilisateurs
  users: User[];
  currentUser: User | null;
  filters: UserFilters;
  sort: UserSort;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  // Stats utilisateurs
  userStats: {
    totalUsers: number;
    activeUsers: number;
    owners: number;
    employees: number;
  } | null;

  // Actions CRUD
  fetchUsers: (options?: { reset?: boolean }) => Promise<void>;
  searchUsers: (searchTerm: string) => Promise<void>;
  createUser: (userData: Omit<User, 'id' | 'createdAt' | 'lastLogin'>) => Promise<User>;
  updateUser: (id: string, updates: Partial<User>) => Promise<void>;
  deactivateUser: (id: string) => Promise<void>;
  activateUser: (id: string) => Promise<void>;
  updatePermissions: (id: string, permissions: UserPermission[]) => Promise<void>;
  changeUserRole: (id: string, newRole: 'owner' | 'employee') => Promise<void>;

  // Actions permissions
  grantPermission: (userId: string, action: string) => Promise<void>;
  revokePermission: (userId: string, action: string) => Promise<void>;
  bulkUpdatePermissions: (userIds: string[], permissions: UserPermission[]) => Promise<void>;

  // Gestion des filtres et tri
  setFilters: (filters: Partial<UserFilters>) => void;
  setSort: (sort: UserSort) => void;
  setPagination: (page: number, limit?: number) => void;
  resetFilters: () => void;

  // Stats et utilitaires
  fetchUserStats: () => Promise<void>;
  getActiveUsers: () => User[];
  getOwners: () => User[];
  getEmployees: () => User[];
  getUserById: (id: string) => User | undefined;
  hasPermission: (userId: string, action: string) => boolean;
  setCurrentUser: (user: User | null) => void;
  clearError: () => void;
  reset: () => void;
}

const initialFilters: UserFilters = {
  role: undefined,
  isActive: undefined,
  searchTerm: undefined,
};

const initialSort: UserSort = {
  field: 'fullName',
  direction: 'asc',
};

const initialPagination = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
};

// Permissions par défaut pour les employés
const DEFAULT_EMPLOYEE_PERMISSIONS: UserPermission[] = [
  { action: 'create_invoice', granted: true },
  { action: 'cancel_invoice', granted: false },
  { action: 'view_revenue', granted: false },
  { action: 'manage_users', granted: false },
  { action: 'modify_prices', granted: false },
  { action: 'export_data', granted: false },
];

// Permissions complètes pour les owners
const OWNER_PERMISSIONS: UserPermission[] = [
  { action: 'create_invoice', granted: true },
  { action: 'cancel_invoice', granted: true },
  { action: 'view_revenue', granted: true },
  { action: 'manage_users', granted: true },
  { action: 'modify_prices', granted: true },
  { action: 'export_data', granted: true },
];

export const useUsersStore = create<UsersState>()(
  subscribeWithSelector((set, get) => ({
    // État initial
    users: [],
    currentUser: null,
    filters: initialFilters,
    sort: initialSort,
    pagination: initialPagination,
    userStats: null,
    isLoading: false,
    error: null,
    lastUpdated: undefined,

    // Actions
    fetchUsers: async (options = {}) => {
      try {
        const { reset = false } = options;
        const { filters, sort, pagination } = get();
        const currentUser = useAuthStore.getState().user;

        if (!currentUser) {
          throw new Error('Utilisateur non connecté');
        }

        // Vérifier les permissions
        if (currentUser.role !== 'owner') {
          throw new Error('Accès refusé - Propriétaires seulement');
        }

        if (reset || get().users.length === 0) {
          set({ isLoading: true, error: null });
        }

        // Construction de la requête
        let query = supabase
          .from('users')
          .select(`
            *,
            pressing:pressings(name)
          `, { count: 'exact' })
          .eq('pressing_id', currentUser.pressingId);

        // Application des filtres
        if (filters.role) {
          query = query.eq('role', filters.role);
        }

        if (filters.isActive !== undefined) {
          query = query.eq('is_active', filters.isActive);
        }

        if (filters.searchTerm) {
          query = query.or(`full_name.ilike.%${filters.searchTerm}%,email.ilike.%${filters.searchTerm}%`);
        }

        // Application du tri
        query = query.order(sort.field === 'fullName' ? 'full_name' : sort.field, {
          ascending: sort.direction === 'asc'
        });

        // Application de la pagination
        const from = (pagination.page - 1) * pagination.limit;
        const to = from + pagination.limit - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) {
          throw error;
        }

        const users: User[] = data?.map(row => ({
          id: row.id,
          email: row.email,
          role: row.role,
          pressingId: row.pressing_id,
          fullName: row.full_name,
          phone: row.phone,
          permissions: row.permissions as UserPermission[],
          isActive: row.is_active,
          lastLogin: row.last_login,
          createdAt: row.created_at,
        })) || [];

        const totalPages = Math.ceil((count || 0) / pagination.limit);

        set({
          users,
          pagination: {
            ...pagination,
            total: count || 0,
            totalPages,
          },
          isLoading: false,
          lastUpdated: new Date().toISOString(),
        });

      } catch (error: any) {
        console.error('Erreur lors du chargement des utilisateurs:', error);
        set({
          error: error.message || 'Erreur lors du chargement des utilisateurs',
          isLoading: false,
        });
      }
    },

    searchUsers: async (searchTerm: string) => {
      set(state => ({
        filters: { ...state.filters, searchTerm },
        pagination: { ...state.pagination, page: 1 },
      }));
      
      await get().fetchUsers({ reset: true });
    },

    createUser: async (userData) => {
      try {
        const currentUser = useAuthStore.getState().user;
        if (!currentUser || currentUser.role !== 'owner') {
          throw new Error('Accès refusé - Propriétaires seulement');
        }

        set({ isLoading: true, error: null });

        // Créer d'abord l'utilisateur dans auth.users via l'API admin
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: userData.email,
          password: 'MotDePasseTemporaire123!', // Mot de passe temporaire
          email_confirm: true,
          user_metadata: {
            full_name: userData.fullName,
            pressing_id: currentUser.pressingId,
          }
        });

        if (authError) {
          throw authError;
        }

        if (!authUser.user) {
          throw new Error('Erreur lors de la création du compte utilisateur');
        }

        // Créer le profil utilisateur
        const permissions = userData.role === 'owner' ? OWNER_PERMISSIONS : DEFAULT_EMPLOYEE_PERMISSIONS;

        const { data, error } = await supabase
          .from('users')
          .insert({
            id: authUser.user.id,
            pressing_id: currentUser.pressingId,
            email: userData.email,
            full_name: userData.fullName,
            phone: userData.phone,
            role: userData.role,
            permissions: permissions,
            is_active: userData.isActive !== false,
          })
          .select()
          .single();

        if (error) {
          // Nettoyer l'utilisateur auth en cas d'erreur
          await supabase.auth.admin.deleteUser(authUser.user.id);
          throw error;
        }

        const newUser: User = {
          id: data.id,
          email: data.email,
          role: data.role,
          pressingId: data.pressing_id,
          fullName: data.full_name,
          phone: data.phone,
          permissions: data.permissions as UserPermission[],
          isActive: data.is_active,
          lastLogin: data.last_login,
          createdAt: data.created_at,
        };

        // Mettre à jour la liste des utilisateurs
        set(state => ({
          users: [newUser, ...state.users],
          pagination: {
            ...state.pagination,
            total: state.pagination.total + 1,
          },
          isLoading: false,
        }));

        return newUser;

      } catch (error: any) {
        console.error('Erreur lors de la création d\'utilisateur:', error);
        set({
          error: error.message || 'Erreur lors de la création d\'utilisateur',
          isLoading: false,
        });
        throw error;
      }
    },

    updateUser: async (id: string, updates: Partial<User>) => {
      try {
        const currentUser = useAuthStore.getState().user;
        if (!currentUser || currentUser.role !== 'owner') {
          throw new Error('Accès refusé - Propriétaires seulement');
        }

        set({ isLoading: true, error: null });

        // Préparer les données pour Supabase
        const updateData: any = {
          updated_at: new Date().toISOString(),
        };

        if (updates.fullName) updateData.full_name = updates.fullName;
        if (updates.phone !== undefined) updateData.phone = updates.phone;
        if (updates.role) updateData.role = updates.role;
        if (updates.permissions) updateData.permissions = updates.permissions;
        if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

        const { error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', id)
          .eq('pressing_id', currentUser.pressingId);

        if (error) {
          throw error;
        }

        // Mettre à jour la liste des utilisateurs
        set(state => ({
          users: state.users.map(user =>
            user.id === id
              ? { ...user, ...updates }
              : user
          ),
          currentUser: state.currentUser?.id === id
            ? { ...state.currentUser, ...updates }
            : state.currentUser,
          isLoading: false,
        }));

      } catch (error: any) {
        console.error('Erreur lors de la mise à jour d\'utilisateur:', error);
        set({
          error: error.message || 'Erreur lors de la mise à jour d\'utilisateur',
          isLoading: false,
        });
        throw error;
      }
    },

    deactivateUser: async (id: string) => {
      try {
        await get().updateUser(id, { isActive: false });
      } catch (error) {
        throw error;
      }
    },

    activateUser: async (id: string) => {
      try {
        await get().updateUser(id, { isActive: true });
      } catch (error) {
        throw error;
      }
    },

    updatePermissions: async (id: string, permissions: UserPermission[]) => {
      try {
        await get().updateUser(id, { permissions });
      } catch (error) {
        throw error;
      }
    },

    changeUserRole: async (id: string, newRole: 'owner' | 'employee') => {
      try {
        const permissions = newRole === 'owner' ? OWNER_PERMISSIONS : DEFAULT_EMPLOYEE_PERMISSIONS;
        await get().updateUser(id, { role: newRole, permissions });
      } catch (error) {
        throw error;
      }
    },

    grantPermission: async (userId: string, action: string) => {
      try {
        const { users } = get();
        const user = users.find(u => u.id === userId);
        
        if (!user) {
          throw new Error('Utilisateur non trouvé');
        }

        const updatedPermissions = user.permissions.map(perm =>
          perm.action === action
            ? { ...perm, granted: true }
            : perm
        );

        await get().updatePermissions(userId, updatedPermissions);

      } catch (error: any) {
        console.error('Erreur lors de l\'octroi de permission:', error);
        throw error;
      }
    },

    revokePermission: async (userId: string, action: string) => {
      try {
        const { users } = get();
        const user = users.find(u => u.id === userId);
        
        if (!user) {
          throw new Error('Utilisateur non trouvé');
        }

        const updatedPermissions = user.permissions.map(perm =>
          perm.action === action
            ? { ...perm, granted: false }
            : perm
        );

        await get().updatePermissions(userId, updatedPermissions);

      } catch (error: any) {
        console.error('Erreur lors de la révocation de permission:', error);
        throw error;
      }
    },

    bulkUpdatePermissions: async (userIds: string[], permissions: UserPermission[]) => {
      try {
        const currentUser = useAuthStore.getState().user;
        if (!currentUser || currentUser.role !== 'owner') {
          throw new Error('Accès refusé - Propriétaires seulement');
        }

        set({ isLoading: true, error: null });

        const updates = userIds.map(id => ({
          id,
          permissions,
          updated_at: new Date().toISOString(),
        }));

        const { error } = await supabase
          .from('users')
          .upsert(updates);

        if (error) throw error;

        // Mettre à jour localement
        set(state => ({
          users: state.users.map(user =>
            userIds.includes(user.id)
              ? { ...user, permissions }
              : user
          ),
          isLoading: false,
        }));

      } catch (error: any) {
        console.error('Erreur lors de la mise à jour en lot des permissions:', error);
        set({
          error: error.message || 'Erreur lors de la mise à jour en lot des permissions',
          isLoading: false,
        });
        throw error;
      }
    },

    setFilters: (newFilters: Partial<UserFilters>) => {
      set(state => ({
        filters: { ...state.filters, ...newFilters },
        pagination: { ...state.pagination, page: 1 },
      }));
      
      get().fetchUsers({ reset: true });
    },

    setSort: (newSort: UserSort) => {
      set({
        sort: newSort,
        pagination: { ...get().pagination, page: 1 }
      });
      
      get().fetchUsers({ reset: true });
    },

    setPagination: (page: number, limit?: number) => {
      set(state => ({
        pagination: {
          ...state.pagination,
          page,
          limit: limit || state.pagination.limit,
        }
      }));
      
      get().fetchUsers();
    },

    resetFilters: () => {
      set({
        filters: initialFilters,
        sort: initialSort,
        pagination: initialPagination,
      });
      
      get().fetchUsers({ reset: true });
    },

    fetchUserStats: async () => {
      try {
        const currentUser = useAuthStore.getState().user;
        if (!currentUser || currentUser.role !== 'owner') return;

        const { data, error } = await supabase
          .from('users')
          .select('role, is_active')
          .eq('pressing_id', currentUser.pressingId);

        if (error) throw error;

        const totalUsers = data?.length || 0;
        const activeUsers = data?.filter(u => u.is_active).length || 0;
        const owners = data?.filter(u => u.role === 'owner').length || 0;
        const employees = data?.filter(u => u.role === 'employee').length || 0;

        set({
          userStats: {
            totalUsers,
            activeUsers,
            owners,
            employees,
          }
        });

      } catch (error: any) {
        console.error('Erreur lors du chargement des stats utilisateurs:', error);
      }
    },

    getActiveUsers: () => {
      const { users } = get();
      return users.filter(user => user.isActive);
    },

    getOwners: () => {
      const { users } = get();
      return users.filter(user => user.role === 'owner');
    },

    getEmployees: () => {
      const { users } = get();
      return users.filter(user => user.role === 'employee');
    },

    getUserById: (id: string) => {
      const { users } = get();
      return users.find(user => user.id === id);
    },

    hasPermission: (userId: string, action: string) => {
      const { users } = get();
      const user = users.find(u => u.id === userId);
      
      if (!user) return false;
      if (user.role === 'owner') return true;
      
      const permission = user.permissions.find(p => p.action === action);
      return permission?.granted || false;
    },

    setCurrentUser: (user: User | null) => {
      set({ currentUser: user });
    },

    clearError: () => {
      set({ error: null });
    },

    reset: () => {
      set({
        users: [],
        currentUser: null,
        filters: initialFilters,
        sort: initialSort,
        pagination: initialPagination,
        userStats: null,
        isLoading: false,
        error: null,
        lastUpdated: undefined,
      });
    },
  }))
);

// Sélecteurs optimisés - EXPORTS CORRECTS
export const useUsers = () => {
  return useUsersStore(state => ({
    users: state.users,
    userStats: state.userStats,
    isLoading: state.isLoading,
    error: state.error,
    pagination: state.pagination,
    lastUpdated: state.lastUpdated,
  }));
};

export const useUserActions = () => {
  return useUsersStore(state => ({
    fetchUsers: state.fetchUsers,
    searchUsers: state.searchUsers,
    createUser: state.createUser,
    updateUser: state.updateUser,
    deactivateUser: state.deactivateUser,
    activateUser: state.activateUser,
    updatePermissions: state.updatePermissions,
    changeUserRole: state.changeUserRole,
    grantPermission: state.grantPermission,
    revokePermission: state.revokePermission,
    bulkUpdatePermissions: state.bulkUpdatePermissions,
    fetchUserStats: state.fetchUserStats,
    clearError: state.clearError,
  }));
};

export const useUserFilters = () => {
  return useUsersStore(state => ({
    filters: state.filters,
    sort: state.sort,
    setFilters: state.setFilters,
    setSort: state.setSort,
    resetFilters: state.resetFilters,
  }));
};

export const useCurrentUser = () => {
  return useUsersStore(state => ({
    currentUser: state.currentUser,
    setCurrentUser: state.setCurrentUser,
  }));
};

export const useUserHelpers = () => {
  return useUsersStore(state => ({
    getActiveUsers: state.getActiveUsers,
    getOwners: state.getOwners,
    getEmployees: state.getEmployees,
    getUserById: state.getUserById,
    hasPermission: state.hasPermission,
  }));
};

// Écouter les changements en temps réel
if (typeof window !== 'undefined') {
  const currentUser = useAuthStore.getState().user;

  if (currentUser && currentUser.role === 'owner') {
    supabase
      .channel(`users_${currentUser.pressingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `pressing_id=eq.${currentUser.pressingId}`,
        },
        (payload) => {
          const store = useUsersStore.getState();

          switch (payload.eventType) {
            case 'INSERT':
              const newUser = payload.new as any;
              if (!store.users.find(u => u.id === newUser.id)) {
                useUsersStore.setState(state => ({
                  users: [newUser, ...state.users],
                  pagination: {
                    ...state.pagination,
                    total: state.pagination.total + 1,
                  }
                }));
              }
              break;

            case 'UPDATE':
              const updatedUser = payload.new as any;
              useUsersStore.setState(state => ({
                users: state.users.map(u =>
                  u.id === updatedUser.id ? updatedUser : u
                ),
                currentUser: state.currentUser?.id === updatedUser.id
                  ? updatedUser
                  : state.currentUser,
              }));
              break;

            case 'DELETE':
              const deletedUser = payload.old as any;
              useUsersStore.setState(state => ({
                users: state.users.filter(u => u.id !== deletedUser.id),
                pagination: {
                  ...state.pagination,
                  total: Math.max(0, state.pagination.total - 1),
                },
                currentUser: state.currentUser?.id === deletedUser.id
                  ? null
                  : state.currentUser,
              }));
              break;
          }

          // Actualiser les stats après chaque changement
          store.fetchUserStats();
        }
      )
      .subscribe();
  }
}