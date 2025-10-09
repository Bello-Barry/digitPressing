'use client';

import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { PWAInstallProvider } from '@/components/pwa/pwa-install-provider';
import { OfflineSyncProvider } from '@/components/offline/offline-sync-provider';
import { useAuthStore } from '@/store/auth';

// ✅ Création du client React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: (failureCount, error: any) => {
        if (error?.status === 401 || error?.status === 403) return false;
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: (failureCount, error: any) => {
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

// ✅ Initialisation Auth
const AuthInitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialize = useAuthStore(state => state.initialize);
  const isInitialized = useAuthStore(state => state.isInitialized);

  useEffect(() => {
    initialize();
  }, [initialize]);

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

// ✅ Gestion des erreurs globales
const ErrorBoundaryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Erreur non gérée:', event.error);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Promise rejetée non gérée:', event.reason);
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

// ✅ Détection connectivité
const ConnectivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    const handleOnline = () => window.dispatchEvent(new CustomEvent('app-online'));
    const handleOffline = () => window.dispatchEvent(new CustomEvent('app-offline'));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    navigator.onLine ? handleOnline() : handleOffline();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return <>{children}</>;
};

// ✅ Raccourcis clavier globaux
const KeyboardShortcutsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.contentEditable === 'true') return;

      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'n': event.preventDefault(); window.dispatchEvent(new CustomEvent('shortcut-new-invoice')); break;
          case 'f': event.preventDefault(); window.dispatchEvent(new CustomEvent('shortcut-search')); break;
          case 'p': event.preventDefault(); window.dispatchEvent(new CustomEvent('shortcut-print')); break;
          case 'k': event.preventDefault(); window.dispatchEvent(new CustomEvent('shortcut-command-palette')); break;
        }
      }

      if (event.key === 'Escape') {
        window.dispatchEvent(new CustomEvent('shortcut-escape'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return <>{children}</>;
};

// ✅ Provider principal
export const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ErrorBoundaryProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthInitProvider>
            <ConnectivityProvider>
              <KeyboardShortcutsProvider>
                <PWAInstallProvider>
                  <OfflineSyncProvider>{children}</OfflineSyncProvider>
                </PWAInstallProvider>
              </KeyboardShortcutsProvider>
            </ConnectivityProvider>
          </AuthInitProvider>
        </ThemeProvider>

        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools initialIsOpen={false} position="bottomRight" />
        )}
      </QueryClientProvider>
    </ErrorBoundaryProvider>
  );
};
