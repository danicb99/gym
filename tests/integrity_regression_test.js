const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function createStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    clear() { data.clear(); }
  };
}

function fakeElement() {
  return {
    style: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    appendChild() {},
    remove() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    setAttribute() {},
    getAttribute() { return null; },
    addEventListener() {},
    removeEventListener() {},
    onclick: null,
    innerText: '',
    textContent: '',
    value: ''
  };
}

function loadBridge() {
  const storage = createStorage();
  const windowObj = {
    addEventListener() {},
    removeEventListener() {},
    setTimeout,
    clearTimeout,
    setInterval() { return 0; },
    clearInterval() {},
    location: { href: '' }
  };
  windowObj.window = windowObj;

  const documentObj = {
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return fakeElement(); },
    body: fakeElement(),
    addEventListener() {},
    visibilityState: 'visible'
  };

  const context = {
    window: windowObj,
    document: documentObj,
    localStorage: storage,
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    setInterval() { return 0; },
    clearInterval() {},
    Date,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Set,
    Map,
    parseInt,
    parseFloat,
    isNaN,
    encodeURIComponent,
    decodeURIComponent,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    navigator: {},
    ROUTINE_SLOTS: {
      fullbodyA: {
        title: 'Fullbody A',
        slots: [{ slotId: 'fullbodyA_1', defaultExId: 'squat' }]
      },
      fullbodyB: {
        title: 'Fullbody B',
        slots: [{ slotId: 'fullbodyB_1', defaultExId: 'squat' }]
      }
    },
    EXERCISE_CATALOG: {
      squat: { name: 'Sentadilla', metricType: 'fuerza' }
    },
    workoutState: null,
    persistStateRaw() {},
    updateProgress() {},
    renderDaySelectorOptions() {},
    updateDayBannerLastDone() {},
    getNextRecommendedDay() { return null; },
    selectDay() {},
    openWorkoutSummaryModal() {},
    finishTimer() {}
  };
  context.globalThis = context;
  vm.createContext(context);

  const source = fs.readFileSync(path.join(__dirname, '..', 'watch_bridge.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'watch_bridge.js' });

  return {
    context,
    api: windowObj.__vigorexiWatchTest,
    storage
  };
}

function resetState(context, overrides = {}) {
  context.workoutState = Object.assign({
    inputs: {},
    notes: {},
    completed: [],
    previous: {},
    exerciseHistory: {},
    sessions: [],
    customSlots: {},
    tempSlots: {},
    sessionStartTime: {},
    lastActivityTime: {},
    setTimestamps: {},
    sessionIds: {}
  }, overrides);
}

function finishMessage(sessionId, date, exercises, extra = {}) {
  return {
    id: `msg-${sessionId}`,
    type: 'WORKOUT_FINISHED',
    ts: new Date(date).getTime(),
    payload: {
      sessionId,
      summary: Object.assign({
        sessionId,
        date,
        dayId: 'fullbodyA',
        dayName: 'Fullbody A',
        durationMinutes: 42,
        exercises
      }, extra)
    }
  };
}

function setMessage(sessionId, slotId, setIndex, kg, reps, completedAt, extra = {}) {
  return Object.assign({
    id: `msg-${sessionId}-${slotId}_${setIndex}-${completedAt}`,
    type: 'SET_COMPLETED',
    ts: completedAt,
    payload: {
      sessionId,
      dayId: 'fullbodyA',
      slotId,
      setIndex,
      kg,
      reps,
      completedAt
    }
  }, extra);
}

const { context, api } = loadBridge();
assert(api, 'watch_bridge debe exponer hooks de prueba');

console.log('Integrity regression tests');

(function testGhostSessionRequiresCompletedRows() {
  const now = Date.now();
  resetState(context, {
    completed: [],
    sessionStartTime: { fullbodyA: now },
    lastActivityTime: { fullbodyA: now },
    setTimestamps: { fullbodyA_1_0: now }
  });
  assert.strictEqual(api.isWorkoutActive('fullbodyA'), false, 'timestamps sin fila completada no deben activar sesión');
  assert.strictEqual(api.getActiveWorkoutDay(), null, 'un timer sin series no debe elegir día activo');

  context.workoutState.completed = ['fullbodyA_1_0'];
  assert.strictEqual(api.isWorkoutActive('fullbodyA'), true, 'una fila completada reciente sí debe activar sesión');

  context.workoutState.setTimestamps.fullbodyA_1_0 = now - 13 * 3600 * 1000;
  assert.strictEqual(api.isWorkoutActive('fullbodyA'), false, 'marcas de más de 12h no deben activar sesión');

  context.workoutState.completed = ['fullbodyB_1_0'];
  context.workoutState.setTimestamps = { fullbodyB_1_0: now };
  assert.strictEqual(api.isWorkoutActive('fullbodyA'), false, 'series de otro día no deben activar este día');

  api.clearSetTimestampsForDay('fullbodyA');
  api.clearSetTimestampsForDay('fullbodyB');
  assert.deepStrictEqual(context.workoutState.setTimestamps, {}, 'las marcas del día archivado deben limpiarse');
  console.log('  ok - sesión fantasma');
})();

(function testDedupMergesSetsInsteadOfDropping() {
  const now = Date.now();
  const oldDate = new Date(now - 10 * 60 * 1000).toISOString();
  resetState(context, {
    sessions: [{
      id: 'ses_pwa',
      date: oldDate,
      dayId: 'fullbodyA',
      dayName: 'Fullbody A',
      durationMinutes: 30,
      exercises: [{
        exId: 'squat',
        slotId: 'fullbodyA_1',
        sets: [{ set: 1, kg: 100, reps: 5, completed: true, timestamp: 1000 }]
      }]
    }]
  });

  const record = {
    id: 'watch-1',
    sessionId: 'watch-1',
    date: new Date(now).toISOString(),
    dayId: 'fullbodyA',
    dayName: 'Fullbody A',
    durationMinutes: 45,
    exercises: [
      { exId: 'squat', slotId: 'fullbodyA_1', sets: [
        { set: 1, kg: 50, reps: 2, completed: false, timestamp: 2000 },
        { set: 2, kg: 105, reps: 5, completed: true }
      ] },
      { exId: 'bench', slotId: 'fullbodyA_2', sets: [{ set: 1, kg: 80, reps: 8, completed: true }] }
    ]
  };

  api.insertSessionSorted(record);
  assert.strictEqual(context.workoutState.sessions.length, 1, 'no debe crear una sesión duplicada');
  const session = context.workoutState.sessions[0];
  const squat = session.exercises.find(e => e.exId === 'squat');
  assert.strictEqual(squat.sets.length, 2, 'debe conservar las series de ambos dispositivos');
  assert.strictEqual(squat.sets[0].kg, 100, 'una serie completada no debe sobrescribirse por una incompleta');
  assert.strictEqual(squat.sets[0].reps, 5, 'una serie completada conserva sus reps');
  assert(session.exercises.find(e => e.exId === 'bench'), 'debe añadir ejercicios nuevos');
  assert.strictEqual(session.durationMinutes, 45, 'debe conservar la duración mayor');
  assert.strictEqual(session.sessionId, 'watch-1', 'debe conservar el sessionId del reloj para idempotencia');
  console.log('  ok - deduplicación sin pérdida');
})();

(function testWatchFinishUpdatesHistoryAndClearsGhost() {
  const now = Date.now();
  resetState(context, {
    completed: ['fullbodyA_1_0'],
    sessionStartTime: { fullbodyA: now },
    lastActivityTime: { fullbodyA: now },
    setTimestamps: { fullbodyA_1_0: now }
  });

  const msg = finishMessage('watch-fin-1', new Date(now).toISOString(), [{
    exId: 'squat',
    name: 'Sentadilla',
    sets: [
      { set: 1, kg: 100, reps: 8, completed: true },
      { set: 2, kg: 100, reps: 6, completed: true }
    ]
  }]);

  assert.strictEqual(api.handleWorkoutFinishedFromWatch(msg, { silent: true }), true);
  assert.strictEqual(context.workoutState.sessions.length, 1, 'debe archivar la sesión del reloj');
  const history = context.workoutState.exerciseHistory.squat;
  assert(history && history.length === 1, 'debe registrar historial de squat');
  assert.strictEqual(history[0].sets.length, 2, 'debe registrar todas las series');
  assert.strictEqual(history[0].bestKg, 100);
  assert.strictEqual(history[0].bestReps, 8);
  assert.strictEqual(history[0].best1RM, 126.7, '1RM Epley con un decimal');
  assert.strictEqual(context.workoutState.setTimestamps.fullbodyA_1_0, undefined, 'debe limpiar timestamps del día');
  assert.deepStrictEqual(context.workoutState.completed, [], 'debe limpiar series completadas del día');

  const before = JSON.stringify(context.workoutState.exerciseHistory);
  assert.strictEqual(api.handleWorkoutFinishedFromWatch(msg, { silent: true }), true, 'el duplicado debe ser idempotente');
  assert.strictEqual(context.workoutState.sessions.length, 1, 'no debe duplicar la sesión');
  assert.strictEqual(JSON.stringify(context.workoutState.exerciseHistory), before, 'no debe duplicar historial');
  console.log('  ok - fin de reloj, historial e idempotencia');
})();

(function testPhoneAndWatchSameSessionMergeHistory() {
  const now = Date.now();
  const phoneDate = new Date(now - 5 * 60 * 1000).toISOString();
  resetState(context, {
    sessions: [{
      id: 'ses_phone',
      sessionId: 'ses_phone',
      date: phoneDate,
      dayId: 'fullbodyA',
      dayName: 'Fullbody A',
      durationMinutes: 40,
      exercises: [{
        exId: 'squat',
        slotId: 'fullbodyA_1',
        sets: [{ set: 1, kg: 100, reps: 5 }]
      }]
    }],
    exerciseHistory: {
      squat: [{
        date: phoneDate,
        sessionId: 'ses_phone',
        sets: [{ set: 1, kg: 100, reps: 5, est1RM: 116.7 }],
        bestKg: 100,
        bestReps: 5,
        best1RM: 116.7
      }]
    }
  });

  const msg = finishMessage('watch-fin-2', new Date(now).toISOString(), [{
    exId: 'squat',
    name: 'Sentadilla',
    sets: [
      { set: 1, kg: 100, reps: 5, completed: true },
      { set: 2, kg: 105, reps: 5, completed: true }
    ]
  }]);

  api.handleWorkoutFinishedFromWatch(msg, { silent: true });
  assert.strictEqual(context.workoutState.sessions.length, 1, 'móvil y reloj deben compartir una sola sesión');
  assert.strictEqual(context.workoutState.sessions[0].exercises[0].sets.length, 2, 'la sesión debe conservar series de ambos');
  assert.strictEqual(context.workoutState.exerciseHistory.squat.length, 1, 'el historial no debe duplicarse');
  assert.strictEqual(context.workoutState.exerciseHistory.squat[0].sets.length, 2, 'el historial debe fusionar series');
  console.log('  ok - fusión móvil + reloj');
})();

(function testWatchSetAdoptsSessionAndIgnoresStaleOrForeign() {
  const now = Date.now();
  resetState(context);

  const first = setMessage('watch-s1', 'fullbodyA_1', 0, 100, 5, now);
  assert.strictEqual(api.handleSetCompletedFromWatch(first, { silent: true }), true);
  assert.strictEqual(context.workoutState.sessionIds.fullbodyA, 'watch-s1', 'el móvil debe adoptar el sessionId del reloj');
  assert(context.workoutState.completed.includes('fullbodyA_1_0'), 'la serie debe quedar completada');
  assert.strictEqual(context.workoutState.inputs.fullbodyA_1_0_kg, '100');

  const stale = setMessage('watch-s1', 'fullbodyA_1', 0, 50, 2, now - 5000);
  assert.strictEqual(api.handleSetCompletedFromWatch(stale, { silent: true }), true, 'el evento antiguo se consume sin error');
  assert.strictEqual(context.workoutState.inputs.fullbodyA_1_0_kg, '100', 'un evento antiguo no debe sobrescribir pesos');
  assert.strictEqual(context.workoutState.setTimestamps.fullbodyA_1_0, now, 'un evento antiguo no debe retroceder la marca');

  const foreign = setMessage('watch-s2', 'fullbodyA_1', 0, 120, 8, now + 1000);
  assert.strictEqual(api.handleSetCompletedFromWatch(foreign, { silent: true }), true, 'la sesión ajena se consume sin error');
  assert.strictEqual(context.workoutState.inputs.fullbodyA_1_0_kg, '100', 'no debe mezclar series de otra sesión');
  assert.strictEqual(context.workoutState.completed.length, 1, 'no debe duplicar filas completadas');
  assert.strictEqual(context.workoutState.sessionIds.fullbodyA, 'watch-s1', 'no debe cambiar el sessionId activo');
  console.log('  ok - sessionId del reloj, eventos antiguos y sesiones ajenas');
})();

(function testArchivedSessionEventsDoNotResurrect() {
  const now = Date.now();
  resetState(context, {
    sessions: [{
      id: 'old-session',
      sessionId: 'old-session',
      date: new Date(now - 3600000).toISOString(),
      dayId: 'fullbodyA',
      exercises: []
    }]
  });

  const msg = setMessage('old-session', 'fullbodyA_1', 0, 90, 5, now);
  assert.strictEqual(api.handleSetCompletedFromWatch(msg, { silent: true }), true);
  assert.deepStrictEqual(context.workoutState.completed, [], 'un evento de sesión archivada no debe resucitar series');
  assert.strictEqual(context.workoutState.inputs.fullbodyA_1_0_kg, undefined);
  assert.strictEqual(context.workoutState.setTimestamps.fullbodyA_1_0, undefined);
  console.log('  ok - no resucitar sesiones archivadas');
})();

(function testPreArchiveEventsDoNotResurrectUnknownSession() {
  const now = Date.now();
  resetState(context, {
    sessions: [{
      id: 'ses_pwa_1',
      date: new Date(now).toISOString(),
      dayId: 'fullbodyA',
      exercises: []
    }]
  });

  const delayed = setMessage('watch-unlinked', 'fullbodyA_1', 0, 100, 5, now - 5000);
  assert.strictEqual(api.handleSetCompletedFromWatch(delayed, { silent: true }), true);
  assert.deepStrictEqual(context.workoutState.completed, [], 'un evento anterior al archivado no debe resucitar el día');
  assert.strictEqual(context.workoutState.sessionIds.fullbodyA, undefined);

  const fresh = setMessage('watch-new', 'fullbodyA_1', 0, 100, 5, now + 5000);
  assert.strictEqual(api.handleSetCompletedFromWatch(fresh, { silent: true }), true);
  assert(context.workoutState.completed.includes('fullbodyA_1_0'), 'una sesión nueva posterior al archivado sí debe aplicarse');
  assert.strictEqual(context.workoutState.sessionIds.fullbodyA, 'watch-new');
  console.log('  ok - eventos previos al archivado no resucitan sesiones sin id');
})();

(function testFinishFromForeignSessionIsIgnored() {
  const now = Date.now();
  resetState(context, {
    completed: ['fullbodyA_1_0'],
    sessionIds: { fullbodyA: 'web-1' },
    setTimestamps: { fullbodyA_1_0: now },
    sessionStartTime: { fullbodyA: now },
    lastActivityTime: { fullbodyA: now }
  });

  const foreign = finishMessage('watch-other', new Date(now).toISOString(), [{
    exId: 'squat',
    name: 'Sentadilla',
    sets: [{ set: 1, kg: 100, reps: 5, completed: true }]
  }]);
  assert.strictEqual(api.handleWorkoutFinishedFromWatch(foreign, { silent: true }), true);
  assert.strictEqual(context.workoutState.sessions.length, 0, 'no debe archivar una sesión de otro id');
  assert(context.workoutState.completed.includes('fullbodyA_1_0'), 'no debe borrar el progreso de la sesión activa');

  const matching = finishMessage('web-1', new Date(now + 1000).toISOString(), [{
    exId: 'squat',
    name: 'Sentadilla',
    sets: [{ set: 1, kg: 100, reps: 5, completed: true }]
  }]);
  assert.strictEqual(api.handleWorkoutFinishedFromWatch(matching, { silent: true }), true);
  assert.strictEqual(context.workoutState.sessions.length, 1, 'la sesión activa correcta sí debe archivarse');
  assert.deepStrictEqual(context.workoutState.completed, [], 'al archivar la sesión correcta se limpia el progreso');
  console.log('  ok - fin de sesión ajena ignorado');
})();

console.log('Todos los tests de integridad pasaron.');
