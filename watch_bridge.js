/**
 * VigorexiApp - Watch Live Sync Bridge
 * Conexión en tiempo real con el Amazfit Active 2 (Zepp OS) vía relay de sincronización ntfy.sh
 * Permite uso mixto: completar series en el móvil o en el reloj indistintamente.
 */
(function() {
  const RELAY_WATCH_TO_PHONE = 'https://ntfy.sh/vigorexiapp_sync_danicb99';
  const RELAY_PHONE_TO_WATCH = 'https://ntfy.sh/vigorexiapp_watch_danicb99';
  
  let syncEventSource = null;
  let isBroadcasting = false;
  let lastBroadcastHash = '';

  // 1. Enviar el estado del entrenamiento activo del móvil al reloj
  function broadcastActiveWorkoutToWatch() {
    if (isBroadcasting) return;
    try {
      if (typeof workoutState === 'undefined' || !workoutState || !workoutState.sessionStartTime) return;
      if (typeof ROUTINE_SLOTS === 'undefined' || !ROUTINE_SLOTS) return;
      
      let activeDay = null;
      let latestTime = 0;
      for (const [dayId, sTime] of Object.entries(workoutState.sessionStartTime)) {
        if (sTime && sTime > latestTime) {
          const hoursAgo = (Date.now() - sTime) / 3600000;
          if (hoursAgo < 6) {
            latestTime = sTime;
            activeDay = dayId;
          }
        }
      }
      
      if (!activeDay && typeof lastActiveWorkoutDay !== 'undefined') {
        activeDay = lastActiveWorkoutDay;
      }
      if (!activeDay || !ROUTINE_SLOTS[activeDay]) return;

      const dayData = ROUTINE_SLOTS[activeDay];
      const sessionLoggedSets = {};
      let firstUnfinishedSlot = 0;
      let firstUnfinishedSet = 0;
      let foundNext = false;

      dayData.slots.forEach((slot, slotIdx) => {
        sessionLoggedSets[slot.slotId] = [];
        const slotSets = slot.sets || [];
        slotSets.forEach((sDef, sIdx) => {
          const rowId = `${slot.slotId}_${sIdx}`;
          const isDone = workoutState.completed && workoutState.completed.includes(rowId);
          const kg = (workoutState.inputs && workoutState.inputs[`${rowId}_kg`]) || sDef[0] || 60;
          const reps = (workoutState.inputs && workoutState.inputs[`${rowId}_reps`]) || sDef[1] || 10;
          
          if (isDone) {
            sessionLoggedSets[slot.slotId][sIdx] = {
              kg: Number(kg),
              reps: Number(reps),
              completed: true
            };
          } else if (!foundNext) {
            firstUnfinishedSlot = slotIdx;
            firstUnfinishedSet = sIdx;
            foundNext = true;
          }
        });
      });

      const payload = {
        activeDayId: activeDay,
        currentSlotIndex: firstUnfinishedSlot,
        currentSetIndex: firstUnfinishedSet,
        sessionStartTime: workoutState.sessionStartTime[activeDay] || Date.now(),
        sessionLoggedSets: sessionLoggedSets,
        slotExOverrides: Object.assign({}, workoutState.customSlots, workoutState.tempSlots),
        timestamp: Date.now()
      };

      const hash = JSON.stringify({
        d: activeDay,
        c: (workoutState.completed || []).length,
        s: firstUnfinishedSlot,
        set: firstUnfinishedSet
      });

      if (hash === lastBroadcastHash) return;
      lastBroadcastHash = hash;

      isBroadcasting = true;
      fetch(RELAY_PHONE_TO_WATCH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(err => {
        console.log('[WatchBridge] Error enviando estado al reloj:', err);
      }).finally(() => {
        isBroadcasting = false;
      });

    } catch (e) {
      console.log('[WatchBridge] Error construyendo broadcast:', e);
      isBroadcasting = false;
    }
  }

  // 2. Escuchar eventos entrantes desde el reloj vía SSE
  function startListeningToWatchEvents() {
    if (syncEventSource) return;

    try {
      syncEventSource = new EventSource(`${RELAY_WATCH_TO_PHONE}/sse`);

      syncEventSource.onopen = () => {
        console.log('[WatchBridge] Canal SSE conectado con el Amazfit Active 2');
        updateSyncPill(true);
      };

      syncEventSource.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          if (!raw.message) return;
          const data = typeof raw.message === 'string' ? JSON.parse(raw.message) : raw.message;

          if (data.type === 'SET_COMPLETED') {
            handleSetCompletedFromWatch(data);
          } else if (data.type === 'WORKOUT_FINISHED') {
            handleWorkoutFinishedFromWatch(data);
          }
        } catch (err) {
          console.warn('[WatchBridge] Error parseando mensaje del reloj:', err);
        }
      };

      syncEventSource.onerror = () => {
        updateSyncPill(false);
      };
    } catch (e) {
      console.warn('[WatchBridge] Error inicializando SSE:', e);
    }
  }

  // 3. Manejar serie completada en el reloj
  function handleSetCompletedFromWatch(data) {
    const { slotId, setIndex, kg, reps } = data;
    console.log('[WatchBridge] Serie recibida desde el reloj:', slotId, setIndex, kg, reps);

    const card = document.querySelector(`.exercise-card[data-slot="${slotId}"]`);
    if (!card) return;

    const rows = card.querySelectorAll('.set-row');
    const targetRow = rows[setIndex];
    if (!targetRow) return;

    // Actualizar inputs si vienen valores
    const kgInp = targetRow.querySelector('.input-kg');
    const repsInp = targetRow.querySelector('.input-reps');
    if (kgInp && kg) kgInp.value = kg;
    if (repsInp && reps) repsInp.value = reps;

    // Marcar como completada si no lo estaba
    if (!targetRow.classList.contains('done')) {
      targetRow.classList.add('done');
      
      // Actualizar tarjeta
      if (typeof checkExerciseCardCompletion === 'function') {
        checkExerciseCardCompletion(card);
      }
      
      // Iniciar temporizador de descanso en la web
      if (typeof startRestTimerFromCard === 'function') {
        startRestTimerFromCard(card);
      }

      // Guardar estado local
      if (typeof saveWorkoutState === 'function') {
        saveWorkoutState();
      }
      if (typeof updateProgress === 'function') {
        updateProgress();
      }

      // Notificación visual flotante en la pantalla del móvil
      showWatchToast(`⌚ Serie ${setIndex + 1} completada en el reloj (${kg}kg × ${reps})`);
    }
  }

  // 4. Manejar fin de entreno desde el reloj
  function handleWorkoutFinishedFromWatch(data) {
    console.log('[WatchBridge] Fin de entreno recibido desde el reloj:', data);
    showWatchToast('⌚ ¡Entrenamiento completado y guardado desde el reloj!');
    if (typeof loadWorkoutState === 'function') {
      loadWorkoutState();
    }
  }

  // 5. Toast flotante sutil
  function showWatchToast(text) {
    let toast = document.getElementById('watchSyncToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'watchSyncToast';
      toast.style.cssText = 'position:fixed;bottom:85px;left:50%;transform:translateX(-50%);background:#0f172a;color:#38bdf8;padding:10px 18px;border-radius:24px;border:1px solid #0284c7;font-size:14px;font-weight:600;z-index:999999;box-shadow:0 8px 24px rgba(0,0,0,0.5);display:flex;align-items:center;gap:8px;transition:opacity 0.3s;pointer-events:none;';
      document.body.appendChild(toast);
    }
    toast.innerText = text;
    toast.style.opacity = '1';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.style.opacity = '0';
    }, 3500);
  }

  // 6. Pill de estado en la cabecera
  function updateSyncPill(connected) {
    let pill = document.getElementById('watchSyncPill');
    if (!pill) {
      const headerContainer = document.querySelector('.header-top, header, nav, .header-card, .top-bar');
      if (headerContainer) {
        pill = document.createElement('div');
        pill.id = 'watchSyncPill';
        pill.style.cssText = 'display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;padding:4px 10px;border-radius:12px;background:rgba(15,23,42,0.8);border:1px solid rgba(56,189,248,0.3);color:#94a3b8;cursor:pointer;margin-left:auto;';
        pill.title = 'Sincronización en vivo con Amazfit Active 2';
        pill.onclick = () => {
          broadcastActiveWorkoutToWatch();
          showWatchToast('⌚ Sincronizando con el reloj...');
        };
        headerContainer.appendChild(pill);
      }
    }
    if (pill) {
      if (connected) {
        pill.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b981;"></span> ⌚ Reloj';
        pill.style.color = '#38bdf8';
        pill.style.borderColor = 'rgba(16,185,129,0.4)';
      } else {
        pill.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#94a3b8;"></span> ⌚ Reloj';
        pill.style.color = '#94a3b8';
      }
    }
  }

  // Hooking en saveWorkoutState para emitir actualización
  const originalSave = window.saveWorkoutState;
  if (typeof originalSave === 'function') {
    window.saveWorkoutState = function(...args) {
      const res = originalSave.apply(this, args);
      setTimeout(broadcastActiveWorkoutToWatch, 100);
      return res;
    };
  }

  // Iniciar al cargar la página
  window.addEventListener('DOMContentLoaded', () => {
    startListeningToWatchEvents();
    setTimeout(broadcastActiveWorkoutToWatch, 1200);

    // Sincronizar periódicamente cada 15 segundos si la app está en pantalla
    setInterval(() => {
      if (document.visibilityState === 'visible') {
        broadcastActiveWorkoutToWatch();
      }
    }, 15000);
  });

  // Exponer API global
  window.VigorexiWatchSync = {
    broadcast: broadcastActiveWorkoutToWatch,
    reconnect: startListeningToWatchEvents
  };
})();
