const CACHE_NAME = 'vigorexiapp-v9';
const ASSETS = [
  './',
  './index.html',
  './rutina_movil.html',
  './reloj.html',
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
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request).catch(() => {
        if (e.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
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
  }
});

