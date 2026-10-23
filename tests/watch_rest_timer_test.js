/**
 * VigorexiApp Watch - Persistencia del descanso y guardia de slot
 *
 * Comprueba el código real de watch/app.js extrayendo su objeto de definición
 * y ejecutándolo en un contexto aislado, sin depender de Zepp OS.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..');
const appSrc = fs.readFileSync(path.join(root, 'watch', 'app.js'), 'utf8');
const workoutSrc = fs.readFileSync(path.join(root, 'watch', 'page', 'workout', 'index.js'), 'utf8');
const timerSrc = fs.readFileSync(path.join(root, 'watch', 'page', 'timer', 'index.js'), 'utf8');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok  ' + name);
  } catch (err) {
    console.error('  FAIL ' + name);
    throw err;
  }
}

function extractBalanced(src, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let quote = '';
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error('Objeto de app.js sin cerrar');
}

function loadAppDefinition() {
  const marker = appSrc.indexOf('BaseApp({');
  assert(marker !== -1, 'No se encuentra BaseApp({ en watch/app.js');
  const body = extractBalanced(appSrc, appSrc.indexOf('{', marker));

  const saved = [];
  const context = {
    console,
    Date,
    Math,
    JSON,
    setTimeout,
    clearTimeout,
    loadWorkoutData() { return context.__savedData; },
    clearActiveSession() { context.__cleared = true; },
    saveActiveSession(payload) { saved.push(payload); },
    recordCompletedSession() {},
    flushOutbox() {},
    requestPhoneLiveWorkout() { return null; },
    enqueueSetCompletedEvent() {},
    enqueueWorkoutFinishedEvent() {},
    getPendingOutboxCount() { return 0; },
    mergeSessionLoggedSets(a) { return a; },
    ROUTINE_SLOTS: {},
    EXERCISE_CATALOG: {},
    __savedData: null,
    __savedRef: saved
  };
  vm.createContext(context);
  const definition = vm.runInContext('(' + body + ')', context);
  return { definition, context, saved };
}

function freshApp(savedData = null) {
  const loaded = loadAppDefinition();
  loaded.context.__savedData = savedData;
  return loaded;
}

test('iniciar descanso guarda endTime absoluto y lo persiste', () => {
  const { definition, saved } = freshApp();
  definition.globalData.activeDayId = 'fullbodyA';
  definition.globalData.sessionStartTime = Date.now();
  const before = Date.now();
  const rt = definition.startRestTimer(60, 'Sentadilla', 3);
  const after = Date.now();

  assert.strictEqual(rt.active, true);
  assert.strictEqual(rt.totalSeconds, 60);
  assert.strictEqual(rt.remainingSeconds, 60);
  assert.strictEqual(rt.nextExerciseName, 'Sentadilla');
  assert.strictEqual(rt.nextSetNum, 3);
  assert.ok(rt.endTime >= before + 60000 && rt.endTime <= after + 60000);

  assert.strictEqual(saved.length, 1);
  assert.strictEqual(saved[0].restTimer.active, true);
  assert.strictEqual(saved[0].restTimer.endTime, rt.endTime);
});

test('terminar descanso lo desactiva y persiste el cambio', () => {
  const { definition, saved } = freshApp();
  definition.globalData.activeDayId = 'fullbodyA';
  definition.globalData.sessionStartTime = Date.now();
  definition.startRestTimer(90, 'Remo', 1);
  saved.length = 0;

  const rt = definition.stopRestTimer();
  assert.strictEqual(rt.active, false);
  assert.strictEqual(saved.length, 1);
  assert.strictEqual(saved[0].restTimer.active, false);
});

test('persistir sesión incluye el descanso aunque esté inactivo', () => {
  const { definition, saved } = freshApp();
  definition.globalData.activeDayId = 'fullbodyA';
  definition.globalData.sessionStartTime = Date.now();
  definition.persistActiveSession();

  assert.strictEqual(saved.length, 1);
  assert.ok(Object.prototype.hasOwnProperty.call(saved[0], 'restTimer'));
  assert.strictEqual(saved[0].restTimer.active, false);
});

test('al reabrir restaura un descanso todavía en curso', () => {
  const now = Date.now();
  const { definition } = freshApp({
    activeSession: {
      activeDayId: 'fullbodyA',
      sessionId: 'watch-a',
      currentSlotIndex: 2,
      currentSetIndex: 1,
      sessionStartTime: now - 60000,
      sessionLoggedSets: {},
      restTimer: {
        active: true,
        endTime: now + 45000,
        remainingSeconds: 45,
        totalSeconds: 90,
        nextExerciseName: 'Press banca',
        nextSetNum: 2
      }
    }
  });

  definition.onCreate();

  const rt = definition.globalData.restTimer;
  assert.strictEqual(rt.active, true);
  assert.strictEqual(rt.nextExerciseName, 'Press banca');
  assert.strictEqual(rt.nextSetNum, 2);
  assert.ok(rt.remainingSeconds >= 43 && rt.remainingSeconds <= 45);
  // El total no puede quedar por debajo del tiempo restante.
  assert.ok(rt.totalSeconds >= rt.remainingSeconds);
});

test('un descanso vencido no se reactiva ni vibra al abrir la app', () => {
  const now = Date.now();
  const { definition } = freshApp({
    activeSession: {
      activeDayId: 'fullbodyA',
      sessionId: 'watch-b',
      currentSlotIndex: 0,
      currentSetIndex: 0,
      sessionStartTime: now - 600000,
      sessionLoggedSets: {},
      restTimer: {
        active: true,
        endTime: now - 5000,
        remainingSeconds: 0,
        totalSeconds: 90,
        nextExerciseName: 'Jalón',
        nextSetNum: 1
      }
    }
  });

  definition.onCreate();

  assert.strictEqual(definition.globalData.restTimer.active, false);
});

test('una sesión caducada se limpia y no restaura el descanso', () => {
  const now = Date.now();
  const { definition, context } = freshApp({
    activeSession: {
      activeDayId: 'fullbodyA',
      sessionStartTime: now - 9 * 3600 * 1000,
      restTimer: { active: true, endTime: now + 30000, remainingSeconds: 30, totalSeconds: 90 }
    }
  });

  definition.onCreate();

  assert.strictEqual(context.__cleared, true);
  assert.strictEqual(definition.globalData.restTimer.active, false);
});

test('initCurrentValues no toca el slot antes de comprobar que existe', () => {
  const guard = workoutSrc.indexOf('if (!slot) return');
  const allSets = workoutSrc.indexOf('const allLoggedSets =');
  const deref = workoutSrc.indexOf('allLoggedSets[slot.slotId]');
  assert.ok(guard !== -1, 'Falta la guardia de slot nulo');
  assert.ok(allSets !== -1, 'Falta la lectura defensiva de sessionLoggedSets');
  assert.ok(deref !== -1, 'No se encuentra el acceso a allLoggedSets');
  assert.ok(guard < allSets, 'La guardia debe ejecutarse antes de preparar las series');
  assert.ok(allSets < deref, 'La lectura defensiva debe preceder al acceso por slot');
});

test('el entreno usa startRestTimer y no crea descansos sueltos', () => {
  const uses = (workoutSrc.match(/app\.startRestTimer\(/g) || []).length;
  assert.ok(uses >= 4, 'Se esperaban al menos 4 usos de startRestTimer, hay ' + uses);
  assert.strictEqual(/globalData\.restTimer\s*=\s*\{/.test(workoutSrc), false);
});

test('la pantalla de descanso persiste al sumar tiempo y al saltar', () => {
  const addStart = timerSrc.indexOf('addTime(seconds) {');
  const addTime = timerSrc.slice(addStart, addStart + 700);
  assert.ok(addTime.includes('persistActiveSession'), '+15 s debe persistir el nuevo endTime');
  const finishStart = timerSrc.indexOf('finishRest() {');
  const finish = timerSrc.slice(finishStart, finishStart + 500);
  assert.ok(finish.includes('stopRestTimer'), 'Saltar debe persistir el descanso terminado');
});

console.log('\nWatch rest timer: ' + passed + '/' + passed + ' OK');
