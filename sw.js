const CACHE_NAME = 'kindle-novel-reader-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './novels.json',
  './qr-code.png'
];

// Install Event: Cache Core Assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching core assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Serve from cache, update in background (Stale-While-Revalidate)
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  // We intercept local requests and Google Fonts requests for offline styling
  const isGoogleFont = requestUrl.hostname.includes('fonts.googleapis.com') || requestUrl.hostname.includes('fonts.gstatic.com');
  
  if (requestUrl.origin === self.location.origin || isGoogleFont) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          const fetchPromise = fetch(event.request).then(networkResponse => {
            if (networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(err => {
            // If offline and there's no cache, return a fallback if applicable
            console.log('[Service Worker] Fetch failed; returning cache if available', err);
            return cachedResponse;
          });

          // Serve cache immediately if we have it, otherwise wait for the network response
          return cachedResponse || fetchPromise;
        });
      })
    );
  }
});
