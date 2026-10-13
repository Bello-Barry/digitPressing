// Service Worker LB Pressing - Ultra optimisé et sécurisé
// Règle stricte : Ne stoque AUCUNE donnée privée ou page HTML métier en cache !

const CACHE_VERSION = 'lb-v1.0.0';
const STATIC_CACHE_NAME = `static-${CACHE_VERSION}`;
const IMAGE_CACHE_NAME = `images-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  '/offline',
  '/brand/logo-mark.png',
  '/brand/logo-horizontal-light.png',
  '/brand/logo-horizontal-dark.png',
  '/brand/og-image.png',
  '/icons/favicon.ico',
  '/icons/favicon-32.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];

// Installation & Pre-cache
self.addEventListener('install', (event: any) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => (self as any).skipWaiting())
  );
});

// Activation & Nettoyage des anciens caches
self.addEventListener('activate', (event: any) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE_NAME && key !== IMAGE_CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => (self as any).clients.claim())
  );
});

// Messages du client (ex: SKIP_WAITING ou CLEAR_DYNAMIC_CACHE)
self.addEventListener('message', (event: any) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    (self as any).skipWaiting();
  } else if (event.data && event.data.type === 'CLEAR_DYNAMIC_CACHE') {
    caches.delete(IMAGE_CACHE_NAME);
  }
});

// Interception des requêtes
self.addEventListener('fetch', (event: any) => {
  const request = event.request;
  const url = new URL(request.url);

  // Seules les requêtes GET de même origine sont gérées
  if (request.method !== 'GET' || url.origin !== location.origin) {
    return;
  }

  // EXCLUSIONS STRICTES
  const isServerAction = request.headers.has('Next-Action');
  const isRSC = request.headers.has('RSC') || url.searchParams.has('_rsc');
  const isApi = url.pathname.startsWith('/api/');
  const isNextData = url.pathname.startsWith('/_next/data');
  const isInvoice = url.pathname.startsWith('/f/');
  const isSupabase = url.hostname.includes('supabase');

  if (isServerAction || isRSC || isApi || isNextData || isInvoice || isSupabase) {
    return;
  }

  // 1. NAVIGATIONS : Network-first avec timeout de 4s, fallback sur /offline
  if (request.mode === 'navigate') {
    event.respondWith(
      new Promise((resolve) => {
        let timerId: any = null;

        const timeoutPromise = new Promise((_, reject) => {
          timerId = setTimeout(() => {
            reject(new Error('Network timeout'));
          }, 4000);
        });

        const fetchPromise = fetch(request).then((response) => {
          clearTimeout(timerId);
          return response;
        });

        Promise.race([fetchPromise, timeoutPromise])
          .then((response: any) => {
            if (response && response.ok) {
              resolve(response);
            } else {
              caches.match('/offline').then((offlineRes) => resolve(offlineRes!));
            }
          })
          .catch(() => {
            clearTimeout(timerId);
            caches.match('/offline').then((offlineRes) => resolve(offlineRes!));
          });
      })
    );
    return;
  }

  // 2. ASSETS STATIQUES FICHIERS (/icons/*, /brand/*, /_next/static/*) : Cache-first
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/brand/') ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // 3. IMAGES WEBP/AVIF /_next/image : Stale-while-revalidate (max 60 entries)
  if (url.pathname.startsWith('/_next/image')) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request).then(async (response) => {
          if (response.status === 200) {
            await cache.put(request, response.clone());
            // Limiter la taille du cache à 60 entrées
            const keys = await cache.keys();
            if (keys.length > 60) {
              await cache.delete(keys[0]);
            }
          }
          return response;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }
});
