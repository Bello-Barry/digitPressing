'use client';

import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { PWAInstallProvider } from '@/components/pwa/pwa-install-provider';
import { OfflineSyncProvider } from '@/components/offline/offline-sync-provider';
import { useAuthStore } from '@/store/auth';

// Configuration React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (anciennement cacheTime)
      retry: (failureCount, error: any) => {
        // Ne pas retry les erreurs d'authentification
        if (error?.status === 401 || error?.status === 403) {
          return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: (failureCount, error: any) => {
        // Retry seulement les erreurs réseau
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});

// Provider pour l'initialisation de l'authentification
const AuthInitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialize = useAuthStore(state => state.initialize);
  const isInitialized = useAuthStore(state => state.isInitialized);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Afficher un écran de chargement pendant l'initialisation
  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Initialisation...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// Provider pour la gestion des erreurs globales
const ErrorBoundaryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    // Gestion des erreurs JavaScript non gérées
    const handleError = (event: ErrorEvent) => {
      console.error('Erreur non gérée:', event.error);
      
      // Envoyer à un service de monitoring en production
      if (process.env.NODE_ENV === 'production') {
        // Exemple: Sentry, LogRocket, etc.
        // sendErrorToMonitoring(event.error);
      }
    };

    // Gestion des promesses rejetées non gérées
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Promise rejetée non gérée:', event.reason);
      
      if (process.env.NODE_ENV === 'production') {
        // sendErrorToMonitoring(event.reason);
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return <>{children}</>;
};

// Provider pour la détection de la connectivité
const ConnectivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    const handleOnline = () => {
      console.log('Application en ligne');
      // Déclencher la synchronisation des données en attente
      window.dispatchEvent(new CustomEvent('app-online'));
    };

    const handleOffline = () => {
      console.log('Application hors ligne');
      window.dispatchEvent(new CustomEvent('app-offline'));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // État initial
    if (navigator.onLine) {
      handleOnline();
    } else {
      handleOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return <>{children}</>;
};

// Provider pour les raccourcis clavier globaux
const KeyboardShortcutsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignorer si on tape dans un input, textarea ou contenteditable
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return;
      }

      // Raccourcis globaux
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'n':
            // Ctrl+N : Nouvelle facture
            event.preventDefault();
            window.dispatchEvent(new CustomEvent('shortcut-new-invoice'));
            break;
          case 'f':
            // Ctrl+F : Recherche
            event.preventDefault();
            window.dispatchEvent(new CustomEvent('shortcut-search'));
            break;
          case 'p':
            // Ctrl+P : Imprimer
            event.preventDefault();
            window.dispatchEvent(new CustomEvent('shortcut-print'));
            break;
          case 'k':
            // Ctrl+K : Command palette
            event.preventDefault();
            window.dispatchEvent(new CustomEvent('shortcut-command-palette'));
            break;
        }
      }

      // Échap pour fermer les modales
      if (event.key === 'Escape') {
        window.dispatchEvent(new CustomEvent('shortcut-escape'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return <>{children}</>;
};

// Provider principal qui combine tous les providers
export const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ErrorBoundaryProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthInitProvider>
            <ConnectivityProvider>
              <KeyboardShortcutsProvider>
                <PWAInstallProvider>
                  <OfflineSyncProvider>
                    {children}
                  </OfflineSyncProvider>
                </PWAInstallProvider>
              </KeyboardShortcutsProvider>
            </ConnectivityProvider>
          </AuthInitProvider>
        </ThemeProvider>
        
        {/* React Query Devtools - seulement en développement */}
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools
            initialIsOpen={false}
            position="bottom-right"
            buttonPosition="bottom-right"
          />
        )}
      </QueryClientProvider>
    </ErrorBoundaryProvider>
  );
}; {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignorer si on tape dans un input, textarea ou contenteditable
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return;
      }

      // Raccourcis globaux
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'n':
            // Ctrl+N : Nouvelle facture
            event.preventDefault();
            window.dispatchEvent(new CustomEvent('shortcut-new-invoice'));
            break;
          case 'f':
            // Ctrl+F : Recherche
            event.preventDefault();
            window.dispatchEvent(new CustomEvent('shortcut-search'));
            break;
          case 'p':
            // Ctrl+P : Imprimer
            event.preventDefault();
            window.dispatchEvent(new CustomEvent('shortcut-print'));
            break;
          case 'k':
            // Ctrl+K : Command palette
            event.preventDefault();
            window.dispatchEvent(new CustomEvent('shortcut-command-palette'));
            break;
        }
      }

      // Échap pour fermer les modales
      if (event.key === 'Escape') {
        window.dispatchEvent(new CustomEvent('shortcut-escape'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return <>{children}</>;
};

// Provider principal qui combine tous les providers
export const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ErrorBoundaryProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthInitProvider>
            <ConnectivityProvider>
              <KeyboardShortcutsProvider>
                <PWAInstallProvider>
                  <OfflineSyncProvider>
                    {children}
                  </OfflineSyncProvider>
                </PWAInstallProvider>
              </KeyboardShortcutsProvider>
            </ConnectivityProvider>
          </AuthInitProvider>
        </ThemeProvider>
        
        {/* React Query Devtools - seulement en développement */}
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools
            initialIsOpen={false}
            position="bottom-right"
            buttonPosition="bottom-right"
          />
        )}
      </QueryClientProvider>
    </ErrorBoundaryProvider>
  );
};