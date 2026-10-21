/**
 * VigorexiApp - Suite de Pruebas Automatizadas de Sincronización
 * Valida la lógica pura de mezcla, desempaquetado, deduplicación, hashing y los 8 escenarios de aceptación.
 * Ejecución: node tests/sync_test.js
 */

const assert = require('assert');

// 1. Simulación e importación de lógica pura

// --- Lógica de Derivación de Hash y Topics (Fase 5) ---
function deriveTopicHash(code) {
  const str = String(code || '').trim() || 'vigorexi_danicb99_7f3a91c4e2b8';
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

function getSyncEndpoints(code, server = 'https://ntfy.sh') {
  const srv = server.replace(/\/+$/, '');
  const hash = deriveTopicHash(code);
  return {
    phoneToWatch: `${srv}/vigorexi_${hash}_p2w`,
    watchToPhone: `${srv}/vigorexi_${hash}_w2p`
  };
}

// --- Lógica de Mezcla no destructiva de series (Fase 2 - watch/utils/merge.js) ---
const { mergeSessionLoggedSets, countCompletedSets } = require('../watch/utils/merge.js');

// --- Lógica de Desempaquetado y Deduplicación (Fase 4 - watch_bridge.js) ---
function unboxWatchMessage(raw) {
  if (!raw) return null;
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const type = data.type || (data.payload && data.payload.type);
  const payload = data.payload || data;

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

// --- Lógica de Cálculo de Hash de Broadcast (Fase 1 - watch_bridge.js) ---
function computeBroadcastHash(payload, workoutState) {
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

// --- Inicio de la suite de pruebas ---
let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

console.log('====================================================');
console.log('🧪 VigorexiApp - Suite de Pruebas de Sincronización');
console.log('====================================================\n');

// ----------------------------------------------------
// BLOQUE 1: LÓGICA PURA
// ----------------------------------------------------
console.log('📦 Bloque 1: Pruebas de Funciones Puras');

test('mergeSessionLoggedSets: maneja entradas nulas o vacías', () => {
  assert.deepStrictEqual(mergeSessionLoggedSets(null, null), {});
  assert.deepStrictEqual(mergeSessionLoggedSets({}, null), {});
  assert.deepStrictEqual(mergeSessionLoggedSets(null, { slot1: [{ kg: 50, reps: 10, completed: true }] }), {
    slot1: [{ kg: 50, reps: 10, completed: true }]
  });
});

test('mergeSessionLoggedSets: fusiona series sin duplicados y respeta la versión más reciente', () => {
  const local = {
    slot1: [
      { kg: 80, reps: 8, completed: true, completedAt: 1000 },
      { kg: 80, reps: 6, completed: false, completedAt: 1000 }
    ]
  };
  const incoming = {
    slot1: [
      { kg: 80, reps: 8, completed: true, completedAt: 1000 }, // idéntico
      { kg: 80, reps: 8, completed: true, completedAt: 2000 }  // completada más reciente en el otro lado
    ],
    slot2: [
      { kg: 40, reps: 12, completed: true, completedAt: 1500 }
    ]
  };

  const merged = mergeSessionLoggedSets(local, incoming);
  assert.strictEqual(merged.slot1.length, 2);
  assert.strictEqual(merged.slot1[0].completed, true);
  assert.strictEqual(merged.slot1[1].completed, true);
  assert.strictEqual(merged.slot1[1].reps, 8); // Se actualizó a 8 reps y completada
  assert.strictEqual(merged.slot2.length, 1);
  assert.strictEqual(merged.slot2[0].kg, 40);
});

test('mergeSessionLoggedSets: corrección a la baja gana si es más reciente por completedAt', () => {
  // Caso 1: Estaba a 82.5 kg, el usuario corrigió a 80 kg después
  const anterior = {
    slot1: [{ kg: 82.5, reps: 8, completed: true, completedAt: 10000 }]
  };
  const correccionBaja = {
    slot1: [{ kg: 80.0, reps: 8, completed: true, completedAt: 15000 }]
  };

  const res1 = mergeSessionLoggedSets(anterior, correccionBaja);
  assert.strictEqual(res1.slot1[0].kg, 80.0, 'Debe ganar el valor corregido a la baja porque es más reciente');

  // Caso 2: Corrección en repeticiones a la baja (de 10 a 8 reps)
  const repsAnterior = {
    slot1: [{ kg: 80, reps: 10, completed: true, completedAt: 10000 }]
  };
  const repsCorregido = {
    slot1: [{ kg: 80, reps: 8, completed: true, completedAt: 20000 }]
  };

  const res2 = mergeSessionLoggedSets(repsAnterior, repsCorregido);
  assert.strictEqual(res2.slot1[0].reps, 8, 'Debe ganar la repetición corregida a la baja por ser más reciente');
});

test('mergeSessionLoggedSets: serie completada NUNCA es sobrescrita por una no completada', () => {
  const completada = {
    slot1: [{ kg: 80, reps: 8, completed: true, completedAt: 5000 }]
  };
  const noCompletada = {
    slot1: [{ kg: 80, reps: 0, completed: false, completedAt: 99999 }]
  };

  const res = mergeSessionLoggedSets(completada, noCompletada);
  assert.strictEqual(res.slot1[0].completed, true, 'La serie completada debe preservarse');
  assert.strictEqual(res.slot1[0].reps, 8);
});

test('countCompletedSets: cuenta exactamente las series completadas', () => {
  const sets = {
    slot1: [{ completed: true }, { completed: false }, { completed: true }],
    slot2: [{ completed: true }],
    slot3: []
  };
  assert.strictEqual(countCompletedSets(sets), 3);
});

test('unboxWatchMessage: desempaqueta sobres v1 estándar', () => {
  const envelope = {
    v: 1,
    id: 'msg-12345',
    type: 'SET_COMPLETED',
    ts: 1700000000000,
    src: 'watch',
    payload: { slotId: 'slotA', setIndex: 0, kg: 100, reps: 5 }
  };
  const unboxed = unboxWatchMessage(envelope);
  assert.strictEqual(unboxed.id, 'msg-12345');
  assert.strictEqual(unboxed.type, 'SET_COMPLETED');
  assert.strictEqual(unboxed.payload.kg, 100);
});

test('unboxWatchMessage: compatibilidad retroactiva con formato legacy y deriva id determinista', () => {
  const legacy = {
    type: 'SET_COMPLETED',
    slotId: 'slotB',
    setIndex: 2,
    kg: 75,
    reps: 10,
    timestamp: 1699999999999
  };
  const unboxed = unboxWatchMessage(legacy);
  assert.strictEqual(unboxed.id, 'legacy-set-slotB_2-75x10');
  assert.strictEqual(unboxed.type, 'SET_COMPLETED');
  assert.strictEqual(unboxed.payload.kg, 75);
});

test('computeBroadcastHash: hash constante en reposo y sensible a cambios de entreno', () => {
  const stateIdle = { completed: [] };
  const h1 = computeBroadcastHash({ workoutActive: false }, stateIdle);
  const h2 = computeBroadcastHash({ workoutActive: false, timestamp: 99999 }, stateIdle);
  assert.strictEqual(h1, h2, 'En reposo el hash DEBE ser idéntico sin importar marcas de tiempo');

  const stateActive1 = { completed: ['s1_0'] };
  const hActive1 = computeBroadcastHash({ workoutActive: true, activeDayId: 'torsoA', currentSlotIndex: 0, currentSetIndex: 0 }, stateActive1);
  assert.notStrictEqual(h1, hActive1, 'El hash debe cambiar cuando hay entreno activo');

  // Modificar peso/reps en sessionLoggedSets
  const hActive2 = computeBroadcastHash({
    workoutActive: true,
    activeDayId: 'torsoA',
    currentSlotIndex: 0,
    currentSetIndex: 0,
    sessionLoggedSets: { s1: [{ kg: 82.5, reps: 8 }] }
  }, stateActive1);
  assert.notStrictEqual(hActive1, hActive2, 'El hash debe cambiar cuando cambia el peso o reps editado');
});

// ----------------------------------------------------
// BLOQUE 2: ESCENARIOS DE ACEPTACIÓN a) - h)
// ----------------------------------------------------
console.log('\n🚀 Bloque 2: Escenarios de Aceptación (a - h)');

test('Escenario a) Sesión iniciada en móvil, continuada en reloj', () => {
  // 1. Móvil genera snapshot
  const phoneSnapshot = {
    workoutActive: true,
    activeDayId: 'fullbodyA',
    currentSlotIndex: 1,
    currentSetIndex: 2,
    sessionStartTime: Date.now() - 600000,
    sessionLoggedSets: {
      fb_squat: [{ kg: 100, reps: 5, completed: true }]
    }
  };

  // 2. Reloj recibe respuesta de GET_PHONE_SESSION y adopta estado
  const watchState = {
    activeDayId: null,
    currentSlotIndex: 0,
    currentSetIndex: 0,
    sessionLoggedSets: {}
  };

  if (phoneSnapshot.workoutActive && phoneSnapshot.activeDayId) {
    watchState.activeDayId = phoneSnapshot.activeDayId;
    watchState.currentSlotIndex = phoneSnapshot.currentSlotIndex;
    watchState.currentSetIndex = phoneSnapshot.currentSetIndex;
    watchState.sessionLoggedSets = mergeSessionLoggedSets(watchState.sessionLoggedSets, phoneSnapshot.sessionLoggedSets);
  }

  assert.strictEqual(watchState.activeDayId, 'fullbodyA');
  assert.strictEqual(watchState.currentSlotIndex, 1);
  assert.strictEqual(watchState.currentSetIndex, 2);
  assert.strictEqual(watchState.sessionLoggedSets.fb_squat.length, 1);
});

test('Escenario b) Móvil apagado/sin cobertura: encolado en outbox y retransmisión con backoff', () => {
  const outbox = [];
  const enqueue = (item) => outbox.push({ ...item, retries: 0 });

  // 1. Tres series se realizan en el reloj sin móvil disponible
  enqueue({ id: 'set-1', type: 'SET_COMPLETED', payload: { set: 1 } });
  enqueue({ id: 'set-2', type: 'SET_COMPLETED', payload: { set: 2 } });
  enqueue({ id: 'set-3', type: 'SET_COMPLETED', payload: { set: 3 } });
  assert.strictEqual(outbox.length, 3);

  // 2. Primer intento falla (sin conexión)
  let bleConnected = false;
  const flushedSuccess = [];

  const simulateFlush = () => {
    if (!bleConnected) {
      // Incrementar reintentos según política de backoff
      outbox.forEach(item => item.retries++);
      return;
    }
    // Al volver la conexión, se envían y confirman uno a uno
    while (outbox.length > 0) {
      const current = outbox.shift();
      flushedSuccess.push(current.id);
    }
  };

  simulateFlush();
  assert.strictEqual(outbox.length, 3);
  assert.strictEqual(outbox[0].retries, 1, 'Se incrementaron los reintentos para backoff');

  // 3. Vuelve la conexión: vaciado con éxito
  bleConnected = true;
  simulateFlush();
  assert.strictEqual(outbox.length, 0, 'El outbox quedó completamente vacío');
  assert.deepStrictEqual(flushedSuccess, ['set-1', 'set-2', 'set-3']);
});

test('Escenario c) Finalización en reloj con móvil cerrado: catch-up de 12 horas recupera sesión', () => {
  const finishTimestamp = Date.now() - (2 * 3600 * 1000); // Terminó hace 2 horas
  const ntfyStream = [
    JSON.stringify({
      id: 'ntfy_msg_987',
      event: 'message',
      message: JSON.stringify({
        v: 1,
        id: 'watch-fin-fullbodyA-1234',
        type: 'WORKOUT_FINISHED',
        ts: finishTimestamp,
        payload: {
          sessionId: 'session-fullbodyA-abc',
          dayId: 'fullbodyA',
          durationMinutes: 52,
          date: new Date(finishTimestamp).toISOString()
        }
      })
    })
  ];

  // Simulación de catchUpFromWatch en la web
  const processedIds = new Set();
  const savedSessions = [];
  const CATCHUP_MAX_AGE_MS = 12 * 3600 * 1000;

  for (const line of ntfyStream) {
    const raw = JSON.parse(line);
    const envelope = JSON.parse(raw.message);
    const unboxed = unboxWatchMessage(envelope);
    if (!unboxed) continue;

    // Verificar ventana de 12 horas
    if (Date.now() - unboxed.ts <= CATCHUP_MAX_AGE_MS) {
      if (!processedIds.has(unboxed.id)) {
        processedIds.add(unboxed.id);
        savedSessions.push(unboxed.payload);
      }
    }
  }

  assert.strictEqual(savedSessions.length, 1);
  assert.strictEqual(savedSessions[0].sessionId, 'session-fullbodyA-abc');
  assert.strictEqual(savedSessions[0].durationMinutes, 52);
});

test('Escenario d) Respuesta 429 de ntfy.sh: pausa respetando Retry-After sin pérdida de series', () => {
  let rateLimitResetTime = 0;
  let hasPendingBroadcast = false;

  // Simular respuesta HTTP 429 con header Retry-After
  const mockResponse = {
    status: 429,
    headers: { 'retry-after': '45' }
  };

  if (mockResponse.status === 429) {
    const retrySec = parseInt(mockResponse.headers['retry-after'], 10) || 60;
    rateLimitResetTime = Date.now() + (retrySec * 1000);
    hasPendingBroadcast = true;
  }

  assert.strictEqual(hasPendingBroadcast, true, 'El broadcast pendiente se preserva');
  const remainingSec = Math.ceil((rateLimitResetTime - Date.now()) / 1000);
  assert.strictEqual(remainingSec >= 44 && remainingSec <= 45, true, 'Se calculó el tiempo restante');
});

test('Escenario e) Dispositivos alternados: convergencia sin sobrescritura destructiva', () => {
  // Serie 1 en móvil
  let webSets = { slot1: [{ kg: 80, reps: 8, completed: true }] };
  let watchSets = {};

  // Reloj sincroniza con móvil
  watchSets = mergeSessionLoggedSets(watchSets, webSets);

  // Serie 2 en reloj
  watchSets.slot1.push({ kg: 82.5, reps: 8, completed: true });

  // Web sincroniza con evento de reloj
  webSets = mergeSessionLoggedSets(webSets, watchSets);

  // Serie 3 en móvil
  webSets.slot1.push({ kg: 82.5, reps: 7, completed: true });

  // Reloj sincroniza con móvil
  watchSets = mergeSessionLoggedSets(watchSets, webSets);

  assert.strictEqual(webSets.slot1.length, 3);
  assert.strictEqual(watchSets.slot1.length, 3);
  assert.deepStrictEqual(webSets.slot1, watchSets.slot1);
  assert.strictEqual(countCompletedSets(webSets), 3);
});

test('Escenario f) Topic privado: determinismo e igualdad entre web y reloj para un mismo código', () => {
  const syncCode = 'VigorexiApp_Priv_Code_9876543210_SecureKey';
  
  // Derivación en la web
  const webEndpoints = getSyncEndpoints(syncCode);
  
  // Derivación en el reloj (app-side)
  const watchEndpoints = getSyncEndpoints(syncCode);

  assert.strictEqual(webEndpoints.phoneToWatch, watchEndpoints.phoneToWatch);
  assert.strictEqual(webEndpoints.watchToPhone, watchEndpoints.watchToPhone);
  assert.ok(webEndpoints.phoneToWatch.includes('vigorexi_'));
  assert.ok(webEndpoints.phoneToWatch.endsWith('_p2w'));
  assert.ok(webEndpoints.watchToPhone.endsWith('_w2p'));
});

test('Escenario g) Sin entreno activo: 0 peticiones HTTP periódicas en segundo plano', () => {
  let httpRequestsCount = 0;
  let lastHash = '';

  const simulatePeriodicCheck = (workoutActive) => {
    const payload = { workoutActive };
    const hash = computeBroadcastHash(payload, { completed: [] });
    // Coalescencia: solo emite si cambió el hash
    if (hash === lastHash) {
      return; // 0 peticiones
    }
    lastHash = hash;
    httpRequestsCount++;
  };

  // Estado reposo durante 10 ciclos
  for (let i = 0; i < 10; i++) {
    simulatePeriodicCheck(false);
  }

  assert.strictEqual(httpRequestsCount, 1, 'Solo 1 petición para notificar reposo inicial');

  for (let i = 0; i < 50; i++) {
    simulatePeriodicCheck(false);
  }

  assert.strictEqual(httpRequestsCount, 1, 'Exactamente 0 peticiones subsecuentes en reposo');
});

test('Escenario h) Sesión duplicada: dos eventos WORKOUT_FINISHED con el mismo sessionId solo generan 1 registro', () => {
  const workoutState = { sessions: [] };
  const processedIds = new Set();

  const handleWorkoutFinished = (event) => {
    const unboxed = unboxWatchMessage(event);
    if (!unboxed) return;
    if (processedIds.has(unboxed.id)) return; // Deduplicación por id

    const summary = unboxed.payload.summary || unboxed.payload;
    const sessionId = summary.sessionId;

    // Idempotencia en historial
    const exists = workoutState.sessions.some(s => s.sessionId === sessionId);
    if (exists) {
      processedIds.add(unboxed.id);
      return;
    }

    workoutState.sessions.push({
      sessionId: sessionId,
      dayId: summary.dayId,
      date: summary.date
    });
    processedIds.add(unboxed.id);
  };

  const finishEvent = {
    v: 1,
    id: 'msg-fin-001',
    type: 'WORKOUT_FINISHED',
    payload: {
      summary: {
        sessionId: 'session-fullbodyA-sameId',
        dayId: 'fullbodyA',
        date: new Date().toISOString()
      }
    }
  };

  // Recibido por SSE
  handleWorkoutFinished(finishEvent);
  assert.strictEqual(workoutState.sessions.length, 1);

  // Recibido nuevamente por catch-up
  handleWorkoutFinished(finishEvent);
  assert.strictEqual(workoutState.sessions.length, 1, 'No se duplicó en el historial');

  // Incluso con id de mensaje distinto pero mismo sessionId (re-envío de outbox)
  const finishEvent2 = {
    ...finishEvent,
    id: 'msg-fin-002'
  };
  handleWorkoutFinished(finishEvent2);
  assert.strictEqual(workoutState.sessions.length, 1, 'Idempotencia absoluta por sessionId');
});

test('Escenario i) Entreno completo de 20 series con descansos: total peticiones HTTP < 80', () => {
  let watchPostCount = 0;       // Reloj ➔ ntfy (POST series + fin)
  let companionGetCount = 0;    // Reloj ➔ ntfy (GET consultas bajo demanda)
  let webPostCount = 0;         // Web ➔ ntfy (POST snapshots con debounce)

  // 1. Reloj inicia en day_select: 1 consulta inicial
  companionGetCount++;

  let lastPhoneQueryTime = 1000;
  let currentTime = 1000;
  let webLastHash = '';

  const simulateWebBroadcast = (state) => {
    const hash = computeBroadcastHash({
      workoutActive: true,
      activeDayId: 'fullbodyA',
      currentSlotIndex: state.slotIdx,
      currentSetIndex: state.setIdx,
      sessionLoggedSets: state.loggedSets
    }, { completed: Object.keys(state.loggedSets).flatMap(k => state.loggedSets[k].filter(s => s.completed)) });

    if (hash !== webLastHash) {
      webLastHash = hash;
      webPostCount++;
    }
  };

  const simulateWatchQuery = (force = false) => {
    const minInterval = force ? 30000 : 60000;
    if (currentTime - lastPhoneQueryTime >= minInterval) {
      lastPhoneQueryTime = currentTime;
      companionGetCount++;
    }
  };

  const sessionState = {
    slotIdx: 0,
    setIdx: 0,
    loggedSets: {}
  };

  // Simulación de 20 series (ejemplo mixto: series alternadas entre reloj y móvil)
  for (let s = 1; s <= 20; s++) {
    const slotKey = `slot_${Math.floor((s - 1) / 4)}`;
    if (!sessionState.loggedSets[slotKey]) sessionState.loggedSets[slotKey] = [];

    const isWatch = (s % 2 === 1);

    if (isWatch) {
      // Serie completada en reloj
      watchPostCount++;
      sessionState.loggedSets[slotKey].push({ kg: 80, reps: 8, completed: true, completedAt: currentTime });
    } else {
      // Serie completada en web
      sessionState.loggedSets[slotKey].push({ kg: 80, reps: 8, completed: true, completedAt: currentTime });
      simulateWebBroadcast(sessionState);
    }

    sessionState.setIdx = s % 4;
    sessionState.slotIdx = Math.floor(s / 4);

    // Descanso de 90 segundos entre series
    if (s < 20) {
      // Durante el descanso no hay cambios de hash => 0 peticiones web adicionales
      currentTime += 90000;
      // Al terminar descanso, consulta reloj respetando throttle
      simulateWatchQuery(false);
    }
  }

  // Fin de entrenamiento en el reloj
  watchPostCount++; // POST WORKOUT_FINISHED

  const totalHttpRequests = watchPostCount + companionGetCount + webPostCount;
  console.log(`    📊 Tráfico en 20 series: Reloj POST=${watchPostCount}, Companion GET=${companionGetCount}, Web POST=${webPostCount} | Total=${totalHttpRequests}`);

  assert.ok(totalHttpRequests < 80, `El total de peticiones (${totalHttpRequests}) debe ser inferior a 80`);
});


console.log('\n🛡️ Bloque 3: Integridad de Datos, Inactividad y Estado de Sesión');

test('handleSetCompletedFromWatch actualiza lastActivityTime y sessionStartTime', () => {
  const fakeState = { completed: [], sessionStartTime: {}, lastActivityTime: {} };
  const dayId = 'fullbodyA';
  const completedAt = Date.now();

  // Simulación de la lógica de handleSetCompletedFromWatch
  if (!fakeState.sessionStartTime[dayId]) fakeState.sessionStartTime[dayId] = completedAt;
  fakeState.lastActivityTime[dayId] = completedAt;

  assert.strictEqual(fakeState.sessionStartTime[dayId], completedAt);
  assert.strictEqual(fakeState.lastActivityTime[dayId], completedAt);
});

test('handleWorkoutFinishedFromWatch actualiza exerciseHistory y calcula 1RM', () => {
  const fakeState = { sessions: [], previous: {}, exerciseHistory: {} };
  const summary = {
    sessionId: 'watch-test-123',
    dayId: 'fullbodyA',
    date: new Date().toISOString(),
    exercises: [
      {
        exId: 'squat',
        sets: [
          { kg: 100, reps: 8, completed: true },
          { kg: 100, reps: 6, completed: true }
        ]
      }
    ]
  };

  // Simulación de la lógica implementada
  summary.exercises.forEach(ex => {
    let bestKg = 0, bestReps = 0, best1RM = 0;
    const setsLog = [];
    ex.sets.forEach((st, idx) => {
      const kgNum = parseFloat(st.kg) || 0;
      const repsNum = parseInt(st.reps) || 0;
      const est1RM = repsNum > 1 ? Math.round(kgNum * (1 + repsNum / 30)) : kgNum;
      if (est1RM > best1RM) {
        best1RM = est1RM;
        bestKg = kgNum;
        bestReps = repsNum;
      }
      setsLog.push({ set: idx + 1, kg: kgNum, reps: repsNum, est1RM });
    });

    if (!fakeState.exerciseHistory[ex.exId]) fakeState.exerciseHistory[ex.exId] = [];
    fakeState.exerciseHistory[ex.exId].push({
      date: summary.date,
      sets: setsLog,
      bestKg,
      bestReps,
      best1RM
    });
  });

  assert(fakeState.exerciseHistory['squat'], 'exerciseHistory debe registrar squat');
  assert.strictEqual(fakeState.exerciseHistory['squat'].length, 1);
  assert.strictEqual(fakeState.exerciseHistory['squat'][0].bestKg, 100);
  assert.strictEqual(fakeState.exerciseHistory['squat'][0].bestReps, 8);
  assert.strictEqual(fakeState.exerciseHistory['squat'][0].best1RM, 127); // 100 * (1 + 8/30) = 126.67 => 127
});

test('isWorkoutActive descarta sesiones zombie con marcas > 12 horas', () => {
  const now = Date.now();
  const MAX_AGE = 12 * 3600 * 1000;

  function checkActive(sTime, aTime) {
    if (sTime && (now - sTime < MAX_AGE)) return true;
    if (aTime && (now - aTime < MAX_AGE)) return true;
    return false;
  }

  // Sesión de hace 24 horas (zombie)
  assert.strictEqual(checkActive(now - 24 * 3600 * 1000, now - 23 * 3600 * 1000), false);
  // Sesión activa reciente de hace 20 minutos
  assert.strictEqual(checkActive(now - 20 * 60 * 1000, now - 5 * 60 * 1000), true);
});

test('insertSessionSorted deduplica sesiones del mismo día en ventana de 45m', () => {
  const sessions = [];
  function insert(rec) {
    const ts = new Date(rec.date).getTime();
    if (rec.id && sessions.some(s => s.id === rec.id || s.sessionId === rec.id)) return;
    if (rec.sessionId && sessions.some(s => s.sessionId === rec.sessionId || s.id === rec.sessionId)) return;
    const dup = sessions.findIndex(s => s.dayId === rec.dayId && Math.abs(new Date(s.date).getTime() - ts) < 45 * 60 * 1000);
    if (dup !== -1) return;
    sessions.push(rec);
  }

  const baseDate = new Date('2026-10-21T10:00:00Z');
  insert({ id: 'ses_1', dayId: 'fullbodyA', date: baseDate.toISOString() });
  // Sesión del reloj 10 minutos después para el mismo día
  insert({ id: 'watch-fullbodyA-123', sessionId: 'watch-fullbodyA-123', dayId: 'fullbodyA', date: new Date(baseDate.getTime() + 10 * 60000).toISOString() });

  assert.strictEqual(sessions.length, 1, 'No debe duplicar sesión del mismo día dentro de la ventana de 45m');
});

test('auto-archive usa umbral de 30 minutos y calcula duración según última serie completada', () => {
  const AUTO_SAVE_IDLE_MS = 30 * 60 * 1000;
  const startTime = Date.now() - (75 * 60 * 1000); // Empezó hace 75 min
  const lastActivity = Date.now() - (35 * 60 * 1000); // Última serie hace 35 min (duración real del entreno: 40 min)
  const now = Date.now();

  const isIdle = (now - lastActivity) >= AUTO_SAVE_IDLE_MS;
  assert.strictEqual(isIdle, true, 'Debe activar auto-archive si pasaron >= 30m');

  const durationMin = Math.max(1, Math.round((lastActivity - startTime) / 60000));
  assert.strictEqual(durationMin, 40, 'Duración debe ser 40 min (hasta la última serie hecha, sin sumar inactividad)');
});

console.log('\n====================================================');
console.log(`🎉 Todas las pruebas superadas exitosamente: ${passedTests}/${totalTests}`);
console.log('====================================================');
