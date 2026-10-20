/**
 * VigorexiApp - Watch Live Sync Bridge
 * Conexión en tiempo real con el Amazfit Active 2 (Zepp OS) vía relay de sincronización ntfy.sh
 * Permite uso mixto: completar series en el móvil o en el reloj indistintamente.
 */
(function() {
  const RELAY_WATCH_TO_PHONE = 'https://ntfy.sh/vigorexiapp_sync_danicb99_7f3a91c4e2b8';
  const RELAY_PHONE_TO_WATCH = 'https://ntfy.sh/vigorexiapp_watch_danicb99_7f3a91c4e2b8';
  
  let syncEventSource = null;
  let isBroadcasting = false;
  let hasPendingBroadcast = false;
  let lastBroadcastHash = '';
  let lastBroadcastTime = 0;
  let rateLimitResetTime = 0;
  let broadcastDebounceTimer = null;
  let broadcastRetryCount = 0;

  const REV_KEY = 'vigorexiapp_snapshot_rev';
  function getNextRev() {
    const current = Number(localStorage.getItem(REV_KEY)) || 0;
    const next = current + 1;
    try { localStorage.setItem(REV_KEY, String(next)); } catch (e) {}
    return next;
  }
  function getCurrentRev() {
    return Number(localStorage.getItem(REV_KEY)) || 0;
  }

  function getOrCreateSessionId(activeDay) {
    if (!activeDay) return null;
    if (typeof workoutState === 'undefined' || !workoutState) return null;
    if (!workoutState.sessionIds) workoutState.sessionIds = {};
    if (!workoutState.sessionIds[activeDay]) {
      const sTime = (workoutState.sessionStartTime && workoutState.sessionStartTime[activeDay]) || Date.now();
      workoutState.sessionIds[activeDay] = `web-${activeDay}-${sTime}`;
    }
    return workoutState.sessionIds[activeDay];
  }

  function isWorkoutActive(dayId) {
    if (!dayId || typeof ROUTINE_SLOTS === 'undefined' || !ROUTINE_SLOTS[dayId]) return false;
    if (typeof workoutState === 'undefined' || !workoutState) return false;
    // 1. Sesión iniciada con cronómetro en las últimas 12 horas
    if (workoutState.sessionStartTime && workoutState.sessionStartTime[dayId]) {
      const sTime = workoutState.sessionStartTime[dayId];
      if (Date.now() - sTime < 12 * 3600 * 1000) return true;
    }
    // 2. Al menos una serie completada para este día
    const dayData = ROUTINE_SLOTS[dayId];
    if (dayData && Array.isArray(dayData.slots) && Array.isArray(workoutState.completed)) {
      for (const slot of dayData.slots) {
        if (workoutState.completed.some(c => c && c.startsWith(slot.slotId + '_'))) {
          return true;
        }
      }
    }
    return false;
  }

  function getActiveWorkoutDay() {
    if (typeof workoutState === 'undefined' || !workoutState) return null;
    if (typeof ROUTINE_SLOTS === 'undefined' || !ROUTINE_SLOTS) return null;

    // Prioridad 1: Día con sessionStartTime activo reciente
    if (workoutState.sessionStartTime) {
      let latestTime = 0;
      let foundDay = null;
      for (const [dayId, sTime] of Object.entries(workoutState.sessionStartTime)) {
        if (sTime && ROUTINE_SLOTS[dayId] && (Date.now() - sTime < 12 * 3600 * 1000)) {
          if (sTime > latestTime) {
            latestTime = sTime;
            foundDay = dayId;
          }
        }
      }
      if (foundDay) return foundDay;
    }

    // Prioridad 2: Sección activa en pantalla si tiene series completadas
    const activeSection = document.querySelector('.day-content.active');
    if (activeSection && isWorkoutActive(activeSection.id)) {
      return activeSection.id;
    }

    // Prioridad 3: Selector de día si tiene series completadas
    const sel = document.getElementById('daySelector');
    if (sel && isWorkoutActive(sel.value)) {
      return sel.value;
    }

    // Sin entreno activo: no forzar fallbacks falsos
    return null;
  }

  function computeBroadcastHash(payload) {
    if (!payload.workoutActive) {
      return JSON.stringify({ active: false });
    }
    return JSON.stringify({
      active: true,
      d: payload.activeDayId,
      c: (workoutState.completed || []).length,
      s: payload.currentSlotIndex,
      set: payload.currentSetIndex,
      rtActive: !!(payload.restTimer && payload.restTimer.active),
      rtEnd: payload.restTimer && payload.restTimer.active ? payload.restTimer.endTime : 0,
      logged: payload.sessionLoggedSets,
      overrides: payload.slotExOverrides,
      start: payload.sessionStartTime || 0
    });
  }

  // Planificador con debounce de 1.5s y coalescencia para no saturar ntfy.sh
  function scheduleBroadcast(delay = 1500) {
    clearTimeout(broadcastDebounceTimer);
    broadcastDebounceTimer = setTimeout(() => {
      broadcastDebounceTimer = null;
      broadcastActiveWorkoutToWatch();
    }, delay);
  }

  // 1. Enviar el estado del entrenamiento activo del móvil al reloj
  function broadcastActiveWorkoutToWatch() {
    if (typeof workoutState === 'undefined' || !workoutState) return;

    // Respetar tiempo de espera si hay rate limit activo (HTTP 429)
    if (Date.now() < rateLimitResetTime) {
      hasPendingBroadcast = true;
      const waitSec = Math.ceil((rateLimitResetTime - Date.now()) / 1000);
      updateSyncPillStatus('rate_limited', waitSec);
      return;
    }

    // Coalescencia: si ya hay una petición HTTP en vuelo, marcar pendiente para emitir al terminar
    if (isBroadcasting) {
      hasPendingBroadcast = true;
      return;
    }

    // Ritmo sostenido: máximo ~1 petición cada 3 segundos
    const timeSinceLast = Date.now() - lastBroadcastTime;
    if (timeSinceLast < 3000 && lastBroadcastTime > 0) {
      hasPendingBroadcast = true;
      clearTimeout(broadcastDebounceTimer);
      broadcastDebounceTimer = setTimeout(() => {
        broadcastDebounceTimer = null;
        broadcastActiveWorkoutToWatch();
      }, 3000 - timeSinceLast);
      return;
    }

    try {
      const activeDay = getActiveWorkoutDay();
      const workoutActive = !!(activeDay && isWorkoutActive(activeDay));

      const recDay = (typeof getNextRecommendedDay === 'function')
        ? getNextRecommendedDay()
        : 'fullbodyA';

      let payload;
      if (!workoutActive) {
        // Estado reposo: sin entreno activo, hash constante => 0 peticiones
        payload = {
          workoutActive: false,
          activeDayId: null,
          recommendedDayId: recDay,
          sessionId: null,
          rev: getCurrentRev(),
          timestamp: Date.now()
        };
      } else {
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

        // Filtrar previousSets solo para los ejercicios del día activo
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

        const sessionId = getOrCreateSessionId(activeDay);
        payload = {
          workoutActive: true,
          sessionId: sessionId,
          rev: getCurrentRev() + 1,
          activeDayId: activeDay,
          recommendedDayId: recDay,
          currentSlotIndex: firstUnfinishedSlot,
          currentSetIndex: firstUnfinishedSet,
          sessionStartTime: (workoutState.sessionStartTime && workoutState.sessionStartTime[activeDay]) || null,
          sessionLoggedSets: sessionLoggedSets,
          slotExOverrides: Object.assign({}, workoutState.customSlots, workoutState.tempSlots),
          previousSets: filteredPrevious,
          restTimer: restTimerPayload,
          timestamp: Date.now()
        };
      }

      const hash = computeBroadcastHash(payload);

      // Si el contenido relevante no ha variado y no hay envío pendiente, no hacer POST
      if (hash === lastBroadcastHash && !hasPendingBroadcast) return;

      const envelope = {
        v: 1,
        id: `web-snap-${payload.sessionId || 'idle'}-${payload.rev}`,
        type: 'STATE_SNAPSHOT',
        ts: Date.now(),
        src: 'web',
        ...payload,
        payload: payload
      };

      isBroadcasting = true;
      updateSyncPillStatus('pending');

      fetch(RELAY_PHONE_TO_WATCH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope)
      }).then(resp => {
        if (resp.status === 429) {
          const retryHeader = resp.headers ? resp.headers.get('Retry-After') : null;
          const retrySec = parseInt(retryHeader, 10) || 60;
          rateLimitResetTime = Date.now() + (retrySec * 1000);
          hasPendingBroadcast = true;
          updateSyncPillStatus('rate_limited', retrySec);
          setTimeout(() => {
            scheduleBroadcast(0);
          }, retrySec * 1000);
          return;
        }

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }

        // Éxito: guardar hash únicamente tras confirmación 2xx del relay
        lastBroadcastHash = hash;
        lastBroadcastTime = Date.now();
        broadcastRetryCount = 0;
        if (payload.workoutActive) getNextRev();
        updateSyncPillStatus('synced');

        if (hasPendingBroadcast) {
          hasPendingBroadcast = false;
          scheduleBroadcast(1500);
        }
      }).catch(err => {
        console.log('[WatchBridge] Error enviando estado al reloj:', err);
        hasPendingBroadcast = true;
        broadcastRetryCount++;
        const backoffSec = Math.min(60, Math.pow(2, Math.min(5, broadcastRetryCount)) * 2);
        updateSyncPillStatus('error');
        setTimeout(() => {
          scheduleBroadcast(0);
        }, backoffSec * 1000);
      }).finally(() => {
        isBroadcasting = false;
      });

    } catch (e) {
      console.log('[WatchBridge] Error construyendo broadcast:', e);
      isBroadcasting = false;
    }
  }

  let reconnectTimeout = null;
  const CATCHUP_MAX_AGE_MS = 12 * 60 * 60 * 1000; // Ventana máxima de 12 horas en ntfy.sh
  const PROCESSED_IDS_KEY = 'vigorexiapp_processed_msg_ids';
  const LAST_NTFY_ID_KEY = 'vigorexiapp_last_ntfy_id';

  function getProcessedMsgIds() {
    try {
      const raw = localStorage.getItem(PROCESSED_IDS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
  }

  function isMsgProcessed(id) {
    if (!id) return false;
    const list = getProcessedMsgIds();
    return list.includes(id);
  }

  function markMsgProcessed(id) {
    if (!id) return;
    let list = getProcessedMsgIds();
    if (!list.includes(id)) {
      list.push(id);
      if (list.length > 500) list = list.slice(list.length - 500); // Mantener los últimos 500
      try { localStorage.setItem(PROCESSED_IDS_KEY, JSON.stringify(list)); } catch (e) {}
    }
  }

  function getLastNtfyId() {
    return localStorage.getItem(LAST_NTFY_ID_KEY) || null;
  }

  function setLastNtfyId(ntfyId) {
    if (!ntfyId) return;
    try { localStorage.setItem(LAST_NTFY_ID_KEY, String(ntfyId)); } catch (e) {}
  }

  function unboxWatchMessage(raw) {
    if (!raw) return null;
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const type = data.type || (data.payload && data.payload.type);
    const payload = data.payload || data;

    // Obtener id estable o derivar clave para compatibilidad hacia atrás
    let id = data.id;
    if (!id) {
      if (type === 'SET_COMPLETED') {
        const slot = payload.slotId || data.slotId || '';
        const sIdx = payload.setIndex !== undefined ? payload.setIndex : data.setIndex;
        const kg = payload.kg !== undefined ? payload.kg : data.kg;
        const reps = payload.reps !== undefined ? payload.reps : data.reps;
        id = `legacy-set-${slot}_${sIdx}-${kg}x${reps}`;
      } else if (type === 'WORKOUT_FINISHED') {
        const sum = payload.summary || payload;
        const sId = sum.sessionId || sum.dayId || 'fin';
        const dStr = sum.date || data.timestamp || '';
        id = `legacy-fin-${sId}-${dStr}`;
      } else {
        id = `legacy-unk-${Date.now()}`;
      }
    }

    return {
      id: id,
      type: type,
      ts: data.ts || data.timestamp || Date.now(),
      payload: payload
    };
  }

  function insertSessionSorted(record) {
    if (!Array.isArray(workoutState.sessions)) workoutState.sessions = [];
    const ts = new Date(record.date).getTime();
    const idx = workoutState.sessions.findIndex(s => new Date(s.date).getTime() < ts);
    if (idx === -1) workoutState.sessions.push(record);
    else workoutState.sessions.splice(idx, 0, record);
  }

  async function catchUpFromWatch() {
    try {
      const lastNtfyId = getLastNtfyId();
      // Si tenemos id previo de ntfy, pedir since=<id>; si no, pedir since=12h
      const sinceParam = lastNtfyId ? encodeURIComponent(lastNtfyId) : '12h';
      const resp = await fetch(`${RELAY_WATCH_TO_PHONE}/json?poll=1&since=${sinceParam}`, { cache: 'no-store' });
      if (!resp.ok) return;
      const text = await resp.text();
      if (!text) return;
      const lines = text.trim().split('\n');
      for (const line of lines) {
        try {
          const raw = JSON.parse(line);
          if (raw && raw.id) {
            setLastNtfyId(raw.id);
          }
          if (raw && raw.event === 'message' && raw.message) {
            const data = typeof raw.message === 'string' ? JSON.parse(raw.message) : raw.message;
            if (!data) continue;

            const ts = data.ts || data.timestamp || 0;
            // Descartar mensajes más viejos que 12 horas
            if (ts > 0 && Date.now() - ts > CATCHUP_MAX_AGE_MS) continue;

            const isFresh = ts > 0 && (Date.now() - ts < 120000);
            const type = data.type || (data.payload && data.payload.type);

            if (type === 'SET_COMPLETED') {
              handleSetCompletedFromWatch(data, { silent: !isFresh });
            } else if (type === 'WORKOUT_FINISHED') {
              handleWorkoutFinishedFromWatch(data, { silent: !isFresh });
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
          if (raw && raw.id) {
            setLastNtfyId(raw.id);
          }
          if (!raw.message) return;
          const data = typeof raw.message === 'string' ? JSON.parse(raw.message) : raw.message;

          const type = data.type || (data.payload && data.payload.type);
          if (type === 'SET_COMPLETED') {
            handleSetCompletedFromWatch(data);
          } else if (type === 'WORKOUT_FINISHED') {
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

  // 3. Manejar serie completada en el reloj con persistencia directa en workoutState
  function handleSetCompletedFromWatch(eventData, opts = {}) {
    const unboxed = unboxWatchMessage(eventData);
    if (!unboxed) return false;
    const { id, payload, ts } = unboxed;

    // 1. Deduplicación por id de mensaje
    if (isMsgProcessed(id)) {
      console.log('[WatchBridge] Serie ya procesada previamente, ignorando duplicado:', id);
      return true;
    }

    const slotId = payload.slotId;
    const setIndex = payload.setIndex;
    const kg = payload.kg;
    const reps = payload.reps;
    const dayId = payload.dayId;
    const completedAt = payload.completedAt || ts;

    if (!slotId || setIndex === undefined) return false;

    console.log('[WatchBridge] Procesando serie del reloj:', id, slotId, setIndex, kg, reps);

    // 2. Aplicar directamente a workoutState para que NO se pierda si la tarjeta no está en el DOM
    if (typeof workoutState !== 'undefined' && workoutState) {
      if (!workoutState.inputs) workoutState.inputs = {};
      if (!Array.isArray(workoutState.completed)) workoutState.completed = [];

      const rowKey = `${slotId}_${setIndex}`;
      if (kg !== undefined && kg !== null && kg !== '') {
        workoutState.inputs[`${rowKey}_kg`] = String(kg);
      }
      if (reps !== undefined && reps !== null && reps !== '') {
        workoutState.inputs[`${rowKey}_reps`] = String(reps);
      }
      if (!workoutState.completed.includes(rowKey)) {
        workoutState.completed.push(rowKey);
      }

      // Marcar sessionStartTime si no existía para este día
      if (dayId && (!workoutState.sessionStartTime || !workoutState.sessionStartTime[dayId])) {
        if (!workoutState.sessionStartTime) workoutState.sessionStartTime = {};
        workoutState.sessionStartTime[dayId] = completedAt || Date.now();
      }

      // Guardar inmediatamente en localStorage
      if (typeof persistStateRaw === 'function') {
        persistStateRaw();
      }
    }

    // 3. Actualizar la tarjeta en el DOM si está renderizada
    const card = document.querySelector(`.exercise-card[data-slot="${slotId}"]`);
    if (card) {
      const rows = card.querySelectorAll('.set-row');
      const targetRow = rows[setIndex];
      if (targetRow) {
        const kgInp = targetRow.querySelector('.input-kg');
        const repsInp = targetRow.querySelector('.input-reps');
        if (kgInp && kg !== undefined && kg !== null && kg !== '') kgInp.value = kg;
        if (repsInp && reps !== undefined && reps !== null && reps !== '') repsInp.value = reps;
        targetRow.classList.add('done');

        if (typeof updateRow1RMBadge === 'function') {
          updateRow1RMBadge(targetRow);
        }
      }

      if (typeof checkExerciseCardCompletion === 'function') {
        checkExerciseCardCompletion(card);
      }

      // Iniciar temporizador de descanso en la web (solo si es evento fresco en directo)
      if (!opts.silent && typeof startRestTimerFromCard === 'function') {
        startRestTimerFromCard(card);
      }
    }

    if (typeof updateProgress === 'function') {
      updateProgress();
    }

    // 4. Marcar mensaje como procesado con éxito
    markMsgProcessed(id);

    // Notificación visual flotante en la pantalla del móvil
    if (!opts.silent) {
      showWatchToast(`⌚ Serie ${setIndex + 1} completada en el reloj (${kg}kg × ${reps})`);
    }

    return true;
  }

  // 4. Manejar fin de entreno desde el reloj con deduplicación idempotente por sessionId
  function handleWorkoutFinishedFromWatch(eventData, opts = {}) {
    const unboxed = unboxWatchMessage(eventData);
    if (!unboxed) return false;
    const { id, payload, ts } = unboxed;

    if (isMsgProcessed(id)) {
      console.log('[WatchBridge] Fin de entreno ya procesado previamente, ignorando duplicado:', id);
      return true;
    }

    const summary = payload.summary || payload;
    if (!summary || !summary.dayId) return false;

    const sessionId = payload.sessionId || summary.sessionId || id;

    // Idempotencia: comprobar si la sesión ya existe en el historial
    if (typeof workoutState !== 'undefined' && Array.isArray(workoutState.sessions)) {
      const alreadyExists = workoutState.sessions.some(s => s && (s.sessionId === sessionId || s.id === sessionId));
      if (alreadyExists) {
        markMsgProcessed(id);
        return true;
      }
    }

    console.log('[WatchBridge] Fin de entreno recibido desde el reloj:', id, sessionId);
    try {
      const durMin = summary.durationMinutes || 45;
      const durationFormatted = durMin >= 60 
        ? `${Math.floor(durMin / 60)}h ${durMin % 60}m` 
        : `${durMin} min`;

      const record = {
        id: sessionId,
        sessionId: sessionId,
        date: summary.date || new Date(ts).toISOString(),
        dayId: summary.dayId,
        dayName: summary.dayName || summary.dayId,
        durationMinutes: durMin,
        durationFormatted: durationFormatted,
        exercises: summary.exercises || []
      };

      insertSessionSorted(record);

      if (workoutState.sessionStartTime) delete workoutState.sessionStartTime[summary.dayId];
      if (workoutState.lastActivityTime) delete workoutState.lastActivityTime[summary.dayId];
      if (workoutState.sessionIds) delete workoutState.sessionIds[summary.dayId];

      // Actualizar marcas "Anterior" con los ejercicios completados en el reloj
      if (Array.isArray(summary.exercises)) {
        if (!workoutState.previous) workoutState.previous = {};
        summary.exercises.forEach(ex => {
          if (!ex.exId || !Array.isArray(ex.sets)) return;
          if (!workoutState.previous[ex.exId]) workoutState.previous[ex.exId] = {};
          ex.sets.forEach((st, sIdx) => {
            if (st && (st.kg !== undefined || st.reps !== undefined)) {
              workoutState.previous[ex.exId][sIdx] = `${st.kg}kg × ${st.reps}`;
            }
          });
        });
      }

      // Limpiar el estado visual de las casillas del día terminado
      const daySection = document.getElementById(summary.dayId);
      if (daySection) {
        daySection.querySelectorAll('.exercise-card').forEach(card => {
          card.classList.remove('exercise-completed', 'manually-expanded');
          card.querySelectorAll('.set-row').forEach(row => {
            row.classList.remove('done');
            const inputs = row.querySelectorAll('.set-input');
            if (inputs[0]) inputs[0].value = '';
            if (inputs[1]) inputs[1].value = '';
          });
        });
      }

      // Limpiar en workoutState las series completadas del día archivado
      const dayData = typeof ROUTINE_SLOTS !== 'undefined' && ROUTINE_SLOTS[summary.dayId];
      if (dayData && dayData.slots && Array.isArray(workoutState.completed)) {
        dayData.slots.forEach(slot => {
          workoutState.completed = workoutState.completed.filter(c => !c.startsWith(slot.slotId + '_'));
          if (workoutState.inputs) {
            Object.keys(workoutState.inputs).forEach(k => {
              if (k.startsWith(slot.slotId + '_')) delete workoutState.inputs[k];
            });
          }
        });
      }

      // Cancelar temporizador de descanso si estaba activo
      if (typeof finishTimer === 'function' && typeof isTimerActive !== 'undefined' && isTimerActive) {
        finishTimer();
      }

      if (typeof persistStateRaw === 'function') persistStateRaw();
      if (typeof updateProgress === 'function') updateProgress();
      if (typeof renderDaySelectorOptions === 'function') renderDaySelectorOptions();
      if (typeof updateDayBannerLastDone === 'function') updateDayBannerLastDone(summary.dayId);

      // Marcar mensaje como procesado con éxito
      markMsgProcessed(id);

      // Si fue una finalización fresca en directo, sugerir siguiente día y abrir Flex Card
      if (!opts.silent) {
        if (typeof getNextRecommendedDay === 'function' && typeof selectDay === 'function') {
          const nextDay = getNextRecommendedDay();
          if (nextDay) selectDay(nextDay);
        }
        if (typeof openWorkoutSummaryModal === 'function') {
          openWorkoutSummaryModal(record);
        }
      }
    } catch (e) {
      console.warn('[WatchBridge] Error archivando sesión del reloj:', e);
    }

    const durText = (summary && summary.durationMinutes) ? ` (${summary.durationMinutes} min)` : '';
    if (!opts.silent) {
      showWatchToast(`⌚ ¡Entrenamiento completado y guardado desde el reloj!${durText}`);
    }
    if (typeof loadWorkoutState === 'function') {
      loadWorkoutState();
    }

    return true;
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
  let currentSyncStatus = 'disconnected'; // 'synced' | 'pending' | 'disconnected' | 'rate_limited' | 'error'

  function updateSyncPillStatus(state, extra) {
    if (state) currentSyncStatus = state;
    renderSyncPill(extra);
  }

  function updateSyncPill(connected) {
    currentSyncStatus = connected ? 'synced' : 'disconnected';
    renderSyncPill();
  }

  function renderSyncPill(extra) {
    let pill = document.getElementById('watchSyncPill');
    if (!pill) {
      const headerContainer = document.querySelector('.header-content, .app-header');
      if (headerContainer) {
        pill = document.createElement('div');
        pill.id = 'watchSyncPill';
        pill.style.cssText = 'display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:4px 8px;border-radius:12px;background:rgba(15,23,42,0.9);border:1px solid rgba(56,189,248,0.4);color:#94a3b8;cursor:pointer;white-space:nowrap;user-select:none;margin-left:auto;';
        pill.onclick = () => {
          showWatchToast('⌚ Forzando sincronización con el reloj...');
          rateLimitResetTime = 0; // Resetear bloqueo local al pulsar manualmente
          scheduleBroadcast(0);
          catchUpFromWatch();
        };
        headerContainer.appendChild(pill);
      }
    }
    if (!pill) return;

    if (currentSyncStatus === 'synced') {
      pill.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b981;"></span> Sincronizado';
      pill.style.color = '#38bdf8';
      pill.style.borderColor = 'rgba(16,185,129,0.4)';
      pill.title = 'Sincronización activa con Amazfit Active 2';
    } else if (currentSyncStatus === 'pending') {
      pill.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#fbbf24;box-shadow:0 0 8px #fbbf24;"></span> Pendiente…';
      pill.style.color = '#fbbf24';
      pill.style.borderColor = 'rgba(251,191,36,0.4)';
      pill.title = 'Enviando actualización al reloj…';
    } else if (currentSyncStatus === 'rate_limited') {
      const sec = extra || 60;
      pill.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:#f59e0b;"></span> Límite (${sec}s)`;
      pill.style.color = '#f59e0b';
      pill.style.borderColor = 'rgba(245,158,11,0.5)';
      pill.title = `Límite de peticiones alcanzado. Reintento en ${sec} segundos.`;
    } else if (currentSyncStatus === 'error') {
      pill.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#ef4444;"></span> Error sync';
      pill.style.color = '#f87171';
      pill.style.borderColor = 'rgba(239,68,68,0.5)';
      pill.title = 'Fallo al conectar con el servidor de sincronización. Toca para reintentar.';
    } else {
      pill.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#64748b;"></span> Sin conexión';
      pill.style.color = '#94a3b8';
      pill.style.borderColor = 'rgba(100,116,139,0.3)';
      pill.title = 'Canal SSE desconectado. Toca para reconectar.';
    }
  }

  // Hooking en saveWorkoutState para emitir actualización con debounce de 1.5s
  const originalSave = window.saveWorkoutState;
  if (typeof originalSave === 'function') {
    window.saveWorkoutState = function(...args) {
      const res = originalSave.apply(this, args);
      scheduleBroadcast(1500);
      return res;
    };
  }

  // Hooking en saveRestTimerState para emitir inicio y cambio de descanso al reloj
  const origSaveRestTimer = window.saveRestTimerState;
  if (typeof origSaveRestTimer === 'function') {
    window.saveRestTimerState = function(...args) {
      const res = origSaveRestTimer.apply(this, args);
      scheduleBroadcast(500);
      return res;
    };
  }

  // Iniciar al cargar la página y cuando la app vuelve a primer plano
  function onAppForeground() {
    startListeningToWatchEvents();
    catchUpFromWatch();
    scheduleBroadcast(500);
  }

  window.addEventListener('DOMContentLoaded', () => {
    startListeningToWatchEvents();
    catchUpFromWatch();
    scheduleBroadcast(1200);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        onAppForeground();
      }
    });

    window.addEventListener('focus', onAppForeground);
  });

  // Exponer API global
  window.VigorexiWatchSync = {
    broadcast: () => scheduleBroadcast(0),
    reconnect: onAppForeground,
    catchUp: catchUpFromWatch
  };
})();
