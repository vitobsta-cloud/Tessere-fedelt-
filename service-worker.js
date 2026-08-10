const CACHE_NAME = 'tessere-fedelta-v18';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './logo.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache).catch(err => {
        console.warn('Cache addAll error:', err);
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }
  // Per la pagina principale (navigazione): prova SEMPRE prima la rete, per avere
  // sempre l'ultima versione quando c'è connessione. La cache serve solo come riserva
  // quando sei offline. Questo evita di restare bloccati su una versione vecchia
  // anche se il service worker non si è ancora aggiornato.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(response => {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
        return response;
      }).catch(() => caches.match(event.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  // Per gli altri file (icone, manifest...): cache-first, con aggiornamento in background
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        return response;
      }
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return response;
      }).catch(() => {
        return caches.match(event.request);
      });
    })
  );
});
