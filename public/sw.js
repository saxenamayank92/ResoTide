const CACHE_NAME = 'tabletide-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/floor',
  '/manifest.json',
  '/icon.svg',
];

// 1. Install Phase - Cache Core Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[TableTide SW] Caching shell assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. Activate Phase - Clear Legacy Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[TableTide SW] Purging old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch Phase - Stale-While-Revalidate Cache Strategy
self.addEventListener('fetch', (event) => {
  // Only handle GET requests within the app's scope
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  if (!url.origin.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cache instantly, then update cache in the background
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {/* Ignore network errors on background updates */});
        return cachedResponse;
      }

      // If cache miss, fetch from network and add to cache
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // Offline Fallback for router navigations
          if (event.request.mode === 'navigate') {
            return caches.match('/floor') || caches.match('/');
          }
        });
    })
  );
});
