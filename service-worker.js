
// Service Worker with Build-Versioned Caching
// Generated build version will be replaced at build time
const BUILD_VERSION = '__BUILD_VERSION__';
const CACHE_NAME = `market4u-v${BUILD_VERSION}`;

// Static assets to cache on install
const STATIC_CACHE = [
  '/manifest.json',
];

// Install event - cache static assets only, do NOT skip waiting automatically.
// Waiting ensures that pages loaded with the old SW continue to use the old
// cached bundle until the user explicitly approves the update (via UpdateBanner).
// Automatic skipWaiting() can cause old HTML to reference new JS bundle hashes
// that no longer exist → 404 → black screen.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_CACHE);
    })
  );
});

// Activate event - clean old caches, then claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.startsWith('market4u-v') && cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event - network-first for HTML, cache-first for versioned assets
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  const url = new URL(event.request.url);

  // Skip API requests entirely - always go to network
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Network-first for navigation (HTML) requests.
  // Always fetch fresh index.html so the correct content-hashed JS/CSS bundle
  // URLs are served. Fall back to cache only if the network is unavailable.
  if (
    event.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname === '/index.html'
  ) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
        }
        return response;
      }).catch(() => {
        return caches.match('/index.html').then(
          (cached) => cached || new Response('Offline', { status: 503 })
        );
      })
    );
    return;
  }

  // Cache-first strategy for versioned static assets (JS, CSS, images, fonts).
  // These files have content-hash names so they are safe to cache indefinitely.
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ttf|eot|ico)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(event.request).then((response) => {
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

  // Network-first for everything else (version.json, manifest.json, etc.)
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// Message handler: skip waiting when user approves the update via UpdateBanner
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
