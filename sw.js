const CACHE_NAME = 'vigorexiapp-v1.8.4-rev45';
const NOTIF_TAG = 'vigorexiapp-rest';
const BADGE_LIVE = './badge-timer.png?v=1';
const BADGE_FINISHED = './badge-bell.png?v=1';
const ICON_LIVE = './icon-192.png?v=3';
const ICON_FINISHED = './icon-finished-192.png?v=1';

const ASSETS = [
  './',
  './index.html',
  './reloj.html',
  './qr_zepp.png',
  './watch_bridge.js',
  './storage_format.js?v=1',
  './mascot.png',
  './icon-round-192.png',
  './icon-round-512.png',
  './badge-round.png',
  './badge.png',
  './badge-dumbbell.png',
  './badge-timer.png',
  './badge-timer.png?v=1',
  './badge-bell.png',
  './badge-bell.png?v=1',
  './icon-finished-192.png',
  './icon-finished-192.png?v=1',
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
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of ASSETS) {
        try {
          const res = await fetch(asset, { cache: 'reload' });
          if (res.ok) await cache.put(asset, res);
        } catch (err) {}
      }
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
    }).then(() => self.clients.claim()).then(() => {
      // Limpiar notificaciones huérfanas o con tags legacy de versiones anteriores
      return self.registration.getNotifications().then((notifications) => {
        notifications.forEach((n) => {
          if (n.tag === 'vigorexiapp-rest-live' || n.tag === 'rest-finish') {
            n.close();
          }
        });
      }).catch(() => {});
    }).then(() => {
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((c) => c.postMessage({ type: 'FORCE_UPDATE', cache: CACHE_NAME }));
      });
    })
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // El SW solo gestiona recursos propios; ntfy y otros orígenes van directos a la red
  if (url.origin !== self.location.origin) return;

  const isNav = e.request.mode === 'navigate' || e.request.destination === 'document' || url.pathname.endsWith('.html') || url.pathname.endsWith('/gym/') || url.pathname.endsWith('/gym');

  // Network-first para páginas HTML para que cualquier actualización en GitHub se aplique de inmediato
  if (isNav) {
    e.respondWith(
      fetch(e.request, { cache: 'reload' }).then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone)).catch(() => {});
        }
        return networkRes;
      }).catch(() => {
        return caches.match(e.request).then((res) => res || caches.match('./index.html'));
      })
    );
    return;
  }

  // Solo se cachean peticiones GET; POST/SSE nunca entran en la Cache API
  if (e.request.method !== 'GET') return;

  // Stale-while-revalidate / Cache-first con actualización en segundo plano para recursos estáticos
  e.respondWith(
    caches.match(e.request).then((cachedRes) => {
      const fetchPromise = fetch(e.request).then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone)).catch(() => {});
        }
        return networkRes;
      }).catch(() => null);

      return cachedRes || fetchPromise;
    })
  );
});

let currentRestState = null;
let currentRestGen = 0;
let liveTickerInterval = null;
let bgTimerId = null;
let activeTimerResolve = null;

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

function showLiveRestNotification(state, gen) {
  if (!state || !state.endTime) return Promise.resolve();
  if (gen !== undefined && gen !== currentRestGen) return Promise.resolve();

  const remaining = Math.max(0, Math.round((state.endTime - Date.now()) / 1000));
  const timeText = formatRestClock(remaining);
  const finishTime = formatEndTime(state.endTime);
  const exercise = state.exerciseName || 'Siguiente serie';
  const subtitle = state.setInfo ? `${exercise} (${state.setInfo})` : exercise;

  return self.registration.showNotification(`⏱️ ${timeText} — Descanso`, {
    body: `Termina ${finishTime} • ${subtitle}`,
    icon: ICON_LIVE,
    badge: BADGE_LIVE,
    tag: NOTIF_TAG,
    data: { phase: 'live', restGen: gen !== undefined ? gen : currentRestGen, endTime: state.endTime },
    silent: true,
    renotify: false,
    actions: [
      { action: 'add30', title: '+30s ⏱️' },
      { action: 'skip', title: 'Listo 💪' }
    ]
  }).catch(() => {});
}

function showRestFinishedNotification(state, gen) {
  if (gen !== undefined && gen !== currentRestGen) return Promise.resolve();
  const exName = state && state.exerciseName ? state.exerciseName : '';

  return self.registration.showNotification('¡Descanso Terminado! 🔔', {
    body: exName 
      ? `¡A por ello! Siguiente: ${exName} 💪` 
      : 'Hora de la siguiente serie en Vigorexiapp 💪',
    icon: ICON_FINISHED,
    badge: BADGE_FINISHED,
    vibrate: [200, 100, 200, 100, 300],
    tag: NOTIF_TAG,
    data: { phase: 'finished', restGen: gen !== undefined ? gen : currentRestGen },
    renotify: true
  }).catch(() => {});
}

function clearLiveRestNotification() {
  return self.registration.getNotifications({ tag: NOTIF_TAG }).then((notifications) => {
    notifications.forEach((n) => {
      if (!n.data || n.data.phase === 'live') {
        n.close();
      }
    });
  }).catch(() => {});
}

function clearAllRestNotifications() {
  return self.registration.getNotifications().then((notifications) => {
    notifications.forEach((n) => {
      if (n.tag === NOTIF_TAG || n.tag === 'vigorexiapp-rest-live' || n.tag === 'rest-finish') {
        n.close();
      }
    });
  }).catch(() => {});
}

function hasVisibleClient() {
  if (!self.clients || !self.clients.matchAll) return Promise.resolve(false);
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => clientList.some((client) => client.visibilityState === 'visible'))
    .catch(() => false);
}

// Con la app visible, la página es la única que notifica (evita doble sonido/vibración)
function notifyRestFinished(state, gen) {
  return hasVisibleClient().then((visible) => {
    if (!visible) return showRestFinishedNotification(state, gen);
  });
}

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
  currentRestGen++;
  const thisGen = currentRestGen;
  currentRestState = state;
  if (!currentRestState || !currentRestState.endTime) return Promise.resolve();

  // Actualizar inmediatamente
  showLiveRestNotification(currentRestState, thisGen);

  return new Promise((resolve) => {
    activeTimerResolve = resolve;

    // 1. Programar el despertar nativo para cuando expire el tiempo
    const delay = Math.max(0, currentRestState.endTime - Date.now());
    bgTimerId = setTimeout(async () => {
      if (thisGen !== currentRestGen) {
        resolve();
        return;
      }
      const finished = currentRestState;
      stopLiveTicker();
      currentRestState = null;
      await notifyRestFinished(finished, thisGen);
      await notifyClients({ type: 'REST_TIMER_FINISHED', restGen: thisGen });
      resolve();
    }, delay);

    // 2. Ticker de refresco en vivo mientras la pantalla o CPU estén activas
    liveTickerInterval = setInterval(async () => {
      if (thisGen !== currentRestGen || !currentRestState || !currentRestState.endTime) {
        stopLiveTicker();
        resolve();
        return;
      }
      const remaining = Math.max(0, Math.round((currentRestState.endTime - Date.now()) / 1000));
      if (remaining <= 0) {
        const finished = currentRestState;
        stopLiveTicker();
        currentRestState = null;
        await notifyRestFinished(finished, thisGen);
        await notifyClients({ type: 'REST_TIMER_FINISHED', restGen: thisGen });
        resolve();
      } else {
        showLiveRestNotification(currentRestState, thisGen);
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
    currentRestGen++;
    const thisGen = currentRestGen;

    const p = self.registration.showNotification('¡Listo para la serie! 💪', {
      body: currentRestState && currentRestState.exerciseName
        ? `A darlo todo en: ${currentRestState.exerciseName}`
        : 'Hora de la siguiente serie en Vigorexiapp 💪',
      icon: ICON_FINISHED,
      badge: BADGE_FINISHED,
      vibrate: [150, 80, 150],
      tag: NOTIF_TAG,
      data: { phase: 'finished', restGen: thisGen },
      renotify: true
    }).catch(() => {});

    if (event.waitUntil) event.waitUntil(p);
    notifyClients({ type: 'REST_TIMER_SKIPPED' });
    currentRestState = null;
    return;
  }

  // Click estándar en el cuerpo de la notificación: enfocar ventana y cerrar
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
    currentRestGen++;
    currentRestState = null;
    clearLiveRestNotification();
  } else if (event.data && event.data.type === 'CLEAR_ALL_NOTIFICATIONS') {
    clearAllRestNotifications();
  } else if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
