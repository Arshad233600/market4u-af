
// Service Worker with Build-Versioned Caching
// Generated build version will be replaced at build time
const BUILD_VERSION = '__BUILD_VERSION__';
const CACHE_NAME = `market4u-v${BUILD_VERSION}`;

// Static assets to cache (excluding index.html for version safety)
const STATIC_CACHE = [
  '/manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing version ${BUILD_VERSION}`);
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_CACHE);
    }).then(() => {
      // Skip waiting to activate immediately
      return self.skipWaiting();
    })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating version ${BUILD_VERSION}`);
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old caches with different versions
          if (cacheName.startsWith('market4u-v') && cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      );
    }).then(() => {
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - stale-while-revalidate for HTML, cache-first for assets
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  const url = new URL(event.request.url);

  // Stale-while-revalidate for navigation (HTML) requests:
  // Serve cached version immediately while fetching a fresh copy in background.
  // This is the key strategy for low-bandwidth environments – the page appears instantly.
  if (
    event.request.mode === 'navigate' || 
    url.pathname === '/' || 
    url.pathname === '/index.html'
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match('/index.html').then((cached) => {
          const networkFetch = fetch(event.request).then((response) => {
            if (response.status === 200) {
              cache.put('/index.html', response.clone());
            }
            return response;
          }).catch(() => cached || new Response('Offline', { status: 503 }));

          // Return cached immediately if available; otherwise wait for network
          return cached || networkFetch;
        });
      })
    );
    return;
  }

  // Cache-first strategy for static assets (JS, CSS, images, fonts)
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ttf|eot|ico)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          return cached;
        }
        
        return fetch(event.request).then((response) => {
          // Cache successful responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first for API calls and other requests
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// Message handler for skip waiting from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
