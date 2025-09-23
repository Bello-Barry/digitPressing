'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OfflineSyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingActions: number;
  syncData: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextType | undefined>(undefined);

// EXPORT CORRIGÉ
export const useOfflineSync = () => {
  const context = useContext(OfflineSyncContext);
  if (!context) {
    throw new Error('useOfflineSync must be used within an OfflineSyncProvider');
  }
  return context;
};

interface OfflineQueueItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  endpoint: string;
  data: any;
  timestamp: string;
  retryCount: number;
}

export const OfflineSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingActions, setPendingActions] = useState(0);
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    // Initialiser l'état de connexion
    setIsOnline(navigator.onLine);

    // Écouter les changements de connectivité
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connexion rétablie', {
        description: 'Synchronisation des données en cours...',
      });
      syncData();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Hors ligne', {
        description: 'Les modifications seront synchronisées à la reconnexion.',
      });
    };

    const handleAppOnline = () => handleOnline();
    const handleAppOffline = () => handleOffline();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('app-online', handleAppOnline);
    window.addEventListener('app-offline', handleAppOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('app-online', handleAppOnline);
      window.removeEventListener('app-offline', handleAppOffline);
    };
  }, []);

  // Charger le nombre d'actions en attente
  useEffect(() => {
    if (user) {
      loadPendingActionsCount();
    }
  }, [user]);

  const loadPendingActionsCount = async () => {
    if (!user) return;

    try {
      const { count, error } = await supabase
        .from('offline_queue')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (error) throw error;
      setPendingActions(count || 0);
    } catch (error) {
      console.error('Erreur lors du chargement des actions en attente:', error);
    }
  };

  const addToOfflineQueue = async (
    type: 'create' | 'update' | 'delete',
    endpoint: string,
    data: any
  ) => {
    if (!user) return;

    try {
      const queueItem: Omit<OfflineQueueItem, 'id'> = {
        type,
        endpoint,
        data,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };

      const { error } = await supabase
        .from('offline_queue')
        .insert({
          user_id: user.id,
          type: queueItem.type,
          endpoint: queueItem.endpoint,
          data: queueItem.data,
          timestamp: queueItem.timestamp,
          retry_count: queueItem.retryCount,
        });

      if (error) throw error;

      setPendingActions(prev => prev + 1);

      toast.info('Action mise en file d\'attente', {
        description: 'Sera synchronisée à la reconnexion.',
      });
    } catch (error) {
      console.error('Erreur lors de l\'ajout à la queue offline:', error);
      toast.error('Erreur de sauvegarde hors ligne');
    }
  };

  const syncData = async () => {
    if (!user || !isOnline || isSyncing) return;

    setIsSyncing(true);

    try {
      // Récupérer toutes les actions en attente
      const { data: queueItems, error } = await supabase
        .from('offline_queue')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: true });

      if (error) throw error;

      if (!queueItems || queueItems.length === 0) {
        setIsSyncing(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      // Traiter chaque action
      for (const item of queueItems) {
        try {
          await processQueueItem(item);
          
          // Supprimer l'item de la queue après succès
          await supabase
            .from('offline_queue')
            .delete()
            .eq('id', item.id);

          successCount++;
        } catch (error) {
          console.error(`Erreur lors du traitement de l'action ${item.id}:`, error);
          errorCount++;

          // Incrémenter le compteur de retry
          await supabase
            .from('offline_queue')
            .update({
              retry_count: item.retry_count + 1,
              last_error: error instanceof Error ? error.message : String(error),
            })
            .eq('id', item.id);

          // Supprimer l'action si trop de tentatives échouées
          if (item.retry_count >= 3) {
            await supabase
              .from('offline_queue')
              .delete()
              .eq('id', item.id);
          }
        }
      }

      // Mettre à jour le compteur d'actions en attente
      await loadPendingActionsCount();

      // Afficher le résultat de la synchronisation
      if (successCount > 0) {
        toast.success(`${successCount} action(s) synchronisée(s)`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} action(s) ont échoué`);
      }

    } catch (error) {
      console.error('Erreur lors de la synchronisation:', error);
      toast.error('Erreur de synchronisation');
    } finally {
      setIsSyncing(false);
    }
  };

  const processQueueItem = async (item: any) => {
    const { type, endpoint, data } = item;

    switch (type) {
      case 'create':
        return await supabase.from(endpoint).insert(data);
      
      case 'update':
        const { id, ...updateData } = data;
        return await supabase.from(endpoint).update(updateData).eq('id', id);
      
      case 'delete':
        return await supabase.from(endpoint).delete().eq('id', data.id);
      
      default:
        throw new Error(`Type d'action non supporté: ${type}`);
    }
  };

  const value = {
    isOnline,
    isSyncing,
    pendingActions,
    syncData,
  };

  return (
    <OfflineSyncContext.Provider value={value}>
      {children}
      
      {/* Indicateur d'état de connexion */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-50 bg-warning text-warning-foreground px-4 py-2 text-center text-sm font-medium safe-top"
          >
            <div className="flex items-center justify-center gap-2">
              <WifiOff className="h-4 w-4" />
              Mode hors ligne
              {pendingActions > 0 && (
                <span className="ml-2 rounded-full bg-warning-foreground/20 px-2 py-0.5 text-xs">
                  {pendingActions} action{pendingActions > 1 ? 's' : ''} en attente
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Indicateur de synchronisation */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed bottom-4 right-4 z-50 bg-primary text-primary-foreground rounded-lg px-4 py-2 shadow-lg"
          >
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Synchronisation...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Indicateur de connexion rétablie */}
      <AnimatePresence>
        {isOnline && pendingActions === 0 && (
          <motion.div
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            className="fixed top-4 right-4 z-40 bg-success text-success-foreground rounded-lg px-3 py-2 shadow-lg"
          >
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              <span className="text-sm font-medium">En ligne</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </OfflineSyncContext.Provider>
  );

  // Exposer la fonction addToOfflineQueue globalement
  if (typeof window !== 'undefined') {
    (window as any).addToOfflineQueue = addToOfflineQueue;
  }
};