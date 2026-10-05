'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import { WifiOff, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OfflineSyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingActions: number;
  syncData: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextType | undefined>(undefined);

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
  const isMounted = useRef(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      if (isMounted.current) {
        toast.success('Connexion rétablie', {
          description: 'Synchronisation des données en cours...',
        });
      }
      syncData();
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (isMounted.current) {
        toast.warning('Hors ligne', {
          description: 'Les modifications seront synchronisées à la reconnexion.',
        });
      }
    };

    isMounted.current = true;

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

  const syncData = async () => {
    if (!user || !isOnline || isSyncing) return;

    setIsSyncing(true);

    try {
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

      for (const item of queueItems) {
        try {
          await processQueueItem(item);
          await supabase
            .from('offline_queue')
            .delete()
            .eq('id', item.id);

          successCount++;
        } catch (error) {
          console.error(`Erreur lors du traitement de l'action ${item.id}:`, error);
          errorCount++;

          await supabase
            .from('offline_queue')
            .update({
              retry_count: item.retry_count + 1,
              last_error: error instanceof Error ? error.message : String(error),
            })
            .eq('id', item.id);

          if (item.retry_count >= 3) {
            await supabase
              .from('offline_queue')
              .delete()
              .eq('id', item.id);
          }
        }
      }

      await loadPendingActionsCount();

      if (successCount > 0) {
        toast.success(`${successCount} action(s) synchronisée(s)`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} action(s) ont échoué`);
      }

    } catch (error) {
      console.error('Erreur lors de la synchronisation:', error);
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
      
      {/* Indicateur d'état hors ligne si déconnecté */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-50 bg-amber-600 text-slate-950 px-4 py-1.5 text-center text-xs font-bold safe-top shadow-md"
          >
            <div className="flex items-center justify-center gap-2">
              <WifiOff className="h-3.5 w-3.5" />
              Mode hors ligne
              {pendingActions > 0 && (
                <span className="ml-2 rounded-full bg-slate-950/20 px-2 py-0.5 text-[10px]">
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
            className="fixed bottom-4 right-4 z-50 bg-slate-900 text-amber-400 border border-slate-800 rounded-xl px-3.5 py-2 shadow-xl text-xs font-semibold"
          >
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
              Synchronisation...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </OfflineSyncContext.Provider>
  );
};
