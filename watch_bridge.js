/**
 * VigorexiApp - Watch Live Sync Bridge
 * Conexión en tiempo real con el Amazfit Active 2 (Zepp OS) vía relay de sincronización ntfy.sh
 * Permite uso mixto: completar series en el móvil o en el reloj indistintamente.
 */
(function() {
  const SYNC_CODE_KEY = 'vigorexiapp_sync_code';
  const SYNC_SERVER_KEY = 'vigorexiapp_sync_server';
  const SYNC_TOKEN_KEY = 'vigorexiapp_sync_token';
  const DEFAULT_SYNC_CODE = 'vigorexi_danicb99_7f3a91c4e2b8';
  const LAST_NTFY_ID_KEY = 'vigorexiapp_last_ntfy_id';

  function deriveTopicHash(code) {
    const str = String(code || '').trim() || DEFAULT_SYNC_CODE;
    let h1 = 0x811c9dc5;
    let h2 = 0x9e3779b9;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 ^= ch;
      h1 = Math.imul(h1, 0x01000193);
      h2 ^= ch;
      h2 = Math.imul(h2, 0x5bd1e995);
    }
    const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
    const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
    return (hex1 + hex2).toLowerCase();
  }

  function getSyncConfig() {
    const code = localStorage.getItem(SYNC_CODE_KEY) || DEFAULT_SYNC_CODE;
    const server = (localStorage.getItem(SYNC_SERVER_KEY) || 'https://ntfy.sh').replace(/\/+$/, '');
    const token = localStorage.getItem(SYNC_TOKEN_KEY) || '';
    const isDefault = code === DEFAULT_SYNC_CODE;
    const hash = deriveTopicHash(code);
    return {
      code,
      server,
      token,
      isDefault,
      hash,
      phoneToWatch: `${server}/vigorexi_${hash}_p2w`,
      watchToPhone: `${server}/vigorexi_${hash}_w2p`
    };
  }

  let activeConfig = getSyncConfig();
  let RELAY_WATCH_TO_PHONE = activeConfig.watchToPhone;
  let RELAY_PHONE_TO_WATCH = activeConfig.phoneToWatch;

  function reloadSyncConfig() {
    const previousWatchTopic = RELAY_WATCH_TO_PHONE;
    const previousPhoneTopic = RELAY_PHONE_TO_WATCH;
    const previousToken = activeConfig.token;
    activeConfig = getSyncConfig();
    RELAY_WATCH_TO_PHONE = activeConfig.watchToPhone;
    RELAY_PHONE_TO_WATCH = activeConfig.phoneToWatch;

    const endpointChanged = previousWatchTopic !== RELAY_WATCH_TO_PHONE ||
      previousPhoneTopic !== RELAY_PHONE_TO_WATCH ||
      previousToken !== activeConfig.token;
    if (!endpointChanged) return;

    // El canal SSE y el cursor de ntfy pertenecen al topic anterior:
    // cerrarlos y forzar un snapshot nuevo en el topic recién configurado.
    if (syncEventSource) {
      try { syncEventSource.close(); } catch (e) {}
      syncEventSource = null;
    }
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
    clearTimeout(broadcastDebounceTimer);
    broadcastDebounceTimer = null;
    hasPendingBroadcast = false;
    isBroadcasting = false;
    lastBroadcastHash = '';
    lastBroadcastTime = 0;
    rateLimitResetTime = 0;
    broadcastRetryCount = 0;
    try { localStorage.removeItem(LAST_NTFY_ID_KEY); } catch (e) {}
  }

  function getAuthHeaders() {
    const headers = {};
    if (activeConfig.token && activeConfig.token.trim()) {
      headers['Authorization'] = `Bearer ${activeConfig.token.trim()}`;
    }
    return headers;
  }

  function generateSecureSyncCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    if (window.crypto && window.crypto.getRandomValues) {
      const values = new Uint8Array(28);
      window.crypto.getRandomValues(values);
      for (let i = 0; i < values.length; i++) {
        result += chars[values[i] % chars.length];
      }
    } else {
      for (let i = 0; i < 28; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    return result;
  }
  
  let syncEventSource = null;
  let isBroadcasting = false;
  let hasPendingBroadcast = false;
  let lastBroadcastHash = '';
  let lastBroadcastTime = 0;
  let lastSuccessfulBroadcastTime = 0;
  let lastSuccessfulReceiveTime = 0;
  let lastSuccessfulSyncTime = 0;
  let isSseConnected = false;
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
    const now = Date.now();
    const MAX_AGE = 12 * 3600 * 1000; // 12 horas máximo de validez

    // Solo hay entreno activo si queda alguna serie completada de ese día.
    // sessionStartTime/lastActivityTime por sí solos no bastan: tras archivar
    // el día pueden quedar restos y generar una sesión fantasma en el reloj.
    const completed = new Set(Array.isArray(workoutState.completed) ? workoutState.completed : []);
    if (completed.size === 0 || !workoutState.setTimestamps) return false;

    // Solo cuentan las filas de los slots de este día, no las de otro entreno.
    const daySlots = Array.isArray(ROUTINE_SLOTS[dayId].slots) ? ROUTINE_SLOTS[dayId].slots : [];
    const prefixes = daySlots.map(slot => slot && slot.slotId).filter(Boolean).map(slotId => slotId + '_');

    for (const rowId of completed) {
      if (prefixes.length > 0 && !prefixes.some(prefix => rowId.startsWith(prefix))) continue;
      const ts = workoutState.setTimestamps[rowId];
      if (ts && (now - ts < MAX_AGE)) return true;
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
        if (sTime && ROUTINE_SLOTS[dayId] && isWorkoutActive(dayId) && (Date.now() - sTime < 12 * 3600 * 1000)) {
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
              const setTs = (workoutState.setTimestamps && workoutState.setTimestamps[rowId]) 
                || (workoutState.sessionStartTime && workoutState.sessionStartTime[activeDay]) 
                || Date.now();
              sessionLoggedSets[slot.slotId][sIdx] = {
                kg: Number(kg),
                reps: Number(reps),
                completed: true,
                completedAt: setTs
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
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(envelope),
        cache: 'no-store'
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
        lastSuccessfulBroadcastTime = Date.now();
        lastSuccessfulSyncTime = Date.now();
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

  function mergeSessionSets(existingSets, incomingSets) {
    const bySet = new Map();
    const addSets = (sets) => {
      if (!Array.isArray(sets)) return;
      sets.forEach((st, idx) => {
        if (!st || typeof st !== 'object') return;
        const setNum = Number.isFinite(Number(st.set)) ? Number(st.set) : idx + 1;
        const prev = bySet.get(setNum);
        if (!prev) {
          bySet.set(setNum, Object.assign({}, st, { set: setNum }));
          return;
        }
        const prevCompleted = prev.completed === true;
        const stCompleted = st.completed === true;
        const prevTs = Number(prev.completedAt || prev.timestamp || 0);
        const stTs = Number(st.completedAt || st.timestamp || 0);
        let chosen;
        if (prevCompleted && !stCompleted) chosen = prev;
        else if (stCompleted && !prevCompleted) chosen = st;
        else if (stTs > prevTs) chosen = st;
        else if (prevTs > stTs) chosen = prev;
        else chosen = st;
        const merged = Object.assign({}, prev, chosen, { set: setNum });
        const other = chosen === st ? prev : st;
        if ((merged.kg === undefined || merged.kg === null || merged.kg === '') && other.kg !== undefined) merged.kg = other.kg;
        if ((merged.reps === undefined || merged.reps === null || merged.reps === '') && other.reps !== undefined) merged.reps = other.reps;
        if (!merged.notes && other.notes) merged.notes = other.notes;
        merged.completed = prevCompleted || stCompleted;
        if (prevTs || stTs) merged.timestamp = Math.max(prevTs, stTs);
        bySet.set(setNum, merged);
      });
    };
    addSets(existingSets);
    addSets(incomingSets);
    return Array.from(bySet.values()).sort((a, b) => a.set - b.set);
  }

  function mergeSessionExercises(existingExercises, incomingExercises) {
    const merged = Array.isArray(existingExercises)
      ? existingExercises.map(ex => Object.assign({}, ex, { sets: mergeSessionSets([], ex && ex.sets) }))
      : [];
    (Array.isArray(incomingExercises) ? incomingExercises : []).forEach(inEx => {
      if (!inEx || !inEx.exId) return;
      const target = merged.find(ex => ex && ex.exId === inEx.exId && (!inEx.slotId || ex.slotId === inEx.slotId))
        || merged.find(ex => ex && ex.exId === inEx.exId);
      if (!target) {
        merged.push(Object.assign({}, inEx, { sets: mergeSessionSets([], inEx.sets) }));
        return;
      }
      if (!target.name && inEx.name) target.name = inEx.name;
      if (!target.slotId && inEx.slotId) target.slotId = inEx.slotId;
      if (inEx.notes && !target.notes) target.notes = inEx.notes;
      target.sets = mergeSessionSets(target.sets, inEx.sets);
      target.bestKg = Math.max(Number(target.bestKg) || 0, Number(inEx.bestKg) || 0);
      target.bestReps = Math.max(Number(target.bestReps) || 0, Number(inEx.bestReps) || 0);
      target.best1RM = Math.max(Number(target.best1RM) || 0, Number(inEx.best1RM) || 0);
    });
    return merged;
  }

  function insertSessionSorted(record) {
    if (!Array.isArray(workoutState.sessions)) workoutState.sessions = [];
    const ts = new Date(record.date).getTime();

    // Deduplicación por ID exacto
    if (record.id && workoutState.sessions.some(s => s.id === record.id || s.sessionId === record.id)) return;
    if (record.sessionId && workoutState.sessions.some(s => s.sessionId === record.sessionId || s.id === record.sessionId)) return;

    // Deduplicación por ventana temporal (mismo día y < 45 min)
    const duplicateIdx = workoutState.sessions.findIndex(s => {
      if (s.dayId !== record.dayId) return false;
      const diff = Math.abs(new Date(s.date).getTime() - ts);
      return diff < 45 * 60 * 1000;
    });
    if (duplicateIdx !== -1) {
      const existing = workoutState.sessions[duplicateIdx];
      existing.exercises = mergeSessionExercises(existing.exercises, record.exercises);
      existing.durationMinutes = Math.max(Number(existing.durationMinutes) || 0, Number(record.durationMinutes) || 0);
      if (!existing.dayName && record.dayName) existing.dayName = record.dayName;
      if (!existing.durationFormatted && record.durationFormatted) existing.durationFormatted = record.durationFormatted;
      if (record.sessionId && !existing.sessionId) existing.sessionId = record.sessionId;
      if (record.id && !existing.id) existing.id = record.id;
      const existingTs = new Date(existing.date).getTime();
      if (Number.isFinite(ts) && (!Number.isFinite(existingTs) || ts > existingTs)) existing.date = record.date;
      return existing;
    }

    const idx = workoutState.sessions.findIndex(s => new Date(s.date).getTime() < ts);
    if (idx === -1) workoutState.sessions.push(record);
    else workoutState.sessions.splice(idx, 0, record);
    return record;
  }

  function registerSessionHistory(record) {
    if (!record || !Array.isArray(record.exercises)) return;
    if (!workoutState.exerciseHistory || typeof workoutState.exerciseHistory !== 'object' || Array.isArray(workoutState.exerciseHistory)) {
      workoutState.exerciseHistory = {};
    }
    const recordTs = new Date(record.date).getTime();
    const recordIds = [record.sessionId, record.id].filter(Boolean);

    record.exercises.forEach(ex => {
      if (!ex || !ex.exId || !Array.isArray(ex.sets)) return;
      const setsLog = [];
      let bestKg = 0;
      let bestReps = 0;
      let best1RM = 0;
      ex.sets.forEach((st, idx) => {
        if (!st || st.completed === false) return;
        const kgNum = parseFloat(st.kg) || 0;
        const repsNum = parseInt(st.reps, 10) || 0;
        if (kgNum === 0 && repsNum === 0) return;
        const exData = typeof EXERCISE_CATALOG !== 'undefined' ? EXERCISE_CATALOG[ex.exId] : null;
        const isIso = exData && exData.metricType === 'isometria';
        const est1RM = (!isIso && repsNum > 0)
          ? (typeof calculate1RM === 'function' ? calculate1RM(kgNum, repsNum) : Math.round(kgNum * (1 + repsNum / 30) * 10) / 10)
          : (isIso ? 0 : kgNum);
        const setNum = Number.isFinite(Number(st.set)) ? Number(st.set) : idx + 1;
        setsLog.push({ set: setNum, kg: kgNum, reps: repsNum, est1RM: est1RM });
        if (kgNum > bestKg) {
          bestKg = kgNum;
          bestReps = repsNum;
        }
        if (est1RM > best1RM) best1RM = est1RM;
      });
      if (!setsLog.length) return;

      if (!workoutState.exerciseHistory[ex.exId]) workoutState.exerciseHistory[ex.exId] = [];
      const history = workoutState.exerciseHistory[ex.exId];
      let target = recordIds.length
        ? history.find(h => h && recordIds.includes(h.sessionId))
        : null;
      if (!target && Number.isFinite(recordTs)) {
        target = history.find(h => {
          if (!h || !h.date) return false;
          const hTs = new Date(h.date).getTime();
          return Number.isFinite(hTs) && Math.abs(hTs - recordTs) < 45 * 60 * 1000;
        });
      }

      if (target) {
        target.sets = mergeSessionSets(target.sets, setsLog);
        target.bestKg = Math.max(Number(target.bestKg) || 0, bestKg);
        target.bestReps = Math.max(Number(target.bestReps) || 0, bestReps);
        target.best1RM = Math.max(Number(target.best1RM) || 0, best1RM);
        if (!target.sessionId && recordIds.length) target.sessionId = recordIds[0];
        if (ex.notes && !target.notes) target.notes = ex.notes;
        if (!target.date) target.date = record.date;
        return;
      }

      history.push({
        date: record.date,
        sessionId: recordIds[0] || '',
        sets: setsLog,
        bestKg: bestKg,
        bestReps: bestReps,
        best1RM: best1RM,
        notes: ex.notes || ''
      });
    });
  }

  function clearSetTimestampsForDay(dayId) {
    if (typeof workoutState === 'undefined' || !workoutState || !workoutState.setTimestamps) return;
    const dayData = typeof ROUTINE_SLOTS !== 'undefined' ? ROUTINE_SLOTS[dayId] : null;
    if (!dayData || !Array.isArray(dayData.slots)) return;
    dayData.slots.forEach(slot => {
      const prefix = slot.slotId + '_';
      Object.keys(workoutState.setTimestamps).forEach(key => {
        if (key.startsWith(prefix)) delete workoutState.setTimestamps[key];
      });
    });
  }

  async function catchUpFromWatch() {
    try {
      const lastNtfyId = getLastNtfyId();
      // Si tenemos id previo de ntfy, pedir since=<id>; si no, pedir since=12h
      const sinceParam = lastNtfyId ? encodeURIComponent(lastNtfyId) : '12h';
      const resp = await fetch(`${RELAY_WATCH_TO_PHONE}/json?poll=1&since=${sinceParam}`, {
        headers: {
          ...getAuthHeaders()
        },
        cache: 'no-store'
      });
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

            const ntfyTime = raw.time ? Number(raw.time) * 1000 : 0;
            const ts = data.ts || data.timestamp || ntfyTime || 0;
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
  function startListeningToWatchEvents(force = false) {
    if (syncEventSource) {
      if (!force && (syncEventSource.readyState === EventSource.OPEN || syncEventSource.readyState === EventSource.CONNECTING)) {
        return;
      }
      try { syncEventSource.close(); } catch (e) {}
      syncEventSource = null;
    }

    try {
      const sseUrl = activeConfig.token
        ? `${RELAY_WATCH_TO_PHONE}/sse?auth=${encodeURIComponent(activeConfig.token.trim())}`
        : `${RELAY_WATCH_TO_PHONE}/sse`;
      syncEventSource = new EventSource(sseUrl);

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
    const sessionId = payload.sessionId || (payload.summary && payload.summary.sessionId) || null;
    const completedAt = payload.completedAt || ts;
    const incomingTime = completedAt || ts || Date.now();

    if (!slotId || setIndex === undefined) return false;

    if (typeof workoutState !== 'undefined' && workoutState) {
      // Ignorar eventos de una sesión ya archivada (catch-up/outbox antiguo)
      if (sessionId && Array.isArray(workoutState.sessions) &&
          workoutState.sessions.some(s => s && (s.sessionId === sessionId || s.id === sessionId))) {
        markMsgProcessed(id);
        return true;
      }

      // Evento completado antes de que el día se archivara: pertenece a la sesión cerrada
      const archivedLater = dayId && Array.isArray(workoutState.sessions) &&
        workoutState.sessions.some(s => {
          if (!s || s.dayId !== dayId || !s.date) return false;
          const archivedTs = new Date(s.date).getTime();
          return Number.isFinite(archivedTs) && incomingTime < archivedTs - 1000;
        });
      if (archivedLater) {
        console.log('[WatchBridge] Serie anterior al archivado, ignorando:', id);
        markMsgProcessed(id);
        return true;
      }

      // No mezclar series de otra sesión concurrente en el mismo día
      const activeSessionId = dayId && workoutState.sessionIds ? workoutState.sessionIds[dayId] : null;
      if (sessionId && activeSessionId && activeSessionId !== sessionId) {
        console.log('[WatchBridge] Serie de otra sesión, ignorando:', id, activeSessionId, sessionId);
        markMsgProcessed(id);
        return true;
      }
    }

    console.log('[WatchBridge] Procesando serie del reloj:', id, slotId, setIndex, kg, reps);

    // 2. Aplicar directamente a workoutState para que NO se pierda si la tarjeta no está en el DOM
    if (typeof workoutState !== 'undefined' && workoutState) {
      if (!workoutState.inputs) workoutState.inputs = {};
      if (!Array.isArray(workoutState.completed)) workoutState.completed = [];
      if (!workoutState.setTimestamps) workoutState.setTimestamps = {};

      const rowKey = `${slotId}_${setIndex}`;
      const existingTime = workoutState.setTimestamps[rowKey] || 0;

      // Regla de fusión: gana el cambio más reciente según completedAt.
      // Un evento antiguo no debe resucitar un día archivado ni deshacer un cambio posterior.
      if (incomingTime < existingTime) {
        console.log('[WatchBridge] Evento de serie antiguo, ignorando:', id, incomingTime, existingTime);
        markMsgProcessed(id);
        return true;
      }

      if (kg !== undefined && kg !== null && kg !== '') {
        workoutState.inputs[`${rowKey}_kg`] = String(kg);
      }
      if (reps !== undefined && reps !== null && reps !== '') {
        workoutState.inputs[`${rowKey}_reps`] = String(reps);
      }
      workoutState.setTimestamps[rowKey] = incomingTime;
      if (!workoutState.completed.includes(rowKey)) {
        workoutState.completed.push(rowKey);
      }

      // Adoptar el sessionId del reloj si el móvil aún no tenía sesión para este día.
      // Evita que el siguiente broadcast genere un id web distinto y parta la sesión.
      if (dayId && sessionId) {
        if (!workoutState.sessionIds) workoutState.sessionIds = {};
        if (!workoutState.sessionIds[dayId]) workoutState.sessionIds[dayId] = sessionId;
      }

      // Marcar sessionStartTime si no existía para este día
      if (dayId && (!workoutState.sessionStartTime || !workoutState.sessionStartTime[dayId])) {
        if (!workoutState.sessionStartTime) workoutState.sessionStartTime = {};
        workoutState.sessionStartTime[dayId] = completedAt || Date.now();
      }
      if (dayId) {
        if (!workoutState.lastActivityTime) workoutState.lastActivityTime = {};
        workoutState.lastActivityTime[dayId] = completedAt || Date.now();
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
    lastSuccessfulReceiveTime = Date.now();
    lastSuccessfulSyncTime = Date.now();
    renderSyncPill();

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

    // Si el móvil tiene otra sesión activa para ese día, no archivar la sesión equivocada
    if (typeof workoutState !== 'undefined' && workoutState && workoutState.sessionIds) {
      const activeSessionId = workoutState.sessionIds[summary.dayId];
      if (activeSessionId && activeSessionId !== sessionId) {
        console.log('[WatchBridge] Fin de otra sesión, ignorando:', id, activeSessionId, sessionId);
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
      registerSessionHistory(record);

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
      clearSetTimestampsForDay(summary.dayId);

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
      lastSuccessfulReceiveTime = Date.now();
      lastSuccessfulSyncTime = Date.now();
      renderSyncPill();

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

  // 6. Pill de estado e indicador visible en la cabecera
  function updateSyncPillStatus(state, extra) {
    renderSyncPill(extra);
  }

  function updateSyncPill(connected) {
    isSseConnected = !!connected;
    renderSyncPill();
  }

  function determineCurrentSyncStatus() {
    const now = Date.now();
    if (rateLimitResetTime > now) {
      const waitSec = Math.max(1, Math.ceil((rateLimitResetTime - now) / 1000));
      return { status: 'rate_limited', extra: waitSec };
    }
    if (hasPendingBroadcast || isBroadcasting || broadcastDebounceTimer !== null) {
      const count = (hasPendingBroadcast ? 1 : 0) + (isBroadcasting ? 1 : 0) + (broadcastDebounceTimer ? 1 : 0);
      return { status: 'pending', extra: Math.max(1, count) };
    }
    if (!isSseConnected) {
      return { status: 'disconnected', extra: null };
    }
    return { status: 'synced', extra: null };
  }

  function renderSyncPill(extra) {
    let pill = document.getElementById('watchSyncPill');
    if (!pill) {
      const headerContainer = document.getElementById('headerCenterWatch') || document.querySelector('.header-center-watch, .header-content, .app-header-fixed, .app-header');
      if (headerContainer) {
        pill = document.createElement('div');
        pill.id = 'watchSyncPill';
        pill.style.cssText = 'display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;padding:5px 10px;border-radius:14px;background:rgba(15,23,42,0.9);border:1px solid rgba(56,189,248,0.4);color:#94a3b8;cursor:pointer;white-space:nowrap;user-select:none;margin-left:auto;transition:all 0.2s ease;';
        pill.onclick = () => {
          openWatchSyncModal();
        };
        headerContainer.appendChild(pill);
      }
    }
    if (!pill) return;

    const { status, extra: calcExtra } = determineCurrentSyncStatus();
    const valExtra = extra !== undefined ? extra : calcExtra;

    if (status === 'synced') {
      const ageSec = lastSuccessfulSyncTime > 0 ? Math.round((Date.now() - lastSuccessfulSyncTime) / 1000) : 0;
      const isFresh = ageSec < 60;
      const dotColor = isFresh ? '#10b981' : '#38bdf8';
      pill.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:${dotColor};box-shadow:0 0 8px ${dotColor};"></span> Sincronizado`;
      pill.style.color = '#38bdf8';
      pill.style.borderColor = 'rgba(16,185,129,0.4)';
      const ageText = lastSuccessfulSyncTime > 0 ? `hace ${ageSec < 60 ? ageSec + 's' : Math.round(ageSec / 60) + 'm'}` : 'listo';
      pill.title = `Sincronización activa con Amazfit Active 2 (${ageText}). Toca para ver detalles o configurar.`;
    } else if (status === 'pending') {
      const count = valExtra || 1;
      pill.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:#fbbf24;box-shadow:0 0 8px #fbbf24;"></span> Pendiente (${count})`;
      pill.style.color = '#fbbf24';
      pill.style.borderColor = 'rgba(251,191,36,0.4)';
      pill.title = `Hay cambios locales pendientes de sincronizar con el reloj.`;
    } else if (status === 'rate_limited') {
      const sec = valExtra || 60;
      pill.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:#f59e0b;box-shadow:0 0 8px #f59e0b;"></span> Límite alcanzado (${sec}s)`;
      pill.style.color = '#f59e0b';
      pill.style.borderColor = 'rgba(245,158,11,0.5)';
      pill.title = `Límite de peticiones alcanzado en ntfy.sh. Reintento en ${sec} segundos.`;
    } else {
      pill.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#ef4444;box-shadow:0 0 8px #ef4444;"></span> Sin conexión';
      pill.style.color = '#f87171';
      pill.style.borderColor = 'rgba(239,68,68,0.4)';
      pill.title = 'Canal SSE desconectado o reconectando. Toca para detalles y reconexión.';
    }
  }

  // 7. Modal de estado y configuración de privacidad
  function openWatchSyncModal() {
    let modal = document.getElementById('watchSyncModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'watchSyncModal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;';
      modal.onclick = (e) => {
        if (e.target === modal) closeWatchSyncModal();
      };
      document.body.appendChild(modal);
    }

    const cfg = getSyncConfig();
    const { status, extra } = determineCurrentSyncStatus();

    let statusLabel = 'Desconectado';
    let statusBadgeColor = '#ef4444';
    let statusBg = 'rgba(239,68,68,0.15)';
    if (status === 'synced') {
      statusLabel = 'Sincronizado';
      statusBadgeColor = '#10b981';
      statusBg = 'rgba(16,185,129,0.15)';
    } else if (status === 'pending') {
      statusLabel = `Pendiente (${extra || 1})`;
      statusBadgeColor = '#fbbf24';
      statusBg = 'rgba(251,191,36,0.15)';
    } else if (status === 'rate_limited') {
      statusLabel = `Límite alcanzado (${extra || 60}s)`;
      statusBadgeColor = '#f59e0b';
      statusBg = 'rgba(245,158,11,0.15)';
    }

    const fmtTime = (ts) => {
      if (!ts) return 'Ninguna en esta sesión';
      const sec = Math.round((Date.now() - ts) / 1000);
      if (sec < 60) return `hace ${sec} seg`;
      const min = Math.round(sec / 60);
      if (min < 60) return `hace ${min} min`;
      return new Date(ts).toLocaleTimeString();
    };

    modal.innerHTML = `
      <div style="background:#0f172a;border:1px solid #1e293b;border-radius:24px;width:100%;max-width:440px;max-height:90vh;overflow-y:auto;padding:22px;color:#f8fafc;box-shadow:0 20px 40px rgba(0,0,0,0.7);">
        <!-- Encabezado -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:22px;">⌚</span>
            <div>
              <h3 style="font-size:17px;font-weight:700;margin:0;color:#f8fafc;">Sincronización Reloj</h3>
              <div style="font-size:12px;color:#94a3b8;">Amazfit Active 2 • VigorexiApp v1.5.0</div>
            </div>
          </div>
          <button onclick="window.VigorexiWatchSync.closeModal()" style="background:#1e293b;border:none;color:#94a3b8;font-size:18px;width:32px;height:32px;border-radius:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
        </div>

        <!-- Estado en tiempo real -->
        <div style="background:#1e293b;border-radius:16px;padding:14px;margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <span style="font-size:13px;color:#94a3b8;">Estado del enlace:</span>
            <span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:3px 10px;border-radius:12px;background:${statusBg};color:${statusBadgeColor};border:1px solid ${statusBadgeColor}44;">
              <span style="width:7px;height:7px;border-radius:50%;background:${statusBadgeColor};"></span>
              ${statusLabel}
            </span>
          </div>

          <div style="font-size:12px;color:#cbd5e1;line-height:1.7;">
            <div>📡 <strong>Canal SSE:</strong> ${isSseConnected ? '<span style="color:#10b981;">Conectado</span>' : '<span style="color:#f87171;">Desconectado</span>'}</div>
            <div>📤 <strong>Última emisión al reloj:</strong> ${fmtTime(lastSuccessfulBroadcastTime)}</div>
            <div>📥 <strong>Última recepción del reloj:</strong> ${fmtTime(lastSuccessfulReceiveTime)}</div>
          </div>

          <div style="display:flex;gap:8px;margin-top:14px;">
            <button id="btnForceSyncNow" style="flex:1;background:linear-gradient(135deg,#0284c7,#2563eb);color:#fff;border:none;padding:9px 12px;border-radius:12px;font-size:12px;font-weight:700;cursor:pointer;">Forzar Sync</button>
            <button id="btnReconnectSse" style="background:#334155;color:#f8fafc;border:none;padding:9px 12px;border-radius:12px;font-size:12px;font-weight:600;cursor:pointer;">🔄 Reconectar</button>
          </div>
        </div>

        <!-- Código de sincronización y Privacidad -->
        <div style="background:#1e293b;border-radius:16px;padding:14px;margin-bottom:16px;">
          <div style="font-weight:700;font-size:13px;color:#38bdf8;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
            <span>🔐</span> Código Privado de Sincronización
          </div>
          <p style="font-size:12px;color:#94a3b8;margin-bottom:10px;line-height:1.4;">
            Los canales de ntfy se derivan determinísticamente de este código para que nadie pueda ver ni inyectar datos en tu reloj.
          </p>

          ${cfg.isDefault ? `
            <div style="background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.3);border-radius:10px;padding:10px;margin-bottom:12px;font-size:12px;color:#fbbf24;line-height:1.4;">
              ⚠️ <strong>Usando código público por defecto</strong>. Genera tu propio código privado para que tu sincronización sea 100% segura.
            </div>
          ` : ''}

          <div style="display:flex;gap:6px;margin-bottom:10px;">
            <input type="text" id="syncCodeInput" value="${cfg.code}" style="flex:1;background:#090d16;border:1px solid #334155;border-radius:10px;padding:8px 10px;color:#f8fafc;font-size:12px;font-family:monospace;" placeholder="Mínimo 24 caracteres">
            <button id="btnCopySyncCode" style="background:#334155;border:none;color:#cbd5e1;padding:8px 12px;border-radius:10px;cursor:pointer;font-size:12px;" title="Copiar código">📋</button>
          </div>

          <div style="display:flex;gap:8px;">
            <button id="btnGenSyncCode" style="flex:1;background:#0f172a;border:1px solid #38bdf844;color:#38bdf8;padding:8px 12px;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;">🎲 Generar nuevo</button>
            <button id="btnSaveSyncCode" style="background:#10b981;color:#fff;border:none;padding:8px 14px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;">💾 Guardar</button>
          </div>

          <button id="btnCopyFullConfig" style="width:100%;margin-top:10px;background:#334155;border:1px solid #475569;color:#f8fafc;padding:8px 12px;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
            📄 Copiar texto listo para config.js
          </button>

          <div style="margin-top:10px;font-size:11px;color:#64748b;line-height:1.4;">
            💡 <em>Pega este texto en el archivo <code>watch/app-side/config.js</code> antes de compilar o instalar en Zepp.</em>
          </div>
        </div>

        <!-- Ajustes de Servidor y Auth (Avanzado) -->
        <details style="background:#1e293b;border-radius:16px;padding:12px 14px;font-size:12px;">
          <summary style="cursor:pointer;color:#94a3b8;font-weight:600;user-select:none;">⚙️ Servidor Relay y Autenticación (Avanzado)</summary>
          <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px;">
            <div>
              <label style="color:#cbd5e1;display:block;margin-bottom:4px;font-size:11px;">URL del Servidor Relay:</label>
              <input type="text" id="syncServerInput" value="${cfg.server}" style="width:100%;box-sizing:border-box;background:#090d16;border:1px solid #334155;border-radius:8px;padding:6px 10px;color:#f8fafc;font-size:12px;">
            </div>
            <div>
              <label style="color:#cbd5e1;display:block;margin-bottom:4px;font-size:11px;">Token de Autorización Bearer (Opcional):</label>
              <input type="password" id="syncTokenInput" value="${cfg.token}" placeholder="Token para servidor privado" style="width:100%;box-sizing:border-box;background:#090d16;border:1px solid #334155;border-radius:8px;padding:6px 10px;color:#f8fafc;font-size:12px;">
            </div>
            <button id="btnSaveAdvanced" style="align-self:flex-end;background:#38bdf8;color:#090d16;border:none;padding:6px 14px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;margin-top:4px;">Guardar servidor</button>
          </div>
        </details>
      </div>
    `;

    modal.style.display = 'flex';

    // Event handlers
    const btnForce = document.getElementById('btnForceSyncNow');
    if (btnForce) {
      btnForce.onclick = () => {
        rateLimitResetTime = 0;
        showWatchToast('⌚ Forzando sincronización inmediata...');
        scheduleBroadcast(0);
        catchUpFromWatch();
        setTimeout(openWatchSyncModal, 500);
      };
    }

    const btnReconn = document.getElementById('btnReconnectSse');
    if (btnReconn) {
      btnReconn.onclick = () => {
        showWatchToast('🔄 Reconectando canal SSE...');
        startListeningToWatchEvents(true);
        setTimeout(openWatchSyncModal, 600);
      };
    }

    const btnCopy = document.getElementById('btnCopySyncCode');
    if (btnCopy) {
      btnCopy.onclick = () => {
        const input = document.getElementById('syncCodeInput');
        if (input && input.value) {
          navigator.clipboard.writeText(input.value).then(() => {
            showWatchToast('📋 Código copiado al portapapeles');
          }).catch(() => {
            input.select();
            document.execCommand('copy');
            showWatchToast('📋 Código copiado');
          });
        }
      };
    }

    const btnCopyFull = document.getElementById('btnCopyFullConfig');
    if (btnCopyFull) {
      btnCopyFull.onclick = () => {
        const input = document.getElementById('syncCodeInput');
        const code = input ? input.value.trim() : cfg.code;
        const text = `export const SYNC_CONFIG = {\n  SYNC_CODE: '${code}',\n  SERVER_URL: '${cfg.server}',\n  AUTH_TOKEN: '${cfg.token}'\n};\n`;
        navigator.clipboard.writeText(text).then(() => {
          showWatchToast('📄 Texto completo copiado para config.js');
        }).catch(() => {
          input.select();
          showWatchToast('📄 Código copiado');
        });
      };
    }

    const btnGen = document.getElementById('btnGenSyncCode');
    if (btnGen) {
      btnGen.onclick = () => {
        const newCode = generateSecureSyncCode();
        const input = document.getElementById('syncCodeInput');
        if (input) input.value = newCode;
      };
    }

    const btnSaveCode = document.getElementById('btnSaveSyncCode');
    if (btnSaveCode) {
      btnSaveCode.onclick = () => {
        const input = document.getElementById('syncCodeInput');
        const code = input ? input.value.trim() : '';
        if (!code || code.length < 24) {
          alert('El código de sincronización debe tener al menos 24 caracteres para ser seguro.');
          return;
        }
        localStorage.setItem(SYNC_CODE_KEY, code);
        reloadSyncConfig();
        showWatchToast('💾 Código guardado. Reiniciando conexión...');
        startListeningToWatchEvents();
        scheduleBroadcast(500);
        catchUpFromWatch();
        setTimeout(openWatchSyncModal, 700);
      };
    }

    const btnSaveAdv = document.getElementById('btnSaveAdvanced');
    if (btnSaveAdv) {
      btnSaveAdv.onclick = () => {
        const srv = document.getElementById('syncServerInput');
        const tok = document.getElementById('syncTokenInput');
        if (srv) localStorage.setItem(SYNC_SERVER_KEY, srv.value.trim() || 'https://ntfy.sh');
        if (tok) localStorage.setItem(SYNC_TOKEN_KEY, tok.value.trim());
        reloadSyncConfig();
        showWatchToast('💾 Ajustes avanzados guardados');
        startListeningToWatchEvents(true);
        scheduleBroadcast(500);
        catchUpFromWatch();
        setTimeout(openWatchSyncModal, 600);
      };
    }
  }

  function closeWatchSyncModal() {
    const modal = document.getElementById('watchSyncModal');
    if (modal) modal.style.display = 'none';
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
  let lastRestTimerActiveState = false;
  if (typeof origSaveRestTimer === 'function') {
    window.saveRestTimerState = function(...args) {
      const res = origSaveRestTimer.apply(this, args);
      const isNowActive = typeof isTimerActive !== 'undefined' ? !!isTimerActive : false;
      // Solo emitir broadcast si cambió el estado de descanso (iniciado o finalizado), nunca durante el conteo
      if (isNowActive !== lastRestTimerActiveState) {
        lastRestTimerActiveState = isNowActive;
        scheduleBroadcast(1500);
      }
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

    // Refresco periódico del pill de estado (countdown de límites y cambios)
    setInterval(renderSyncPill, 5000);

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
    catchUp: catchUpFromWatch,
    openModal: openWatchSyncModal,
    closeModal: closeWatchSyncModal,
    getConfig: getSyncConfig,
    generateCode: generateSecureSyncCode,
    deriveTopicHash: deriveTopicHash
  };

  // Hooks internos para pruebas de regresión (no usados por la app)
  window.__vigorexiWatchTest = {
    isWorkoutActive,
    getActiveWorkoutDay,
    insertSessionSorted,
    registerSessionHistory,
    mergeSessionSets,
    clearSetTimestampsForDay,
    handleSetCompletedFromWatch,
    handleWorkoutFinishedFromWatch
  };
})();
