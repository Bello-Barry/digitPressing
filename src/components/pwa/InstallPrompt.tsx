'use client';

import React, { useEffect, useState } from 'react';
import { Download, X, Smartphone, Share } from 'lucide-react';
import { BRAND_CONFIG } from '@/config/brand';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [installedStatus, setInstalledStatus] = useState(false);

  useEffect(() => {
    // 1. Vérifier si l'application est en mode standalone
    const checkStandalone = () => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(standalone);
    };

    checkStandalone();

    // 2. Détecter iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // 3. Écouter beforeinstallprompt (Android / Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const installEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(installEvent);

      // Vérifier le délai de masquage dans localStorage (14 jours)
      try {
        const lastDismissed = localStorage.getItem('pwa-install-dismissed');
        if (lastDismissed) {
          const dismissedDate = new Date(lastDismissed).getTime();
          const now = new Date().getTime();
          const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
          if (now - dismissedDate < fourteenDaysMs) {
            return;
          }
        }
      } catch (err) {
        console.error('Erreur lecture localStorage install prompt:', err);
      }

      setShowBanner(true);
    };

    // 4. Écouter appinstalled
    const handleAppInstalled = () => {
      setShowBanner(false);
      setInstalledStatus(true);
      setDeferredPrompt(null);
      setTimeout(() => setInstalledStatus(false), 5000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosModal(true);
      return;
    }

    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
      } else {
        dismissBanner();
      }
    } catch (err) {
      console.error('Erreur lors de l\'installation PWA:', err);
    } finally {
      setDeferredPrompt(null);
    }
  };

  const dismissBanner = () => {
    setShowBanner(false);
    try {
      localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
    } catch (err) {
      console.error('Erreur écriture localStorage install prompt:', err);
    }
  };

  // Ne rien afficher si standalone
  if (isStandalone) {
    return null;
  }

  return (
    <>
      {/* Statut d'installation réussie */}
      {installedStatus && (
        <div className="fixed top-4 right-4 z-50 p-3 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-xl animate-fade-in flex items-center space-x-2">
          <span>Application installée</span>
        </div>
      )}

      {/* Bannière discrète sur le dashboard */}
      {showBanner && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-40 p-4 rounded-2xl bg-slate-900/95 border border-amber-500/30 text-white shadow-2xl backdrop-blur-md safe-bottom">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-white">
                  Installer l'application {BRAND_CONFIG.shortName}
                </p>
                <p className="text-[11px] text-slate-400">
                  Accédez plus rapidement à la caisse et à la gestion en mode plein écran.
                </p>
                <div className="pt-2 flex items-center space-x-2">
                  <button
                    onClick={handleInstallClick}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition flex items-center space-x-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Installer</span>
                  </button>
                  <button
                    onClick={dismissBanner}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
                  >
                    Plus tard
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={dismissBanner}
              className="p-1 text-slate-500 hover:text-slate-300 transition shrink-0"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal d'instructions iOS */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4 text-center text-white">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
              <Share className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold">Installer sur iPhone / iPad</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Pour installer {BRAND_CONFIG.shortName} sur votre écran d'accueil :
            </p>
            <ol className="text-xs text-slate-400 text-left space-y-2 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
              <li className="flex items-center space-x-2">
                <span className="font-bold text-amber-400">1.</span>
                <span>Appuyez sur le bouton <strong className="text-white">Partager</strong> (<Share className="w-3.5 h-3.5 inline text-amber-400" />) dans Safari.</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="font-bold text-amber-400">2.</span>
                <span>Faites défiler vers le bas et sélectionnez <strong className="text-white">Sur l'écran d'accueil</strong>.</span>
              </li>
            </ol>
            <button
              onClick={() => setShowIosModal(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl transition"
            >
              J'ai compris
            </button>
          </div>
        </div>
      )}
    </>
  );
}
