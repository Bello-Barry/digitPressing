// =============================================================================
// STORE AUTHENTIFICATION - Digit PRESSING
// =============================================================================

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { supabase, getCurrentUser, getUserProfile } from '@/lib/supabase';
import { clientSignInAction, clientSignUpAction, clientSignOutAction, clientRefreshSessionAction, sendPasswordResetWithRedirectAction, updatePasswordAction } from '@/actions/auth';
import type { User, AuthSession, UserPreferences } from '@/types';

interface AuthState {
  // État
  user: User | null;
  session: AuthSession | null;
  preferences: UserPreferences | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, pressingId?: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  initialize: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  clearError: () => void;
  loadUserPreferences: () => Promise<void>;
}

// Préférences par défaut
const getDefaultPreferences = (): UserPreferences => ({
  theme: 'system',
  language: 'fr',
  currency: '€',
  timezone: 'Europe/Paris',
  notifications: {
    email: true,
    push: true,
    sound: true,
  },
  dashboard: {
    defaultView: 'today',
    showQuickStats: true,
    showRecentInvoices: true,
  },
});

export const useAuthStore = create<AuthState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // État initial
        user: null,
        session: null,
        preferences: null,
        isLoading: false,
        isInitialized: false,
        error: null,

        // Actions
        signIn: async (email: string, password: string) => {
          try {
            set({ isLoading: true, error: null });

            const authResult = await clientSignInAction(email, password);
            if (!authResult.success || !authResult.userId) {
              throw new Error(authResult.error || 'Connexion impossible.');
            }
            const { data, error } = await supabase.auth.getSession();
            if (error || !data.session?.user) {
              throw new Error('Aucun utilisateur retourné après connexion');
            }

            // Récupérer le profil utilisateur complet
            const profile = await getUserProfile(authResult.userId);
            if (!profile) {
              throw new Error('Impossible de récupérer le profil utilisateur');
            }

            // Mettre à jour la date de dernière connexion
            await supabase
              .from('users')
              .update({ 
                last_login: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', authResult.userId);

            const user: User = {
              id: profile.id,
              email: profile.email ?? '',
              role: (profile.role ?? 'owner') as 'owner' | 'employee',
              pressingId: profile.pressing_id ?? profile.organization_id ?? '',
              fullName: profile.full_name ?? 'Utilisateur',
              permissions: (profile.permissions as any[]) || [],
              createdAt: profile.created_at ?? new Date().toISOString(),
              lastLogin: new Date().toISOString(),
              isActive: profile.is_active ?? true,
            };

            const expiresAtVal = data.session.expires_at ? new Date(data.session.expires_at * 1000).toISOString() : '';
            const session: AuthSession = {
              user,
              accessToken: data.session.access_token,
              refreshToken: data.session.refresh_token,
              expiresAt: expiresAtVal,
            };

            set({ user, session, isLoading: false });

            // Charger les préférences utilisateur
            await get().loadUserPreferences();

          } catch (error: any) {
            console.error('Erreur lors de la connexion:', error);
            set({ 
              error: error.message || 'Erreur lors de la connexion', 
              isLoading: false,
              user: null,
              session: null 
            });
            throw error;
          }
        },

        signUp: async (email: string, password: string, fullName: string, pressingId?: string) => {
          try {
            set({ isLoading: true, error: null });

            // Créer le compte utilisateur
            const result = await clientSignUpAction({ email, password, fullName, pressingId });
            if (!result.success || !result.userId) {
              throw new Error(result.error || 'Inscription impossible.');
            }
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;
            if (!data.session?.user) {
              throw new Error('Aucun utilisateur créé');
            }

            // Si un pressingId est fourni, créer le profil utilisateur
            if (pressingId && result.userId) {
              const { error: profileError } = await supabase
                .from('users')
                .insert({
                  id: result.userId,
                  email: email.trim().toLowerCase(),
                  full_name: fullName.trim(),
                  pressing_id: pressingId,
                  role: 'employee',
                  permissions: [
                    { action: 'create_invoice', granted: true },
                    { action: 'view_revenue', granted: false },
                    { action: 'cancel_invoice', granted: false },
                    { action: 'manage_users', granted: false },
                  ],
                  is_active: true,
                });

              if (profileError) {
                console.error('Erreur lors de la création du profil:', profileError);
              }
            }

            set({ isLoading: false });

          } catch (error: any) {
            console.error('Erreur lors de l\'inscription:', error);
            set({ 
              error: error.message || 'Erreur lors de l\'inscription', 
              isLoading: false 
            });
            throw error;
          }
        },

        signOut: async () => {
          try {
            set({ isLoading: true, error: null });

            const result = await clientSignOutAction();
            if (!result.success) throw new Error(result.error || 'Déconnexion impossible.');

            set({ 
              user: null, 
              session: null, 
              preferences: null,
              isLoading: false,
              error: null
            });

          } catch (error: any) {
            console.error('Erreur lors de la déconnexion:', error);
            set({ 
              error: error.message || 'Erreur lors de la déconnexion', 
              isLoading: false 
            });
            throw error;
          }
        },

        resetPassword: async (email: string) => {
          try {
            set({ isLoading: true, error: null });

            const result = await sendPasswordResetWithRedirectAction(email, `${window.location.origin}/auth/callback?next=/auth/reset-password`);
            if (!result.success) throw new Error(result.error || 'Envoi impossible.');

            set({ isLoading: false });

          } catch (error: any) {
            console.error('Erreur lors de la réinitialisation:', error);
            set({ 
              error: error.message || 'Erreur lors de la réinitialisation', 
              isLoading: false 
            });
            throw error;
          }
        },

        updatePassword: async (newPassword: string) => {
          try {
            set({ isLoading: true, error: null });

            const result = await updatePasswordAction(newPassword);
            if (!result.success) throw new Error(result.error || 'Mise à jour impossible.');

            set({ isLoading: false });

          } catch (error: any) {
            console.error('Erreur lors de la mise à jour du mot de passe:', error);
            set({ 
              error: error.message || 'Erreur lors de la mise à jour du mot de passe', 
              isLoading: false 
            });
            throw error;
          }
        },

        refreshSession: async () => {
          try {
            const refreshed = await clientRefreshSessionAction();
            if (!refreshed.success || !refreshed.userId) throw new Error(refreshed.error || 'Session expirée.');
            const { data } = await supabase.auth.getSession();
            if (data.session?.user) {
              const profile = await getUserProfile(refreshed.userId);
              if (profile) {
                const user: User = {
                  id: profile.id,
                  email: profile.email ?? '',
                  role: (profile.role ?? 'owner') as 'owner' | 'employee',
                  pressingId: profile.pressing_id ?? profile.organization_id ?? '',
                  fullName: profile.full_name ?? 'Utilisateur',
                  permissions: (profile.permissions as any[]) || [],
                  createdAt: profile.created_at ?? new Date().toISOString(),
                  lastLogin: (profile as any).last_login ?? null,
                  isActive: profile.is_active ?? true,
                };

                const expiresAtVal = data.session.expires_at ? new Date(data.session.expires_at * 1000).toISOString() : '';
                const session: AuthSession = {
                  user,
                  accessToken: data.session.access_token,
                  refreshToken: data.session.refresh_token,
                  expiresAt: expiresAtVal,
                };

                set({ user, session });
              }
            }

          } catch (error: any) {
            console.error('Erreur lors du refresh de session:', error);
            // En cas d'erreur de refresh, on déconnecte l'utilisateur
            set({ user: null, session: null, preferences: null });
          }
        },

        initialize: async () => {
          try {
            set({ isLoading: true });

            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) throw error;

            if (session?.user) {
              const profile = await getUserProfile(session.user.id);
              if (profile) {
                const user: User = {
                  id: profile.id,
                  email: profile.email ?? '',
                  role: (profile.role ?? 'owner') as 'owner' | 'employee',
                  pressingId: profile.pressing_id ?? profile.organization_id ?? '',
                  fullName: profile.full_name ?? 'Utilisateur',
                  permissions: (profile.permissions as any[]) || [],
                  createdAt: profile.created_at ?? new Date().toISOString(),
                  lastLogin: (profile as any).last_login ?? null,
                  isActive: profile.is_active ?? true,
                };

                const authSession: AuthSession = {
                  user,
                  accessToken: session.access_token,
                  refreshToken: session.refresh_token,
                  expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : '',
                };

                set({ user, session: authSession });
                await get().loadUserPreferences();
              }
            }

            set({ isInitialized: true, isLoading: false });

          } catch (error: any) {
            console.error('Erreur lors de l\'initialisation:', error);
            set({ 
              isInitialized: true, 
              isLoading: false, 
              error: error.message 
            });
          }
        },

        updateUser: async (updates: Partial<User>) => {
          try {
            const { user } = get();
            if (!user) {
              throw new Error('Aucun utilisateur connecté');
            }

            set({ isLoading: true, error: null });

            const payload: any = {
              updated_at: new Date().toISOString()
            };
            if (updates.fullName !== undefined) payload.full_name = updates.fullName;
            if (updates.phone !== undefined) payload.phone = updates.phone;
            if (updates.role !== undefined) payload.role = updates.role;
            if (updates.permissions !== undefined) payload.permissions = updates.permissions;
            if (updates.isActive !== undefined) payload.is_active = updates.isActive;

            const { error } = await supabase
              .from('users')
              .update(payload)
              .eq('id', user.id);

            if (error) {
              throw error;
            }

            const updatedUser = { ...user, ...updates };
            set({ 
              user: updatedUser, 
              session: get().session ? { ...get().session!, user: updatedUser } : null,
              isLoading: false 
            });

          } catch (error: any) {
            console.error('Erreur lors de la mise à jour utilisateur:', error);
            set({ 
              error: error.message || 'Erreur lors de la mise à jour', 
              isLoading: false 
            });
            throw error;
          }
        },

        updatePreferences: async (preferences: Partial<UserPreferences>) => {
          try {
            const { user } = get();
            if (!user) {
              throw new Error('Aucun utilisateur connecté');
            }

            set({ isLoading: true, error: null });

            const currentPreferences = get().preferences || getDefaultPreferences();
            const updatedPreferences = { ...currentPreferences, ...preferences };

            const { error } = await supabase
              .from('user_preferences')
              .upsert({
                user_id: user.id,
                theme: updatedPreferences.theme,
                language: updatedPreferences.language,
                currency: updatedPreferences.currency,
                timezone: updatedPreferences.timezone,
                notifications: updatedPreferences.notifications,
                dashboard: updatedPreferences.dashboard,
                updated_at: new Date().toISOString()
              });

            if (error) {
              throw error;
            }

            set({ preferences: updatedPreferences, isLoading: false });

          } catch (error: any) {
            console.error('Erreur lors de la mise à jour des préférences:', error);
            set({ 
              error: error.message || 'Erreur lors de la mise à jour des préférences', 
              isLoading: false 
            });
            throw error;
          }
        },

        clearError: () => {
          set({ error: null });
        },

        // Méthode pour charger les préférences
        loadUserPreferences: async () => {
          try {
            const { user } = get();
            if (!user) return;

            const { data, error } = await supabase
              .from('user_preferences')
              .select('*')
              .eq('user_id', user.id)
              .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
              throw error;
            }

            const preferences: UserPreferences = data ? {
              theme: data.theme as 'light' | 'dark' | 'system',
              language: data.language as 'fr' | 'en',
              currency: data.currency,
              timezone: data.timezone,
              notifications: data.notifications as any,
              dashboard: data.dashboard as any,
            } : getDefaultPreferences();

            set({ preferences });

          } catch (error: any) {
            console.error('Erreur lors du chargement des préférences:', error);
            // En cas d'erreur, utiliser les préférences par défaut
            set({ preferences: getDefaultPreferences() });
          }
        },

      }),
      {
        name: 'zua-pressing-auth',
        partialize: (state) => ({
          user: state.user,
          session: state.session,
          preferences: state.preferences,
        }),
        version: 1,
      }
    )
  )
);

// Écouter les changements d'authentification Supabase
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange(async (event, session) => {
    const store = useAuthStore.getState();
    
    switch (event) {
      case 'SIGNED_IN':
        if (session?.user && !store.user) {
          await store.initialize();
        }
        break;
        
      case 'SIGNED_OUT':
        if (store.user) {
          useAuthStore.setState({ 
            user: null, 
            session: null, 
            preferences: null,
            error: null
          });
        }
        break;
        
      case 'TOKEN_REFRESHED':
        if (session?.user && store.user) {
          await store.refreshSession();
        }
        break;
    }
  });

  // Auto-refresh de la session toutes les heures
  setInterval(async () => {
    const store = useAuthStore.getState();
    if (store.session && store.user) {
      const expiresAt = new Date(store.session.expiresAt);
      const now = new Date();
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();
      
      // Refresh si expire dans moins d'une heure
      if (timeUntilExpiry < 60 * 60 * 1000) {
        await store.refreshSession();
      }
    }
  }, 30 * 60 * 1000); // Vérifier toutes les 30 minutes
}

// Sélecteurs pour optimiser les re-renders
export const useAuth = () => {
  return useAuthStore((state) => ({
    user: state.user,
    session: state.session,
    isLoading: state.isLoading,
    isInitialized: state.isInitialized,
    error: state.error,
  }));
};

export const useAuthActions = () => {
  return useAuthStore((state) => ({
    signIn: state.signIn,
    signUp: state.signUp,
    signOut: state.signOut,
    resetPassword: state.resetPassword,
    updatePassword: state.updatePassword,
    refreshSession: state.refreshSession,
    initialize: state.initialize,
    updateUser: state.updateUser,
    clearError: state.clearError,
  }));
};

export const useUserPreferences = () => {
  return useAuthStore((state) => ({
    preferences: state.preferences,
    updatePreferences: state.updatePreferences,
  }));
};

// Helper pour vérifier les permissions
export const useUserPermissions = () => {
  const user = useAuthStore((state) => state.user);
  
  return {
    canCreateInvoice: user?.permissions?.find(p => p.action === 'create_invoice')?.granted ?? false,
    canCancelInvoice: user?.permissions?.find(p => p.action === 'cancel_invoice')?.granted ?? false,
    canViewRevenue: user?.permissions?.find(p => p.action === 'view_revenue')?.granted ?? false,
    canManageUsers: user?.permissions?.find(p => p.action === 'manage_users')?.granted ?? false,
    canModifyPrices: user?.permissions?.find(p => p.action === 'modify_prices')?.granted ?? false,
    canExportData: user?.permissions?.find(p => p.action === 'export_data')?.granted ?? false,
    isOwner: user?.role === 'owner',
    isEmployee: user?.role === 'employee',
  };
};
