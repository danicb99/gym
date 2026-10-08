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
      if (typeof workoutState === 'undefined' || !workoutState) return;
      if (typeof ROUTINE_SLOTS === 'undefined' || !ROUTINE_SLOTS) return;
      
      let activeDay = null;
      // 1. Selector DOM de sección activa
      const activeSection = document.querySelector('.day-content.active');
      if (activeSection && ROUTINE_SLOTS[activeSection.id]) {
        activeDay = activeSection.id;
      }

      // 2. Dropdown selector de día
      if (!activeDay) {
        const sel = document.getElementById('daySelector');
        if (sel && ROUTINE_SLOTS[sel.value]) {
          activeDay = sel.value;
        }
      }

      // 3. sessionStartTime
      if (!activeDay && workoutState.sessionStartTime) {
        let latestTime = 0;
        for (const [dayId, sTime] of Object.entries(workoutState.sessionStartTime)) {
          if (sTime && sTime > latestTime) {
            latestTime = sTime;
            activeDay = dayId;
          }
        }
      }
      
      if (!activeDay && typeof lastActiveWorkoutDay !== 'undefined') {
        activeDay = lastActiveWorkoutDay;
      }
      if (!activeDay || !ROUTINE_SLOTS[activeDay]) activeDay = 'torsoA';

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

      // Extraer temporizador de descanso si está activo
      let restTimerPayload = null;
      try {
        const savedRest = localStorage.getItem('vigorexiapp_rest_timer');
        if (savedRest) {
          const parsed = JSON.parse(savedRest);
          if (parsed && parsed.endTime && parsed.endTime > Date.now()) {
            restTimerPayload = {
              active: true,
              endTime: parsed.endTime,
              duration: parsed.duration || 90,
              remaining: Math.max(0, Math.round((parsed.endTime - Date.now()) / 1000))
            };
          }
        }
      } catch (e) {}

      if (!restTimerPayload && typeof isTimerActive !== 'undefined' && isTimerActive && typeof timerEndTime !== 'undefined' && timerEndTime > Date.now()) {
        restTimerPayload = {
          active: true,
          endTime: timerEndTime,
          duration: typeof timerDuration !== 'undefined' ? timerDuration : 90,
          remaining: typeof timerRemaining !== 'undefined' ? timerRemaining : 0
        };
      }

      // Filtrar previousSets solo para los ejercicios del día activo (reduce el JSON a <1KB)
      const filteredPrevious = {};
      try {
        const activeExIds = new Set();
        dayData.slots.forEach(slot => {
          const chosenEx = (workoutState.customSlots && workoutState.customSlots[slot.slotId]) ||
                           (workoutState.tempSlots && workoutState.tempSlots[slot.slotId]) ||
                           slot.defaultExId || slot.slotId;
          if (chosenEx) activeExIds.add(chosenEx);
          if (slot.defaultExId) activeExIds.add(slot.defaultExId);
          if (slot.slotId) activeExIds.add(slot.slotId);
          if (Array.isArray(slot.options)) {
            slot.options.forEach(opt => {
              if (opt && opt.id) activeExIds.add(opt.id);
            });
          }
        });
        if (workoutState.previous) {
          for (const exId of activeExIds) {
            if (workoutState.previous[exId]) {
              filteredPrevious[exId] = workoutState.previous[exId];
            }
          }
        }
      } catch (e) {}

      const payload = {
        activeDayId: activeDay,
        currentSlotIndex: firstUnfinishedSlot,
        currentSetIndex: firstUnfinishedSet,
        sessionStartTime: (workoutState.sessionStartTime && workoutState.sessionStartTime[activeDay]) || Date.now(),
        sessionLoggedSets: sessionLoggedSets,
        slotExOverrides: Object.assign({}, workoutState.customSlots, workoutState.tempSlots),
        previousSets: filteredPrevious,
        restTimer: restTimerPayload,
        timestamp: Date.now()
      };

      const hash = JSON.stringify({
        d: activeDay,
        c: (workoutState.completed || []).length,
        s: firstUnfinishedSlot,
        set: firstUnfinishedSet,
        r: restTimerPayload ? Math.round(restTimerPayload.remaining / 5) : 0
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

  let reconnectTimeout = null;
  let lastCatchUpTimestamp = 0;

  async function catchUpFromWatch() {
    try {
      const resp = await fetch(`${RELAY_WATCH_TO_PHONE}/json?poll=1&since=10m`);
      if (!resp.ok) return;
      const text = await resp.text();
      if (!text) return;
      const lines = text.trim().split('\n');
      for (const line of lines) {
        try {
          const raw = JSON.parse(line);
          if (raw && raw.event === 'message' && raw.message) {
            const data = typeof raw.message === 'string' ? JSON.parse(raw.message) : raw.message;
            if (data && data.timestamp && data.timestamp > lastCatchUpTimestamp) {
              lastCatchUpTimestamp = data.timestamp;
              if (data.type === 'SET_COMPLETED') {
                handleSetCompletedFromWatch(data);
              } else if (data.type === 'WORKOUT_FINISHED') {
                handleWorkoutFinishedFromWatch(data);
              }
            }
          }
        } catch (e) {}
      }
    } catch (e) {
      console.log('[WatchBridge] Error en catch-up del reloj:', e);
    }
  }

  // 2. Escuchar eventos entrantes desde el reloj vía SSE
  function startListeningToWatchEvents() {
    if (syncEventSource) {
      if (syncEventSource.readyState === EventSource.OPEN || syncEventSource.readyState === EventSource.CONNECTING) {
        return;
      }
      try { syncEventSource.close(); } catch (e) {}
      syncEventSource = null;
    }

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

          if (data.timestamp) lastCatchUpTimestamp = Math.max(lastCatchUpTimestamp, data.timestamp);

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
        try {
          if (syncEventSource) syncEventSource.close();
        } catch (e) {}
        syncEventSource = null;
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(startListeningToWatchEvents, 3500);
      };
    } catch (e) {
      console.warn('[WatchBridge] Error inicializando SSE:', e);
      clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(startListeningToWatchEvents, 5000);
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
    if (kgInp && kg !== undefined && kg !== null && kg !== '') kgInp.value = kg;
    if (repsInp && reps !== undefined && reps !== null && reps !== '') repsInp.value = reps;

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
    try {
      const summary = data.summary || data;
      if (summary && summary.dayId && typeof workoutState !== 'undefined') {
        const durMin = summary.durationMinutes || 45;
        const durationFormatted = durMin >= 60 
          ? `${Math.floor(durMin / 60)}h ${durMin % 60}m` 
          : `${durMin} min`;
        
        const record = {
          id: 'ses_' + Date.now(),
          date: summary.date || new Date().toISOString(),
          dayId: summary.dayId,
          dayName: summary.dayName || summary.dayId,
          durationMinutes: durMin,
          durationFormatted: durationFormatted,
          exercises: summary.exercises || []
        };

        if (!workoutState.sessions) workoutState.sessions = [];
        // Evitar duplicar si ya se guardó hace menos de 60 segundos
        const exists = workoutState.sessions.some(s => 
          s.dayId === record.dayId && Math.abs(new Date(s.date) - new Date(record.date)) < 60000
        );
        if (!exists) {
          workoutState.sessions.unshift(record);
        }

        if (workoutState.sessionStartTime) delete workoutState.sessionStartTime[summary.dayId];
        if (workoutState.lastActivityTime) delete workoutState.lastActivityTime[summary.dayId];

        if (typeof saveWorkoutState === 'function') saveWorkoutState();
        if (typeof updateProgress === 'function') updateProgress();
      }
    } catch (e) {
      console.warn('[WatchBridge] Error archivando sesión del reloj:', e);
    }

    const durText = (data.summary && data.summary.durationMinutes) ? ` (${data.summary.durationMinutes} min)` : '';
    showWatchToast(`⌚ ¡Entrenamiento completado y guardado desde el reloj!${durText}`);
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
      const headerContainer = document.querySelector('.header-content, .app-header');
      if (headerContainer) {
        pill = document.createElement('div');
        pill.id = 'watchSyncPill';
        pill.style.cssText = 'display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:4px 8px;border-radius:12px;background:rgba(15,23,42,0.9);border:1px solid rgba(56,189,248,0.4);color:#94a3b8;cursor:pointer;white-space:nowrap;user-select:none;margin-left:auto;';
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

  // Hooking en saveRestTimerState para emitir inicio y cambio de descanso al reloj
  const origSaveRestTimer = window.saveRestTimerState;
  if (typeof origSaveRestTimer === 'function') {
    window.saveRestTimerState = function(...args) {
      const res = origSaveRestTimer.apply(this, args);
      setTimeout(broadcastActiveWorkoutToWatch, 50);
      return res;
    };
  }

  // Iniciar al cargar la página y cuando la app vuelve a primer plano
  function onAppForeground() {
    startListeningToWatchEvents();
    catchUpFromWatch();
    broadcastActiveWorkoutToWatch();
  }

  window.addEventListener('DOMContentLoaded', () => {
    startListeningToWatchEvents();
    catchUpFromWatch();
    setTimeout(broadcastActiveWorkoutToWatch, 1200);

    // Sincronizar periódicamente (cada 5s si hay descanso activo o ventana visible)
    setInterval(() => {
      if (document.visibilityState === 'visible') {
        broadcastActiveWorkoutToWatch();
      }
    }, 5000);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        onAppForeground();
      }
    });

    window.addEventListener('focus', onAppForeground);
  });

  // Exponer API global
  window.VigorexiWatchSync = {
    broadcast: broadcastActiveWorkoutToWatch,
    reconnect: onAppForeground,
    catchUp: catchUpFromWatch
  };
})();
