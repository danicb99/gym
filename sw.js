const CACHE_NAME = 'vigorexiapp-v32';
const NOTIF_BADGE = './badge-dumbbell.png?v=3';
const NOTIF_ICON = './icon-192.png?v=3';

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
  './badge-dumbbell.png',
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

let currentRestState = null;
let liveTickerInterval = null;
let bgTimerId = null;

function formatRestClock(totalSeconds) {
  const m = Math.floor(Math.max(0, totalSeconds) / 60);
  const s = Math.max(0, totalSeconds) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatEndTime(timestamp) {
  const d = new Date(timestamp);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function showLiveRestNotification(state) {
  if (!state || !state.endTime) return Promise.resolve();
  const remaining = Math.max(0, Math.round((state.endTime - Date.now()) / 1000));
  const timeText = formatRestClock(remaining);
  const finishTime = formatEndTime(state.endTime);
  const exercise = state.exerciseName || 'Siguiente serie';
  const subtitle = state.setInfo ? `${exercise} (${state.setInfo})` : exercise;

  return self.registration.showNotification(`⏱️ ${timeText} — Descanso`, {
    body: `Termina ${finishTime} • ${subtitle}`,
    icon: NOTIF_ICON,
    badge: NOTIF_BADGE,
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

function showRestFinishedNotification(state) {
  clearLiveRestNotification();
  const exName = state && state.exerciseName ? state.exerciseName : '';
  return self.registration.showNotification('¡Descanso Terminado! 🔔', {
    body: exName 
      ? `¡A por ello! Siguiente: ${exName} 💪` 
      : 'Hora de la siguiente serie en Vigorexiapp 💪',
    icon: NOTIF_ICON,
    badge: NOTIF_BADGE,
    vibrate: [200, 100, 200, 100, 300],
    tag: 'rest-finish',
    renotify: true
  }).catch(() => {});
}

function clearLiveRestNotification() {
  return self.registration.getNotifications({ tag: 'vigorexiapp-rest-live' }).then((notifications) => {
    notifications.forEach((n) => n.close());
  }).catch(() => {});
}

let activeTimerResolve = null;

function stopLiveTicker() {
  if (liveTickerInterval) {
    clearInterval(liveTickerInterval);
    liveTickerInterval = null;
  }
  if (bgTimerId) {
    clearTimeout(bgTimerId);
    bgTimerId = null;
  }
  if (activeTimerResolve) {
    activeTimerResolve();
    activeTimerResolve = null;
  }
}

function startLiveTicker(state) {
  stopLiveTicker();
  currentRestState = state;
  if (!currentRestState || !currentRestState.endTime) return Promise.resolve();

  // Actualizar inmediatamente
  showLiveRestNotification(currentRestState);

  return new Promise((resolve) => {
    activeTimerResolve = resolve;

    // 1. Programar el despertar nativo para cuando expire el tiempo
    const delay = Math.max(0, currentRestState.endTime - Date.now());
    bgTimerId = setTimeout(() => {
      const finished = currentRestState;
      stopLiveTicker();
      currentRestState = null;
      showRestFinishedNotification(finished);
      notifyClients({ type: 'REST_TIMER_FINISHED' });
      resolve();
    }, delay);

    // 2. Ticker de refresco en vivo mientras la pantalla o CPU estén activas
    liveTickerInterval = setInterval(() => {
      if (!currentRestState || !currentRestState.endTime) {
        stopLiveTicker();
        resolve();
        return;
      }
      const remaining = Math.max(0, Math.round((currentRestState.endTime - Date.now()) / 1000));
      if (remaining <= 0) {
        const finished = currentRestState;
        stopLiveTicker();
        currentRestState = null;
        showRestFinishedNotification(finished);
        notifyClients({ type: 'REST_TIMER_FINISHED' });
        resolve();
      } else {
        showLiveRestNotification(currentRestState);
      }
    }, 1000);
  });
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
      const p = startLiveTicker(currentRestState);
      if (event.waitUntil) event.waitUntil(p);
      notifyClients({ type: 'REST_TIMER_ADJUSTED', delta: 30 });
    }
    return;
  }

  if (action === 'skip') {
    stopLiveTicker();
    clearLiveRestNotification();

    const p = self.registration.showNotification('¡Listo para la serie! 💪', {
      body: currentRestState && currentRestState.exerciseName
        ? `A darlo todo en: ${currentRestState.exerciseName}`
        : 'Hora de la siguiente serie en Vigorexiapp 💪',
      icon: NOTIF_ICON,
      badge: NOTIF_BADGE,
      vibrate: [150, 80, 150],
      tag: 'rest-finish',
      renotify: true
    }).catch(() => {});

    if (event.waitUntil) event.waitUntil(p);
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
    currentRestState = {
      endTime: event.data.endTime,
      duration: event.data.duration || 90,
      exerciseName: event.data.exerciseName || '',
      setInfo: event.data.setInfo || ''
    };
    const p = startLiveTicker(currentRestState);
    if (event.waitUntil) event.waitUntil(p);
  } else if (event.data && event.data.type === 'UPDATE_REST_TIMER') {
    if (currentRestState) {
      currentRestState.endTime = event.data.endTime;
      if (event.data.exerciseName) currentRestState.exerciseName = event.data.exerciseName;
      if (event.data.setInfo) currentRestState.setInfo = event.data.setInfo;
    } else {
      currentRestState = {
        endTime: event.data.endTime,
        duration: event.data.duration || 90,
        exerciseName: event.data.exerciseName || '',
        setInfo: event.data.setInfo || ''
      };
    }
    const p = startLiveTicker(currentRestState);
    if (event.waitUntil) event.waitUntil(p);
  } else if (event.data && event.data.type === 'CANCEL_REST_TIMER') {
    stopLiveTicker();
    currentRestState = null;
    clearLiveRestNotification();
  } else if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
