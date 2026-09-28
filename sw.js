const CACHE_NAME = 'vigorexiapp-v17';
const ASSETS = [
  './',
  './index.html',
  './rutina_movil.html',
  './reloj.html',
  './qr_zepp.png',
  './watch_bridge.js',
  './icon-round-192.png',
  './icon-round-512.png',
  './badge-round.png',
  './manifest.json',
  './manifest.json?v=2',
  './icon-192.png',
  './icon-192.png?v=2',
  './icon-512.png',
  './icon-512.png?v=2',
  './favicon.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purgando caché obsoleta:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const isNav = e.request.mode === 'navigate' || e.request.destination === 'document' || url.pathname.endsWith('.html') || url.pathname.endsWith('/gym/') || url.pathname.endsWith('/gym');

  // Network-first para páginas HTML para que cualquier actualización en GitHub se aplique de inmediato
  if (isNav) {
    e.respondWith(
      fetch(e.request).then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return networkRes;
      }).catch(() => {
        return caches.match(e.request).then((res) => res || caches.match('./index.html'));
      })
    );
    return;
  }

  // Stale-while-revalidate / Cache-first con actualización en segundo plano para recursos estáticos
  e.respondWith(
    caches.match(e.request).then((cachedRes) => {
      const fetchPromise = fetch(e.request).then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return networkRes;
      }).catch(() => null);

      return cachedRes || fetchPromise;
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('./index.html');
    })
  );
});

let bgTimerId = null;
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'START_REST_TIMER') {
    if (bgTimerId) clearTimeout(bgTimerId);
    const delay = Math.max(0, event.data.endTime - Date.now());
    bgTimerId = setTimeout(() => {
      self.registration.showNotification('¡Descanso Terminado! 🔔', {
        body: 'Hora de la siguiente serie en Vigorexiapp 💪',
        icon: './icon-round-192.png',
        badge: './badge-round.png',
        vibrate: [200, 100, 200, 100, 300],
        tag: 'rest-finish',
        renotify: true
      });
      bgTimerId = null;
    }, delay);
  } else if (event.data && event.data.type === 'CANCEL_REST_TIMER') {
    if (bgTimerId) {
      clearTimeout(bgTimerId);
      bgTimerId = null;
    }
  } else if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
