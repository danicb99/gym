const CACHE_NAME = 'vigorexiapp-v22';
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
  './badge.png',
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

let bgTimerId = null;
let currentRestState = null;

function formatRestClock(totalSeconds) {
  const m = Math.floor(Math.max(0, totalSeconds) / 60);
  const s = Math.max(0, totalSeconds) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function showLiveRestNotification(state) {
  if (!state || !state.endTime) return Promise.resolve();
  const remaining = Math.max(0, Math.round((state.endTime - Date.now()) / 1000));
  const timeText = formatRestClock(remaining);
  const exercise = state.exerciseName || 'Siguiente serie';
  const subtitle = state.setInfo ? `${exercise} (${state.setInfo})` : exercise;

  return self.registration.showNotification(`⏳ Descanso: ${timeText}`, {
    body: `Siguiente: ${subtitle} • Vigorexiapp 💪`,
    icon: './icon-192.png',
    badge: './badge-round.png',
    tag: 'vigorexiapp-rest-live',
    ongoing: true,
    silent: true,
    renotify: false,
    actions: [
      { action: 'add30', title: '+30s ⏱️' },
      { action: 'skip', title: 'Listo 💪' }
    ]
  }).catch(() => {});
}

function clearLiveRestNotification() {
  return self.registration.getNotifications({ tag: 'vigorexiapp-rest-live' }).then((notifications) => {
    notifications.forEach((n) => n.close());
  }).catch(() => {});
}

function notifyClients(msg) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    clients.forEach((c) => c.postMessage(msg));
  }).catch(() => {});
}

self.addEventListener('notificationclick', (event) => {
  const action = event.action;

  if (action === 'add30') {
    if (currentRestState && currentRestState.endTime) {
      currentRestState.endTime += 30000;
      if (bgTimerId) clearTimeout(bgTimerId);
      const delay = Math.max(0, currentRestState.endTime - Date.now());
      bgTimerId = setTimeout(() => {
        clearLiveRestNotification();
        self.registration.showNotification('¡Descanso Terminado! 🔔', {
          body: currentRestState.exerciseName 
            ? `¡A por ello! Siguiente: ${currentRestState.exerciseName} 💪` 
            : 'Hora de la siguiente serie en Vigorexiapp 💪',
          icon: './icon-192.png',
          badge: './badge-round.png',
          vibrate: [200, 100, 200, 100, 300],
          tag: 'rest-finish',
          renotify: true
        });
        bgTimerId = null;
        currentRestState = null;
      }, delay);

      showLiveRestNotification(currentRestState);
      notifyClients({ type: 'REST_TIMER_ADJUSTED', delta: 30 });
    }
    return;
  }

  if (action === 'skip') {
    if (bgTimerId) clearTimeout(bgTimerId);
    bgTimerId = null;
    clearLiveRestNotification();

    self.registration.showNotification('¡Listo para la serie! 💪', {
      body: currentRestState && currentRestState.exerciseName
        ? `A darlo todo en: ${currentRestState.exerciseName}`
        : 'Hora de la siguiente serie en Vigorexiapp 💪',
      icon: './icon-192.png',
      badge: './badge-round.png',
      vibrate: [150, 80, 150],
      tag: 'rest-finish',
      renotify: true
    });

    notifyClients({ type: 'REST_TIMER_SKIPPED' });
    currentRestState = null;
    return;
  }

  // Click estándar en el cuerpo de la notificación: enfocar ventana
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('./index.html');
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'START_REST_TIMER') {
    if (bgTimerId) clearTimeout(bgTimerId);
    currentRestState = {
      endTime: event.data.endTime,
      duration: event.data.duration || 90,
      exerciseName: event.data.exerciseName || '',
      setInfo: event.data.setInfo || ''
    };

    // Publicar inmediatamente notificación persistente para la pantalla de bloqueo
    showLiveRestNotification(currentRestState);

    const delay = Math.max(0, currentRestState.endTime - Date.now());
    bgTimerId = setTimeout(() => {
      clearLiveRestNotification();
      self.registration.showNotification('¡Descanso Terminado! 🔔', {
        body: currentRestState.exerciseName 
          ? `¡A por ello! Siguiente: ${currentRestState.exerciseName} 💪` 
          : 'Hora de la siguiente serie en Vigorexiapp 💪',
        icon: './icon-192.png',
        badge: './badge-round.png',
        vibrate: [200, 100, 200, 100, 300],
        tag: 'rest-finish',
        renotify: true
      });
      bgTimerId = null;
      currentRestState = null;
    }, delay);
  } else if (event.data && event.data.type === 'UPDATE_REST_TIMER') {
    if (currentRestState) {
      currentRestState.endTime = event.data.endTime;
      if (event.data.exerciseName) currentRestState.exerciseName = event.data.exerciseName;
      if (event.data.setInfo) currentRestState.setInfo = event.data.setInfo;

      if (bgTimerId) clearTimeout(bgTimerId);
      const delay = Math.max(0, currentRestState.endTime - Date.now());
      bgTimerId = setTimeout(() => {
        clearLiveRestNotification();
        self.registration.showNotification('¡Descanso Terminado! 🔔', {
          body: currentRestState.exerciseName 
            ? `¡A por ello! Siguiente: ${currentRestState.exerciseName} 💪` 
            : 'Hora de la siguiente serie en Vigorexiapp 💪',
          icon: './icon-192.png',
          badge: './badge-round.png',
          vibrate: [200, 100, 200, 100, 300],
          tag: 'rest-finish',
          renotify: true
        });
        bgTimerId = null;
        currentRestState = null;
      }, delay);

      showLiveRestNotification(currentRestState);
    }
  } else if (event.data && event.data.type === 'CANCEL_REST_TIMER') {
    if (bgTimerId) {
      clearTimeout(bgTimerId);
      bgTimerId = null;
    }
    currentRestState = null;
    clearLiveRestNotification();
  } else if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
