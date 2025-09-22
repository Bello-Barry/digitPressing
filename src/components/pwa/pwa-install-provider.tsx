'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PWAInstallContextType {
  canInstall: boolean;
  isInstalled: boolean;
  showPrompt: () => void;
  hidePrompt: () => void;
}

const _PWAInstallContext = createContext<PWAInstallContextType | undefined>(undefined);

export const _usePWAInstall = () => {
  const context = useContext(PWAInstallContext);
  if (!context) {
    throw new Error('usePWAInstall must be used within a PWAInstallProvider');
  }
  return context;
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [isPrompting, setIsPrompting] = useState(false);

  useEffect(() => {
    // Vérifier si l'app est déjà installée
    const _checkInstallation = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                           (window.navigator as any).standalone === true ||
                           document.referrer.includes('android-app://');
      
      setIsInstalled(isStandalone);
      
      // Si déjà installée, ne pas montrer le prompt
      if (isStandalone) {
        setCanInstall(false);
        setShowBanner(false);
        return;
      }
    };

    checkInstallation();

    // Écouter l'événement beforeinstallprompt
    const _handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const _installEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(installEvent);
      setCanInstall(true);
      
      // Montrer le banner après un délai (sauf si déjà refusé récemment)
      const _lastDismissed = localStorage.getItem('pwa-install-dismissed');
      const _dismissedTime = lastDismissed ? new Date(lastDismissed) : null;
      const _now = new Date();
      
      // Montrer le banner si jamais refusé ou si refusé il y a plus d'une semaine
      if (!dismissedTime || (now.getTime() - dismissedTime.getTime()) > 7 * 24 * 60 * 60 * 1000) {
        setTimeout(() => setShowBanner(true), 3000); // Attendre 3 secondes après le chargement
      }
    };

    // Écouter l'installation de l'app
    const _handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      setShowBanner(false);
      setDeferredPrompt(null);
      
      // Supprimer le timestamp de refus puisque l'app est installée
      localStorage.removeItem('pwa-install-dismissed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const _showPrompt = async () => {
    if (!deferredPrompt || isPrompting) return;

    setIsPrompting(true);
    setShowBanner(false);

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
        // Marquer comme refusé pour ne pas redemander tout de suite
        localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
      }
    } catch (error) {
      console.error('Error showing install prompt:', error);
    } finally {
      setDeferredPrompt(null);
      setCanInstall(false);
      setIsPrompting(false);
    }
  };

  const _hidePrompt = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
  };

  const _value = {
    canInstall,
    isInstalled,
    showPrompt,
    hidePrompt,
  };

  return (
    <PWAInstallContext.Provider value={value}>
      {children}
      
      {/* Banner d'installation PWA */}
      <AnimatePresence>
        {showBanner && canInstall && !isInstalled && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm safe-bottom"
          >
            <div className="glass-effect rounded-lg border bg-card p-4 shadow-soft">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Smartphone className="h-5 w-5 text-primary" />
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">
                    Installer ZUA Pressing
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Installez l'application pour un accès rapide et une meilleure expérience
                  </p>
                  
                  <div className="flex items-center gap-2 mt-3">
                    <Button 
                      size="sm" 
                      onClick={showPrompt}
                      disabled={isPrompting}
                      leftIcon={<Download className="h-3 w-3" />}
                    >
                      {isPrompting ? 'Installation...' : 'Installer'}
                    </Button>
                    
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={hidePrompt}
                      className="text-xs"
                    >
                      Plus tard
                    </Button>
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={hidePrompt}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Indicateur d'état PWA dans la barre de statut */}
      {isInstalled && (
        <div className="fixed top-4 right-4 z-40">
          <div className="flex items-center gap-2 rounded-full bg-success/10 px-2 py-1 text-xs font-medium text-success">
            <div className="h-1.5 w-1.5 rounded-full bg-success" />
            Application installée
          </div>
        </div>
      )}
    </PWAInstallContext.Provider>
  );
};