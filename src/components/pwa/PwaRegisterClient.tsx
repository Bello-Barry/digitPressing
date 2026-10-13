'use client';

import React, { useEffect } from 'react';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';

export function PwaRegisterClient() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('Service Worker enregistré avec succès:', registration.scope);

            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (
                    newWorker.state === 'installed' &&
                    navigator.serviceWorker.controller
                  ) {
                    showUpdateBanner(newWorker);
                  }
                });
              }
            });
          })
          .catch((error) => {
            console.error('Échec de l\'enregistrement du Service Worker:', error);
          });
      });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, []);

  const showUpdateBanner = (worker: ServiceWorker) => {
    const banner = document.createElement('div');
    banner.className =
      'fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 p-4 rounded-2xl bg-amber-500 text-slate-950 shadow-2xl flex items-center justify-between font-sans text-xs font-bold animate-slide-in-top';
    banner.innerHTML = `
      <span>Nouvelle version disponible !</span>
      <button id="pwa-update-btn" class="px-3 py-1 bg-slate-950 text-amber-400 rounded-xl hover:bg-slate-900 transition">
        Actualiser
      </button>
    `;

    document.body.appendChild(banner);

    const btn = document.getElementById('pwa-update-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        worker.postMessage({ type: 'SKIP_WAITING' });
        banner.remove();
      });
    }
  };

  return <InstallPrompt />;
}
