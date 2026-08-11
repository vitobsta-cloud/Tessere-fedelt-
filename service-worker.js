const CACHE_NAME = 'tessere-fedelta-v27';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './logo.svg'
];

// STRATEGIA "OFFLINE-FIRST": la pagina principale viene sempre mostrata
// SUBITO dalla cache, se esiste — apertura istantanea in ogni condizione,
// senza aspettare la rete nemmeno un istante (fondamentale alla cassa).
// Il controllo di un eventuale aggiornamento avviene DOPO, non insieme:
// si aspettano 2,5 secondi dall'apertura prima di provare la rete in
// background, così l'avvio resta sempre e solo offline-first e non c'è
// mai un doppio tentativo (cache + rete) nello stesso istante.
// Solo se la cache è vuota (primissima apertura in assoluto, prima ancora
// che il service worker abbia fatto in tempo a salvare nulla) si aspetta la
// rete subito, perché non c'è altro da mostrare.
const BACKGROUND_UPDATE_DELAY_MS = 2500;

function rispondiOfflineFirst(request) {
  return caches.match(request).then(cached => {
    if (cached) {
      // Aggiornamento in background, ma solo DOPO 2,5 secondi: l'apertura
      // dell'app resta puramente offline-first, senza alcun tentativo di
      // rete nello stesso momento della risposta.
      setTimeout(() => {
        fetch(request).then(response => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
        }).catch(() => {});
      }, BACKGROUND_UPDATE_DELAY_MS);
      return cached;
    }
    // Niente in cache: non c'è altro da mostrare, va per forza tentata la rete.
    return fetch(request).then(response => {
      const responseToCache = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
      return response;
    }).catch(() => caches.match('./index.html'));
  });
}

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
  if (event.request.mode === 'navigate') {
    event.respondWith(rispondiOfflineFirst(event.request));
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
