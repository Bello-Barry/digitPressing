// =============================================================================
// STORE SETTINGS - Digit PRESSING
// =============================================================================

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import type { Pressing, PressingSettings, LoadingState } from '@/types';
import { useAuthStore } from './auth';

interface SettingsState extends LoadingState {
  // État des paramètres
  settings: PressingSettings | null;
  lastUpdated: string | undefined;

  // Actions
  fetchSettings: () => Promise<void>;
  updateSettings: (updates: Partial<PressingSettings>) => Promise<void>;

  // Utilitaires
  getSetting: <T extends keyof PressingSettings>(key: T) => PressingSettings[T] | undefined;
  clearError: () => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  subscribeWithSelector((set, get) => ({
    // État initial
    settings: null,
    isLoading: false,
    error: null,
    lastUpdated: undefined,

    // Actions
    fetchSettings: async () => {
      try {
        set({ isLoading: true, error: null });
        const user = useAuthStore.getState().user;

        if (!user) {
          throw new Error('Utilisateur non connecté');
        }

        const { data, error } = await supabase
          .from('pressings')
          .select('settings')
          .eq('id', user.pressingId)
          .single();

        if (error) {
          throw error;
        }

        const settings = data?.settings as PressingSettings;

        set({
          settings,
          isLoading: false,
          lastUpdated: new Date().toISOString(),
        });

      } catch (error: any) {
        console.error('Erreur lors du chargement des paramètres:', error);
        set({
          error: error.message || 'Erreur lors du chargement des paramètres',
          isLoading: false,
        });
      }
    },

    updateSettings: async (updates: Partial<PressingSettings>) => {
      try {
        set({ isLoading: true, error: null });
        const user = useAuthStore.getState().user;

        if (!user) {
          throw new Error('Utilisateur non connecté');
        }

        // On ne met à jour que les champs modifiés dans l'objet JSON
        const currentSettings = get().settings;
        const newSettings = {
          ...currentSettings,
          ...updates,
        };

        const { error } = await supabase
          .from('pressings')
          .update({
            settings: newSettings,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.pressingId);

        if (error) {
          throw error;
        }

        set({
          settings: newSettings,
          isLoading: false,
        });

      } catch (error: any) {
        console.error('Erreur lors de la mise à jour des paramètres:', error);
        set({
          error: error.message || 'Erreur lors de la mise à jour des paramètres',
          isLoading: false,
        });
        throw error;
      }
    },

    getSetting: (key) => {
      const { settings } = get();
      return settings ? settings[key] : undefined;
    },

    clearError: () => {
      set({ error: null });
    },

    reset: () => {
      set({
        settings: null,
        isLoading: false,
        error: null,
        lastUpdated: undefined,
      });
    },
  }))
);

// Sélecteurs optimisés - EXPORTS CORRECTS
export const useSettings = () => {
  return useSettingsStore(state => ({
    settings: state.settings,
    isLoading: state.isLoading,
    error: state.error,
    lastUpdated: state.lastUpdated,
  }));
};

export const useSettingsActions = () => {
  return useSettingsStore(state => ({
    fetchSettings: state.fetchSettings,
    updateSettings: state.updateSettings,
    clearError: state.clearError,
  }));
};

// Hook pour récupérer les informations du pressing (compatibility) - EXPORT CORRIGÉ
export const usePressing = () => {
  return useSettingsStore(state => ({
    pressing: state.settings,
    isLoading: state.isLoading,
    error: state.error,
  }));
};

export const useSettingHelper = () => {
  return useSettingsStore(state => ({
    getSetting: state.getSetting,
  }));
};

// Écouter les changements en temps réel
if (typeof window !== 'undefined') {
  const user = useAuthStore.getState().user;

  if (user) {
    supabase
      .channel(`pressing_settings_${user.pressingId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pressings',
          filter: `id=eq.${user.pressingId}`,
        },
        (payload) => {
          const store = useSettingsStore.getState();
          const updatedPressing = payload.new as any;
          if (updatedPressing.settings) {
            useSettingsStore.setState({
              settings: updatedPressing.settings,
              lastUpdated: new Date().toISOString(),
            });
          }
        }
      )
      .subscribe();
  }
}