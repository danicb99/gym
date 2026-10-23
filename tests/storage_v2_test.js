const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const S = require(path.join(__dirname, '..', 'storage_format.js'));
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'synthetic_fixture.json');
const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const swJs = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

const KEY = 'aesthetic_routine_data';
const LEGACY = 'aesthetic_routine_data_v1_backup';
const V2BACKUP = 'aesthetic_routine_data_v2_backup';
const CORRUPT = 'aesthetic_routine_data_v2_corrupt';
const MODE = 'aesthetic_routine_data_mode';
const META = 'aesthetic_routine_data_meta';
const PRE = 'vigorexiapp_pre_restore';
const DAY = 24 * 60 * 60 * 1000;

let passed = 0;
const failures = [];

function section(title) {
  console.log('\n' + title);
}

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  \u2713 ' + name);
  } catch (err) {
    failures.push({ name: name, err: err });
    console.log('  \u2717 ' + name);
    console.log('    ' + (err && err.message ? err.message.split('\n')[0] : String(err)));
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function roundTrip(state) {
  return S.decodeState(S.encodeState(state));
}

function assertRoundTrip(state, message) {
  const out = roundTrip(state);
  assert.strictEqual(S.deepEqual(out, state), true,
    (message || 'ida y vuelta distinta') + ' en ' + S.firstDifference(out, state));
  return out;
}

// Payload v2 realmente irrecuperable: una serie referenciada por índice sin pool.
// (Un valor `sessions` no-array sí es válido: se conserva tal cual.)
function corruptV2() {
  return {
    v: 2,
    state: {},
    names: [],
    sessions: [{ d: '1', day: 'd', ex: [{ t: [0] }] }]
  };
}

// ---------------------------------------------------------------------------
// Extracción de código real desde index.html
// ---------------------------------------------------------------------------
function sliceBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.ok(start >= 0, 'No se encontró el marcador inicial: ' + startNeedle);
  const end = source.indexOf(endNeedle, start);
  assert.ok(end >= 0, 'No se encontró el marcador final: ' + endNeedle);
  return source.slice(start, end);
}

// Empareja llaves respetando strings, plantillas y comentarios.
function extractFunction(source, name) {
  const needle = 'function ' + name + '(';
  const start = source.indexOf(needle);
  assert.ok(start >= 0, 'No se encontró la función ' + name);

  let depth = 0;
  let state = 'code';
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    const c = source[i];
    const next = source[i + 1];
    if (state === 'code') {
      if (c === "'") state = 'single';
      else if (c === '"') state = 'double';
      else if (c === '`') state = 'template';
      else if (c === '/' && next === '/') { state = 'line'; i++; }
      else if (c === '/' && next === '*') { state = 'block'; i++; }
      else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) return source.slice(start, i + 1);
      }
    } else if (state === 'single') {
      if (c === '\\') i++;
      else if (c === "'") state = 'code';
    } else if (state === 'double') {
      if (c === '\\') i++;
      else if (c === '"') state = 'code';
    } else if (state === 'template') {
      if (c === '\\') i++;
      else if (c === '`') state = 'code';
    } else if (state === 'line') {
      if (c === '\n') state = 'code';
    } else if (state === 'block') {
      if (c === '*' && next === '/') { state = 'code'; i++; }
    }
  }
  throw new Error('Función ' + name + ' sin cierre de llaves');
}

const ENGINE_SOURCE = sliceBetween(
  indexHtml,
  "const STORAGE_KEY = 'aesthetic_routine_data';",
  'let saveDebounceTimer = null;'
);
const FUNCTIONS_SOURCE = [
  extractFunction(indexHtml, 'defaultWorkoutState'),
  extractFunction(indexHtml, 'loadWorkoutState'),
  extractFunction(indexHtml, 'parseBackupText'),
  extractFunction(indexHtml, 'savePreRestoreSnapshot'),
  extractFunction(indexHtml, 'decodeSnapshot'),
  extractFunction(indexHtml, 'applyRestoredState')
].join('\n\n');

const PRELUDE = `
var workoutState = {};
const PRE_RESTORE_KEY = 'vigorexiapp_pre_restore';
const COACH_PERSONALITIES = ['sargento', 'ciencia', 'gymbro'];
var __toasts = [];
var __uiCalls = 0;
var __sanitizeCalls = 0;
var __broadcasts = 0;
function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function showToast(message) { __toasts.push(String(message)); }
function applyLoadedStateToUI() { __uiCalls++; }
function formatPreviousDisplay(value) { return value; }
function pruneOverloadSuggestions() {}
function sanitizeImportedState(parsed) {
  __sanitizeCalls++;
  const out = Object.assign({}, parsed);
  out.__sanitized = true;
  return out;
}
function __setState(next) { workoutState = next; }
function __getState() { return workoutState; }
`;

function createStorage(initial) {
  const data = new Map();
  const seed = initial || {};
  Object.keys(seed).forEach(function (key) {
    data.set(key, String(seed[key]));
  });
  const control = { failKey: null, failTimes: 0, readThrows: false };
  return {
    getItem: function (key) {
      if (control.readThrows) throw new Error('fallo de lectura simulado');
      return data.has(key) ? data.get(key) : null;
    },
    setItem: function (key, value) {
      if (control.failKey === key && control.failTimes > 0) {
        control.failTimes--;
        const err = new Error('quota simulada');
        err.name = 'QuotaExceededError';
        err.code = 22;
        throw err;
      }
      data.set(key, String(value));
    },
    removeItem: function (key) { data.delete(key); },
    clear: function () { data.clear(); },
    key: function (index) { return Array.from(data.keys())[index] || null; },
    get length() { return data.size; },
    _data: data,
    _control: control
  };
}

function createHarness(options) {
  const opts = options || {};
  const storage = opts.storage || createStorage(opts.initial);
  const format = opts.module === undefined ? S : opts.module;
  const logs = [];
  const windowObj = {};
  if (format) windowObj.VigorexiStorage = format;

  const sandbox = {
    localStorage: storage,
    window: windowObj,
    console: {
      log: function () { logs.push({ level: 'log', args: Array.from(arguments) }); },
      warn: function () { logs.push({ level: 'warn', args: Array.from(arguments) }); },
      error: function () { logs.push({ level: 'error', args: Array.from(arguments) }); }
    },
    setTimeout: function () { return 0; },
    clearTimeout: function () {}
  };

  const context = vm.createContext(sandbox);
  vm.runInContext(PRELUDE, context, { filename: 'prelude.js' });
  vm.runInContext('window.VigorexiWatchSync = { broadcast: function () { __broadcasts++; } };', context);
  vm.runInContext(ENGINE_SOURCE, context, { filename: 'engine.js' });
  vm.runInContext(FUNCTIONS_SOURCE, context, { filename: 'functions.js' });

  function call(name) {
    const args = Array.prototype.slice.call(arguments, 1);
    if (!args.length) return vm.runInContext(name + '()', context);
    sandbox.__callArgs = args;
    try {
      return vm.runInContext(name + '(...__callArgs)', context);
    } finally {
      delete sandbox.__callArgs;
    }
  }

  return {
    context: context,
    storage: storage,
    logs: logs,
    call: call,
    setState: function (state) { context.__setState(state); },
    state: function () { return vm.runInContext('__getState()', context); },
    toasts: function () { return Array.from(vm.runInContext('__toasts', context)); },
    uiCalls: function () { return vm.runInContext('__uiCalls', context); },
    sanitizeCalls: function () { return vm.runInContext('__sanitizeCalls', context); },
    broadcasts: function () { return vm.runInContext('__broadcasts', context); },
    rollback: function () { return vm.runInContext('window.__vigorexiRollbackV1()', context); }
  };
}

function decodeStored(harness) {
  return JSON.parse(JSON.stringify(harness.call('decodeStoredState')));
}

console.log('====================================================');
console.log('\uD83E\uDDEA VigorexiApp - Almacenamiento compacto v2');
console.log('====================================================');

// ===========================================================================
section('\uD83D\uDCE6 1. Módulo de formato: paridad y compresión');
// ===========================================================================

test('fixture sintético: ida y vuelta exacta', function () {
  const out = roundTrip(fixture);
  assert.strictEqual(S.deepEqual(out, fixture), true,
    'Diferencia en ' + S.firstDifference(out, fixture));
});

test('codificar no muta el estado de origen', function () {
  const snapshot = JSON.stringify(fixture);
  S.encodeState(fixture);
  assert.strictEqual(JSON.stringify(fixture), snapshot);
});

test('codificación idempotente (encode -> decode -> encode)', function () {
  const first = JSON.stringify(S.encodeState(fixture));
  const second = JSON.stringify(S.encodeState(S.decodeState(JSON.parse(first))));
  assert.strictEqual(first, second);
});

test('v2 ocupa menos que el v1 canónico', function () {
  const v1 = JSON.stringify(fixture).length;
  const v2 = JSON.stringify(S.encodeState(fixture)).length;
  assert.ok(v2 < v1, 'v2=' + v2 + ' v1=' + v1);
  assert.ok(v2 / v1 < 0.9, 'ratio=' + (v2 / v1));
});

test('pool: series idénticas se guardan una sola vez', function () {
  const repeated = {
    sessions: [{
      date: '2026-01-01', dayId: 'd', exercises: [{
        name: 'x',
        sets: [
          { kg: '10', reps: '5', est1RM: 12 },
          { kg: '10', reps: '5', est1RM: 12 },
          { kg: '10', reps: '5', est1RM: 12 }
        ]
      }]
    }],
    exerciseHistory: {}
  };
  const enc = S.encodeState(repeated);
  assert.strictEqual(enc.pool.length, 1);
  assert.deepStrictEqual(Array.from(enc.sessions[0].ex[0].t), [0, 0, 0]);
  assertRoundTrip(repeated);
});

test('pool: cada referencia se clona al decodificar', function () {
  const repeated = {
    sessions: [{
      date: '2026-01-01', dayId: 'd',
      exercises: [{ name: 'x', sets: [{ kg: '10' }, { kg: '10' }] }]
    }],
    exerciseHistory: {}
  };
  const dec = S.decodeState(S.encodeState(repeated));
  dec.sessions[0].exercises[0].sets[0].kg = '99';
  assert.strictEqual(dec.sessions[0].exercises[0].sets[1].kg, '10');
});

test('names: nombres repetidos se agrupan', function () {
  const state = {
    sessions: [
      {
        date: '1', dayId: 'a', dayName: 'Día A',
        exercises: [
          { name: 'Sentadilla', sets: [] },
          { name: 'Sentadilla', sets: [] }
        ]
      },
      { date: '2', dayId: 'b', dayName: 'Día A', exercises: [{ name: 'Banca', sets: [] }] }
    ],
    exerciseHistory: {}
  };
  const enc = S.encodeState(state);
  assert.deepStrictEqual(Array.from(enc.names), ['Día A', 'Sentadilla', 'Banca']);
  assertRoundTrip(state);
});

test('names: valores no string se conservan', function () {
  const state = {
    sessions: [{ dayName: null, exercises: [{ name: 42, sets: [] }, { name: { x: 1 }, sets: [] }] }],
    exerciseHistory: {}
  };
  assertRoundTrip(state);
});

test('estimateBytes mide el JSON serializado', function () {
  assert.strictEqual(S.estimateBytes({ a: 1 }), JSON.stringify({ a: 1 }).length);
  assert.strictEqual(S.estimateBytes(undefined), Infinity);
});

// ===========================================================================
section('\uD83D\uDD0D 2. Presencia estricta: null, "", 0 y ausencia');
// ===========================================================================

test('serie: null, cadena vacía y 0 sobreviven', function () {
  const state = {
    exerciseHistory: {
      ex: [{
        date: 'x',
        sets: [
          { kg: null, reps: '', est1RM: 0, set: 0, completed: false, timestamp: 0, completedAt: '', notes: null },
          { set: 1 }
        ]
      }]
    },
    sessions: []
  };
  const out = roundTrip(state);
  const a = out.exerciseHistory.ex[0].sets[0];
  const b = out.exerciseHistory.ex[0].sets[1];
  assert.ok(has(a, 'kg') && a.kg === null);
  assert.ok(has(a, 'reps') && a.reps === '');
  assert.ok(has(a, 'est1RM') && a.est1RM === 0);
  assert.ok(has(a, 'set') && a.set === 0);
  assert.ok(has(a, 'completed') && a.completed === false);
  assert.ok(has(a, 'timestamp') && a.timestamp === 0);
  assert.ok(has(a, 'completedAt') && a.completedAt === '');
  assert.ok(has(a, 'notes') && a.notes === null);
  assert.deepStrictEqual(Object.keys(b), ['set']);
});

test('serie: completed conserva booleano, string, número y null', function () {
  const variants = [true, false, 'yes', 0, 1, null];
  const state = {
    sessions: [{
      date: '1', dayId: 'd',
      exercises: [{ sets: variants.map(function (v, i) { return { set: i, completed: v }; }) }]
    }],
    exerciseHistory: {}
  };
  const out = roundTrip(state);
  assert.deepStrictEqual(
    Array.from(out.sessions[0].exercises[0].sets).map(function (s) { return s.completed; }),
    variants
  );
});

test('claves desconocidas se conservan en todos los niveles', function () {
  const state = {
    rootUnknown: { nested: [1, null, ''] },
    sessions: [{
      date: '1', dayId: 'd', foo: 'bar',
      exercises: [{
        name: 'x', mood: 'happy',
        sets: [{ kg: '1', rpe: 8, st: 'custom', p: 'no-bitmask' }]
      }]
    }],
    exerciseHistory: {
      ex: [{ date: '1', sets: [{ reps: '2', zz: { a: 1 } }], source: 'watch' }]
    }
  };
  const out = roundTrip(state);
  assert.strictEqual(S.deepEqual(out, state), true,
    'Diferencia en ' + S.firstDifference(out, state));
});

test('best*: presencia parcial y null explícito', function () {
  const state = {
    sessions: [{
      date: '1', dayId: 'd',
      exercises: [
        { name: 'a', bestReps: 0 },
        { name: 'b', bestKg: null, bestReps: null, best1RM: null }
      ]
    }],
    exerciseHistory: {}
  };
  const out = roundTrip(state);
  const a = out.sessions[0].exercises[0];
  const b = out.sessions[0].exercises[1];
  assert.deepStrictEqual(Object.keys(a).sort(), ['bestReps', 'name']);
  assert.deepStrictEqual(Object.keys(b).sort(), ['best1RM', 'bestKg', 'bestReps', 'name']);
  assert.strictEqual(b.bestKg, null);
});

test('estructuras no canónicas se conservan sin reinterpretar', function () {
  const state = {
    sessions: 'not-an-array',
    exerciseHistory: [1, 2, 3],
    rootNull: null,
    rootArr: [true, 0, '']
  };
  assertRoundTrip(state);
});

test('claves ausentes no se inventan', function () {
  assert.deepStrictEqual(roundTrip({}), {});
  const out = roundTrip({ sessions: [] });
  assert.deepStrictEqual(Object.keys(out), ['sessions']);
  assert.ok(!has(out, 'exerciseHistory'));
});

test('historial: valores no array se conservan', function () {
  const state = { exerciseHistory: { a: { legacy: true }, b: [null, 'raw'] } };
  assertRoundTrip(state);
});

test('sesión: exercises no array se conserva', function () {
  const state = { sessions: [{ date: '1', dayId: 'd', exercises: { 0: 'x' } }], exerciseHistory: {} };
  assertRoundTrip(state);
});

test('ejercicio: sets no array se conserva', function () {
  const state = { sessions: [{ date: '1', dayId: 'd', exercises: [{ name: 'x', sets: 'n/a' }] }], exerciseHistory: {} };
  assertRoundTrip(state);
});

test('valores undefined no se persisten (semántica JSON)', function () {
  const enc = S.encodeState({ a: undefined, b: 1 });
  assert.ok(!has(enc.state, 'a'));
  assert.deepStrictEqual(S.decodeState(enc), { b: 1 });
});

test('un objeto con clave __raw legítima no se confunde con un crudo', function () {
  const state = {
    exerciseHistory: { ex: [{ date: '1', sets: [], __raw: { keep: true } }] },
    sessions: []
  };
  assertRoundTrip(state);
});

// ===========================================================================
section('\uD83D\uDEE1\uFE0F 3. Decodificación fail-closed');
// ===========================================================================

test('decodePayload: texto que no es JSON', function () {
  const r = S.decodePayload('{nope');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'parse_error');
});

test('decodePayload: payload que no es objeto', function () {
  assert.strictEqual(S.decodePayload('[1]').reason, 'invalid_payload');
  assert.strictEqual(S.decodePayload('null').reason, 'invalid_payload');
  assert.strictEqual(S.decodePayload('42').reason, 'invalid_payload');
});

test('decodePayload: formas v2 inválidas no producen estado', function () {
  const shapes = [
    { v: 2, state: 'x' },
    { v: 2, names: {} },
    { v: 2, sessions: {} },
    { v: 2, hist: [] },
    { v: 2, histRaw: [] },
    { v: 2, pool: {} }
  ];
  shapes.forEach(function (payload) {
    const r = S.decodePayload(payload);
    assert.strictEqual(r.ok, false, JSON.stringify(payload));
    assert.strictEqual(r.reason, 'invalid_v2', JSON.stringify(payload));
    assert.strictEqual(r.v, 2);
  });
});

test('decodePayload: referencia de serie sin pool falla', function () {
  const payload = {
    v: 2, state: {}, names: [], pool: [],
    sessions: [{ d: '1', day: 'd', ex: [{ n: 0, t: [0] }] }]
  };
  payload.pool = [];
  // Sin `pool` presente, la referencia numérica no se puede resolver.
  delete payload.pool;
  const r = S.decodePayload(payload);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'invalid_v2');
});

test('decodePayload: referencia de serie fuera de rango falla', function () {
  const r = S.decodePayload({
    v: 2, state: {}, names: ['a'], pool: [['1', '2', 3]],
    sessions: [{ ex: [{ n: 0, t: [1] }] }]
  });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'invalid_v2');
});

test('decodePayload: índice de nombre fuera de rango falla', function () {
  const r = S.decodePayload({
    v: 2, state: {}, names: ['a'], pool: [],
    sessions: [{ ex: [{ n: 1 }] }]
  });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'invalid_v2');
});

test('decodePayload: v2 mínimo válido', function () {
  const r = S.decodePayload({ v: 2, state: { foo: 1 }, names: [], pool: [] });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.v, 2);
  assert.deepStrictEqual(r.state, { foo: 1 });
});

test('decodePayload: v1 se acepta tal cual', function () {
  const r = S.decodePayload({ v: 1, foo: 'bar' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.v, 1);
  assert.strictEqual(r.state.foo, 'bar');
});

test('decodeState exige la marca de versión v2', function () {
  assert.throws(function () { S.decodeState({ v: 1 }); }, /Formato v2 inválido/);
  assert.throws(function () { S.decodeState(null); }, /Formato v2 inválido/);
});

// ===========================================================================
section('\uD83D\uDD27 4. Motor de persistencia (código real de index.html)');
// ===========================================================================

test('el motor se extrae completo e incluye el rollback', function () {
  assert.ok(ENGINE_SOURCE.includes('function persistStateRaw'));
  assert.ok(ENGINE_SOURCE.includes('function maybeMigrateLegacyState'));
  assert.ok(ENGINE_SOURCE.includes('function cleanupLegacyBackup'));
  assert.ok(ENGINE_SOURCE.includes('window.__vigorexiRollbackV1 = function'));
});

test('storageReady: true con el módulo real', function () {
  const h = createHarness();
  assert.strictEqual(h.call('storageReady'), true);
});

test('storageReady: false sin módulo', function () {
  const h = createHarness({ module: null });
  assert.strictEqual(h.call('storageReady'), false);
});

test('storageReady: false si la autocomprobación no coincide', function () {
  const lossy = Object.assign({}, S, { deepEqual: function () { return false; } });
  const h = createHarness({ module: lossy });
  assert.strictEqual(h.call('storageReady', true), false);
});

test('persistStateRaw: escribe v2 en modo auto', function () {
  const h = createHarness();
  h.setState(clone(fixture));
  assert.strictEqual(h.call('persistStateRaw'), true);
  const raw = h.storage.getItem(KEY);
  const parsed = JSON.parse(raw);
  assert.strictEqual(parsed.v, 2);
  assert.strictEqual(S.deepEqual(S.decodePayload(raw).state, fixture), true);
});

test('persistStateRaw: modo off escribe v1 canónico', function () {
  const h = createHarness({ initial: { [MODE]: 'off' } });
  h.setState(clone(fixture));
  assert.strictEqual(h.call('persistStateRaw'), true);
  const raw = h.storage.getItem(KEY);
  assert.strictEqual(JSON.parse(raw).v, undefined);
  assert.strictEqual(S.deepEqual(JSON.parse(raw), fixture), true);
});

test('persistStateRaw: sin módulo no sobrescribe nada', function () {
  const h = createHarness({ module: null, initial: { [KEY]: '{old' } });
  h.setState(clone(fixture));
  assert.strictEqual(h.call('persistStateRaw'), false);
  assert.strictEqual(h.storage.getItem(KEY), '{old');
  assert.strictEqual(h.toasts().length, 1);
  h.call('persistStateRaw');
  assert.strictEqual(h.toasts().length, 1, 'el aviso no debe repetirse');
});

test('persistStateRaw: si compactar falla no sobrescribe', function () {
  let calls = 0;
  const flaky = Object.assign({}, S, {
    encodeState: function (state) {
      calls++;
      if (calls > 1) throw new Error('fallo de codificación');
      return S.encodeState(state);
    }
  });
  const h = createHarness({ module: flaky, initial: { [KEY]: 'old' } });
  h.setState(clone(fixture));
  assert.strictEqual(h.call('persistStateRaw'), false);
  assert.strictEqual(h.storage.getItem(KEY), 'old');
});

test('cuota: libera el snapshot previo y reintenta', function () {
  const h = createHarness({ initial: { [PRE]: 'snapshot', [KEY]: 'old' } });
  h.storage._control.failKey = KEY;
  h.storage._control.failTimes = 1;
  h.setState(clone(fixture));
  assert.strictEqual(h.call('persistStateRaw'), true);
  assert.strictEqual(h.storage.getItem(PRE), null);
  assert.notStrictEqual(h.storage.getItem(KEY), 'old');
  assert.ok(h.toasts().some(function (t) { return t.indexOf('liberó espacio') >= 0; }));
});

test('cuota: sin snapshot previo no borra nada extra', function () {
  const h = createHarness({ initial: { [KEY]: 'old' } });
  h.storage._control.failKey = KEY;
  h.storage._control.failTimes = 1;
  h.setState(clone(fixture));
  assert.strictEqual(h.call('persistStateRaw'), false);
  assert.strictEqual(h.storage.getItem(KEY), 'old');
  assert.ok(h.toasts().some(function (t) { return t.indexOf('Almacenamiento lleno') >= 0; }));
});

test('cuota: si el reintento también falla devuelve false', function () {
  const h = createHarness({ initial: { [PRE]: 'snapshot', [KEY]: 'old' } });
  h.storage._control.failKey = KEY;
  h.storage._control.failTimes = Infinity;
  h.setState(clone(fixture));
  assert.strictEqual(h.call('persistStateRaw'), false);
  assert.strictEqual(h.storage.getItem(PRE), null);
  assert.strictEqual(h.storage.getItem(KEY), 'old');
});

test('decodeStoredState: vacío', function () {
  const h = createHarness();
  assert.strictEqual(decodeStored(h).status, 'empty');
});

test('decodeStoredState: v1 válido', function () {
  const h = createHarness({ initial: { [KEY]: JSON.stringify(fixture) } });
  const read = decodeStored(h);
  assert.strictEqual(read.status, 'ok');
  assert.strictEqual(read.v, 1);
  assert.strictEqual(S.deepEqual(read.state, fixture), true);
});

test('decodeStoredState: v2 válido', function () {
  const h = createHarness({ initial: { [KEY]: JSON.stringify(S.encodeState(fixture)) } });
  const read = decodeStored(h);
  assert.strictEqual(read.status, 'ok');
  assert.strictEqual(read.v, 2);
  assert.strictEqual(S.deepEqual(read.state, fixture), true);
});

test('decodeStoredState: v2 dañado se marca invalid_v2', function () {
  const raw = JSON.stringify(corruptV2());
  const h = createHarness({ initial: { [KEY]: raw } });
  const read = decodeStored(h);
  assert.strictEqual(read.status, 'invalid_v2');
  assert.strictEqual(read.raw, raw);
});

test('decodeStoredState: JSON corrupto', function () {
  const h = createHarness({ initial: { [KEY]: '{bad' } });
  assert.strictEqual(decodeStored(h).status, 'corrupt');
});

test('decodeStoredState: v2 sin módulo no se toca', function () {
  const raw = JSON.stringify(S.encodeState(fixture));
  const h = createHarness({ module: null, initial: { [KEY]: raw } });
  const read = decodeStored(h);
  assert.strictEqual(read.status, 'unavailable_v2');
  assert.strictEqual(read.raw, raw);
});

test('decodeStoredState: v1 sin módulo se puede leer', function () {
  const h = createHarness({ module: null, initial: { [KEY]: JSON.stringify(fixture) } });
  const read = decodeStored(h);
  assert.strictEqual(read.status, 'ok');
  assert.strictEqual(read.v, 1);
});

test('decodeStoredState: error de lectura', function () {
  const h = createHarness({ initial: { [KEY]: JSON.stringify(fixture) } });
  h.storage._control.readThrows = true;
  assert.strictEqual(decodeStored(h).status, 'error');
});

// ===========================================================================
section('\uD83D\uDE9A 5. Migración v1 -> v2');
// ===========================================================================

test('migración: escribe v2, copia legacy y marca el modo', function () {
  const raw = JSON.stringify(fixture);
  const h = createHarness({ initial: { [KEY]: raw } });
  h.call('maybeMigrateLegacyState', h.call('decodeStoredState'));

  const migrated = h.storage.getItem(KEY);
  assert.strictEqual(JSON.parse(migrated).v, 2);
  assert.strictEqual(S.deepEqual(S.decodePayload(migrated).state, fixture), true);
  assert.strictEqual(h.storage.getItem(LEGACY), raw);
  assert.strictEqual(h.storage.getItem(MODE), 'on');

  const meta = JSON.parse(h.storage.getItem(META));
  assert.ok(!Number.isNaN(new Date(meta.migratedAt).getTime()));
  assert.strictEqual(meta.starts, 0);
});

test('migración: el marcador off la desactiva de forma permanente', function () {
  const raw = JSON.stringify(fixture);
  const h = createHarness({ initial: { [KEY]: raw, [MODE]: 'off' } });
  h.call('maybeMigrateLegacyState', h.call('decodeStoredState'));
  assert.strictEqual(h.storage.getItem(KEY), raw);
  assert.strictEqual(h.storage.getItem(LEGACY), null);
  assert.strictEqual(h.storage.getItem(MODE), 'off');
});

test('migración: sin módulo no escribe nada', function () {
  const raw = JSON.stringify(fixture);
  const h = createHarness({ module: null, initial: { [KEY]: raw } });
  h.call('maybeMigrateLegacyState', h.call('decodeStoredState'));
  assert.strictEqual(h.storage.getItem(KEY), raw);
  assert.strictEqual(h.storage.getItem(LEGACY), null);
  assert.strictEqual(h.storage.getItem(MODE), null);
});

test('migración: si la ida y vuelta no coincide se aborta', function () {
  const raw = JSON.stringify(fixture);
  const lossy = Object.assign({}, S, { deepEqual: function () { return false; } });
  const h = createHarness({ module: lossy, initial: { [KEY]: raw } });
  h.call('maybeMigrateLegacyState', h.call('decodeStoredState'));
  assert.strictEqual(h.storage.getItem(KEY), raw);
  assert.strictEqual(h.storage.getItem(LEGACY), null);
  assert.strictEqual(h.storage.getItem(MODE), null);
});

test('migración: si falla la copia legacy no escribe v2', function () {
  const raw = JSON.stringify(fixture);
  const h = createHarness({ initial: { [KEY]: raw } });
  h.storage._control.failKey = LEGACY;
  h.storage._control.failTimes = Infinity;
  h.call('maybeMigrateLegacyState', h.call('decodeStoredState'));
  assert.strictEqual(h.storage.getItem(KEY), raw);
  assert.strictEqual(h.storage.getItem(MODE), null);
});

test('migración: si falla v2 conserva la copia legacy para reintentar', function () {
  const raw = JSON.stringify(fixture);
  const h = createHarness({ initial: { [KEY]: raw } });
  h.storage._control.failKey = KEY;
  h.storage._control.failTimes = Infinity;
  h.call('maybeMigrateLegacyState', h.call('decodeStoredState'));
  assert.strictEqual(h.storage.getItem(KEY), raw);
  assert.strictEqual(h.storage.getItem(LEGACY), raw);
  assert.strictEqual(h.storage.getItem(MODE), null);
});

test('migración: no actúa sobre v2 ni sobre lecturas dañadas', function () {
  const v2raw = JSON.stringify(S.encodeState(fixture));
  const h = createHarness({ initial: { [KEY]: v2raw } });
  h.call('maybeMigrateLegacyState', h.call('decodeStoredState'));
  assert.strictEqual(h.storage.getItem(KEY), v2raw);
  assert.strictEqual(h.storage.getItem(LEGACY), null);

  const h2 = createHarness({ initial: { [KEY]: '{bad' } });
  h2.call('maybeMigrateLegacyState', h2.call('decodeStoredState'));
  assert.strictEqual(h2.storage.getItem(KEY), '{bad');
  assert.strictEqual(h2.storage.getItem(LEGACY), null);
});

// ===========================================================================
section('\uD83E\uDDF9 6. Contador de arranques y limpieza del legacy');
// ===========================================================================

test('countStorageStart: solo cuenta en modo on', function () {
  const h = createHarness({ initial: { [MODE]: 'on' } });
  h.call('countStorageStart');
  assert.strictEqual(JSON.parse(h.storage.getItem(META)).starts, 1);
  h.call('countStorageStart');
  assert.strictEqual(JSON.parse(h.storage.getItem(META)).starts, 2);

  const h2 = createHarness({ initial: { [MODE]: 'auto' } });
  h2.call('countStorageStart');
  assert.strictEqual(h2.storage.getItem(META), null);

  const h3 = createHarness({ initial: { [MODE]: 'off' } });
  h3.call('countStorageStart');
  assert.strictEqual(h3.storage.getItem(META), null);
});

test('countStorageStart: tolera metadatos inválidos', function () {
  const h = createHarness({ initial: { [MODE]: 'on', [META]: 'not-json' } });
  h.call('countStorageStart');
  assert.strictEqual(JSON.parse(h.storage.getItem(META)).starts, 1);
});

function cleanupHarness(overrides) {
  const initial = {
    [KEY]: JSON.stringify(S.encodeState(fixture)),
    [LEGACY]: JSON.stringify(fixture),
    [MODE]: 'on',
    [META]: JSON.stringify({ migratedAt: new Date(Date.now() - 15 * DAY).toISOString(), starts: 5 })
  };
  Object.assign(initial, overrides || {});
  return createHarness({ initial: initial });
}

test('limpieza: retira el legacy tras 14 días y 5 arranques', function () {
  const h = cleanupHarness();
  h.call('cleanupLegacyBackup');
  assert.strictEqual(h.storage.getItem(LEGACY), null);
  assert.notStrictEqual(h.storage.getItem(KEY), null);
});

test('limpieza: conserva el legacy antes de 14 días', function () {
  const h = cleanupHarness({
    [META]: JSON.stringify({ migratedAt: new Date(Date.now() - 13 * DAY).toISOString(), starts: 5 })
  });
  h.call('cleanupLegacyBackup');
  assert.notStrictEqual(h.storage.getItem(LEGACY), null);
});

test('limpieza: conserva el legacy con menos de 5 arranques', function () {
  const h = cleanupHarness({
    [META]: JSON.stringify({ migratedAt: new Date(Date.now() - 15 * DAY).toISOString(), starts: 4 })
  });
  h.call('cleanupLegacyBackup');
  assert.notStrictEqual(h.storage.getItem(LEGACY), null);
});

test('limpieza: nunca actúa en modo off', function () {
  const h = cleanupHarness({ [MODE]: 'off' });
  h.call('cleanupLegacyBackup');
  assert.notStrictEqual(h.storage.getItem(LEGACY), null);
});

test('limpieza: se conserva si el guardado actual no es v2 válido', function () {
  const corrupt = cleanupHarness({ [KEY]: '{bad' });
  corrupt.call('cleanupLegacyBackup');
  assert.notStrictEqual(corrupt.storage.getItem(LEGACY), null);

  const v1 = cleanupHarness({ [KEY]: JSON.stringify(fixture) });
  v1.call('cleanupLegacyBackup');
  assert.notStrictEqual(v1.storage.getItem(LEGACY), null);
});

test('limpieza: sin fecha de migración no hace nada', function () {
  const h = cleanupHarness({ [META]: JSON.stringify({ starts: 10 }) });
  h.call('cleanupLegacyBackup');
  assert.notStrictEqual(h.storage.getItem(LEGACY), null);
});

// ===========================================================================
section('\u21A9\uFE0F 7. Rollback explícito a v1');
// ===========================================================================

test('rollback: restaura v1, respalda v2 y desactiva la migración', function () {
  const legacyRaw = JSON.stringify(fixture);
  const v2raw = JSON.stringify(S.encodeState({ notes: { a: '1' }, sessions: [], exerciseHistory: {} }));
  const h = createHarness({ initial: { [KEY]: v2raw, [LEGACY]: legacyRaw } });

  assert.strictEqual(h.rollback(), true);
  assert.strictEqual(h.storage.getItem(KEY), legacyRaw);
  assert.strictEqual(h.storage.getItem(V2BACKUP), v2raw);
  assert.strictEqual(h.storage.getItem(MODE), 'off');
  assert.ok(h.uiCalls() > 0, 'debe recargar la interfaz');
  assert.ok(h.toasts().some(function (t) { return t.indexOf('formato anterior') >= 0; }));
});

test('rollback: tras volver a v1 se sigue guardando en v1', function () {
  const legacyRaw = JSON.stringify(fixture);
  const h = createHarness({ initial: { [KEY]: 'v2', [LEGACY]: legacyRaw } });
  h.rollback();
  h.setState({ notes: { x: 'y' }, sessions: [], exerciseHistory: {} });
  assert.strictEqual(h.call('persistStateRaw'), true);
  assert.strictEqual(JSON.parse(h.storage.getItem(KEY)).v, undefined);
});

test('rollback: sin copia legacy aborta sin cambios', function () {
  const h = createHarness({ initial: { [KEY]: 'v2' } });
  assert.strictEqual(h.rollback(), false);
  assert.strictEqual(h.storage.getItem(KEY), 'v2');
  assert.strictEqual(h.storage.getItem(MODE), null);
});

test('rollback: copia legacy corrupta o v2 aborta', function () {
  const bad = createHarness({ initial: { [KEY]: 'v2', [LEGACY]: '{bad' } });
  assert.strictEqual(bad.rollback(), false);
  assert.strictEqual(bad.storage.getItem(KEY), 'v2');

  const v2legacy = createHarness({ initial: { [KEY]: 'v2', [LEGACY]: JSON.stringify({ v: 2, state: {} }) } });
  assert.strictEqual(v2legacy.rollback(), false);
  assert.strictEqual(v2legacy.storage.getItem(KEY), 'v2');
});

test('rollback: si no puede respaldar v2 aborta', function () {
  const h = createHarness({ initial: { [KEY]: 'v2', [LEGACY]: JSON.stringify(fixture) } });
  h.storage._control.failKey = V2BACKUP;
  h.storage._control.failTimes = Infinity;
  assert.strictEqual(h.rollback(), false);
  assert.strictEqual(h.storage.getItem(KEY), 'v2');
  assert.strictEqual(h.storage.getItem(MODE), null);
});

test('rollback: si no puede escribir v1 aborta', function () {
  const h = createHarness({ initial: { [KEY]: 'v2', [LEGACY]: JSON.stringify(fixture) } });
  h.storage._control.failKey = KEY;
  h.storage._control.failTimes = Infinity;
  assert.strictEqual(h.rollback(), false);
  assert.strictEqual(h.storage.getItem(KEY), 'v2');
  assert.strictEqual(h.storage.getItem(MODE), null);
});

// ===========================================================================
section('\uD83D\uDCD6 8. Carga completa del estado');
// ===========================================================================

test('loadWorkoutState: almacenamiento vacío usa los valores por defecto', function () {
  const h = createHarness();
  h.call('loadWorkoutState');
  const state = JSON.parse(JSON.stringify(h.state()));
  assert.deepStrictEqual(state.sessions, []);
  assert.deepStrictEqual(state.notes, {});
  assert.strictEqual(state.coachPersonality, 'gymbro');
  assert.strictEqual(h.uiCalls(), 1);
});

test('loadWorkoutState: v1 carga y migra', function () {
  const h = createHarness({ initial: { [KEY]: JSON.stringify(fixture) } });
  h.call('loadWorkoutState');
  const state = h.state();
  assert.strictEqual(S.deepEqual(state.exerciseHistory, fixture.exerciseHistory), true);
  assert.deepStrictEqual(
    Array.from(state.sessions).map(function (s) { return s.id; }),
    ['s3', 's2', 's1']
  );
  assert.strictEqual(h.storage.getItem(MODE), 'on');
  assert.notStrictEqual(h.storage.getItem(LEGACY), null);
  assert.strictEqual(h.uiCalls(), 1);
});

test('loadWorkoutState: v2 carga sin volver a migrar', function () {
  const raw = JSON.stringify(S.encodeState(fixture));
  const h = createHarness({ initial: { [KEY]: raw } });
  h.call('loadWorkoutState');
  const state = h.state();
  assert.strictEqual(S.deepEqual(state.exerciseHistory, fixture.exerciseHistory), true);
  assert.strictEqual(h.storage.getItem(LEGACY), null);
  assert.strictEqual(h.storage.getItem(KEY), raw);
});

test('loadWorkoutState: v2 dañado se recupera desde la copia legacy', function () {
  const raw = JSON.stringify(corruptV2());
  const h = createHarness({
    initial: { [KEY]: raw, [LEGACY]: JSON.stringify(fixture) }
  });
  h.call('loadWorkoutState');
  const state = h.state();
  assert.strictEqual(S.deepEqual(state.exerciseHistory, fixture.exerciseHistory), true);
  assert.strictEqual(h.storage.getItem(CORRUPT), raw);
  assert.strictEqual(h.storage.getItem(KEY), raw, 'no debe sobrescribir lo dañado');
  assert.ok(h.toasts().some(function (t) { return t.indexOf('recuperó') >= 0; }));
});

test('loadWorkoutState: v2 dañado sin copia usa defaults y avisa', function () {
  const raw = '{bad';
  const h = createHarness({ initial: { [KEY]: raw } });
  h.call('loadWorkoutState');
  const state = JSON.parse(JSON.stringify(h.state()));
  assert.deepStrictEqual(state.sessions, []);
  assert.strictEqual(h.storage.getItem(CORRUPT), raw);
  assert.strictEqual(h.storage.getItem(KEY), raw);
  assert.ok(h.toasts().some(function (t) { return t.indexOf('No se pudo leer') >= 0; }));
});

test('loadWorkoutState: v2 sin módulo no se sobrescribe', function () {
  const raw = JSON.stringify(S.encodeState(fixture));
  const h = createHarness({ module: null, initial: { [KEY]: raw } });
  h.call('loadWorkoutState');
  const state = JSON.parse(JSON.stringify(h.state()));
  assert.deepStrictEqual(state.sessions, []);
  assert.strictEqual(h.storage.getItem(KEY), raw);
  assert.ok(h.toasts().some(function (t) { return t.indexOf('Guardado seguro no disponible') >= 0; }));
});

test('loadWorkoutState: v1 en modo off no migra', function () {
  const raw = JSON.stringify(fixture);
  const h = createHarness({ initial: { [KEY]: raw, [MODE]: 'off' } });
  h.call('loadWorkoutState');
  assert.strictEqual(h.storage.getItem(KEY), raw);
  assert.strictEqual(h.storage.getItem(LEGACY), null);
  assert.strictEqual(h.storage.getItem(MODE), 'off');
});

test('loadWorkoutState: normaliza sesiones, notas y coach', function () {
  const raw = JSON.stringify({
    notes: null,
    coachPersonality: 'nope',
    coachTiredMode: 'yes',
    sessions: [
      { id: 'a', date: '2026-01-01T00:00:00Z', dayId: 'd' },
      { id: 'b', date: '2026-01-03T00:00:00Z', dayId: 'd' },
      { id: 'sin-fecha', dayId: 'd' }
    ],
    exerciseHistory: {}
  });
  const h = createHarness({ initial: { [KEY]: raw, [MODE]: 'off' } });
  h.call('loadWorkoutState');
  const state = h.state();
  assert.deepStrictEqual(Array.from(state.sessions).map(function (s) { return s.id; }), ['b', 'a']);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(state.notes)), {});
  assert.strictEqual(state.coachPersonality, 'gymbro');
  assert.strictEqual(state.coachTiredMode, false);
});

// ===========================================================================
section('\uD83D\uDCE5 9. Importación de copias');
// ===========================================================================

test('parseBackupText: v2 entra por la ruta de confianza', function () {
  const h = createHarness();
  const text = JSON.stringify(S.encodeState(fixture));
  const result = h.call('parseBackupText', text);
  assert.strictEqual(result.trusted, true);
  assert.strictEqual(S.deepEqual(result.state, fixture), true);
  assert.strictEqual(h.sanitizeCalls(), 0);
});

test('parseBackupText: v1 se sanea', function () {
  const h = createHarness();
  const result = h.call('parseBackupText', JSON.stringify(fixture));
  assert.strictEqual(result.trusted, false);
  assert.strictEqual(result.state.__sanitized, true);
  assert.strictEqual(h.sanitizeCalls(), 1);
});

test('parseBackupText: texto inválido', function () {
  const h = createHarness();
  assert.throws(function () { h.call('parseBackupText', 'nope'); },
    /no es una copia de seguridad válida/);
});

test('parseBackupText: v2 dañado', function () {
  const h = createHarness();
  assert.throws(function () {
    h.call('parseBackupText', JSON.stringify(corruptV2()));
  }, /compacto v2 pero está dañada/);
});

test('parseBackupText: sin lector disponible', function () {
  const h = createHarness({ module: null });
  assert.throws(function () { h.call('parseBackupText', '{}'); },
    /lector de copias no está disponible/);
});

// ===========================================================================
section('\uD83D\uDCF8 10. Snapshot previo a una restauración');
// ===========================================================================

test('snapshot: guarda v2 y se puede decodificar', function () {
  const h = createHarness();
  h.setState(clone(fixture));
  assert.strictEqual(h.call('savePreRestoreSnapshot'), true);
  const snapshot = JSON.parse(h.storage.getItem(PRE));
  assert.strictEqual(snapshot.v, 2);
  assert.ok(snapshot.savedAt);
  const decoded = h.call('decodeSnapshot', snapshot);
  assert.strictEqual(S.deepEqual(decoded, fixture), true);
});

test('snapshot: sin módulo guarda el estado canónico', function () {
  const h = createHarness({ module: null });
  h.setState(clone(fixture));
  assert.strictEqual(h.call('savePreRestoreSnapshot'), true);
  const snapshot = JSON.parse(h.storage.getItem(PRE));
  assert.strictEqual(snapshot.v, undefined);
  assert.strictEqual(S.deepEqual(h.call('decodeSnapshot', snapshot), fixture), true);
});

test('snapshot: contenido inválido devuelve null', function () {
  const h = createHarness();
  assert.strictEqual(h.call('decodeSnapshot', null), null);
  assert.strictEqual(h.call('decodeSnapshot', {}), null);
  assert.strictEqual(h.call('decodeSnapshot', { v: 2, payload: corruptV2() }), null);
});

test('snapshot: v2 sin módulo no se puede leer', function () {
  const h = createHarness({ module: null });
  assert.strictEqual(h.call('decodeSnapshot', { v: 2, payload: { v: 2, state: {} } }), null);
});

test('snapshot: si no hay espacio devuelve false', function () {
  const h = createHarness();
  h.storage._control.failKey = PRE;
  h.storage._control.failTimes = Infinity;
  h.setState(clone(fixture));
  assert.strictEqual(h.call('savePreRestoreSnapshot'), false);
});

// ===========================================================================
section('\uD83D\uDCE4 11. Aplicación de una restauración');
// ===========================================================================

test('applyRestoredState: persiste, aplica la UI y difunde al reloj', function () {
  const h = createHarness();
  h.setState({ notes: { antes: '1' }, sessions: [], exerciseHistory: {} });
  const ok = h.call('applyRestoredState', clone(fixture));
  assert.strictEqual(ok, true);
  const state = h.state();
  assert.strictEqual(S.deepEqual(state.exerciseHistory, fixture.exerciseHistory), true);
  assert.deepStrictEqual(
    Array.from(state.sessions).map(function (s) { return s.id; }),
    ['s3', 's2', 's1']
  );
  assert.strictEqual(h.uiCalls(), 1);
  assert.strictEqual(h.broadcasts(), 1);
  const stored = S.decodePayload(h.storage.getItem(KEY));
  assert.strictEqual(stored.ok, true);
  assert.strictEqual(S.deepEqual(stored.state, JSON.parse(JSON.stringify(state))), true);
});

test('applyRestoredState: no sanea la ruta v2 (confianza)', function () {
  const h = createHarness();
  const parsed = h.call('parseBackupText', JSON.stringify(S.encodeState(fixture)));
  h.call('applyRestoredState', parsed.state);
  assert.strictEqual(h.sanitizeCalls(), 0);
});

test('applyRestoredState: si no puede persistir revierte la memoria', function () {
  const h = createHarness();
  const previous = { notes: { antes: '1' }, sessions: [], exerciseHistory: {} };
  h.setState(previous);
  h.storage._control.failKey = KEY;
  h.storage._control.failTimes = Infinity;
  assert.throws(function () { h.call('applyRestoredState', clone(fixture)); },
    /No se pudo guardar el estado restaurado/);
  assert.strictEqual(S.deepEqual(h.state(), previous), true);
  assert.strictEqual(h.uiCalls(), 0);
});

test('applyRestoredState: sin guardado seguro no toca nada', function () {
  const h = createHarness({ module: null });
  const previous = { notes: { antes: '1' }, sessions: [], exerciseHistory: {} };
  h.setState(previous);
  assert.throws(function () { h.call('applyRestoredState', clone(fixture)); },
    /guardado seguro no está disponible/);
  assert.strictEqual(S.deepEqual(h.state(), previous), true);
  assert.strictEqual(h.uiCalls(), 0);
});

test('applyRestoredState: rechaza formatos que no son objeto', function () {
  const h = createHarness();
  [null, [], 'texto'].forEach(function (value) {
    assert.throws(function () { h.call('applyRestoredState', value); }, /Formato inválido/);
  });
});

test('applyRestoredState: filtra sesiones inválidas y ordena', function () {
  const input = {
    notes: {},
    exerciseHistory: {},
    completed: 'no-array',
    sessions: [
      { id: 'a', date: '2026-01-01T00:00:00Z', dayId: 'd' },
      { id: 'b', date: '2026-01-03T00:00:00Z', dayId: 'd' },
      { id: 'sin-dia', date: '2026-01-02T00:00:00Z' }
    ]
  };
  const h = createHarness();
  h.call('applyRestoredState', input);
  const state = h.state();
  assert.deepStrictEqual(Array.from(state.sessions).map(function (s) { return s.id; }), ['b', 'a']);
  assert.deepStrictEqual(Array.from(state.completed), []);
});

// ===========================================================================
section('\uD83D\uDD17 12. Integración estática con la app');
// ===========================================================================

test('index.html carga el módulo antes del catálogo', function () {
  const scriptIdx = indexHtml.indexOf('<script src="./storage_format.js?v=1"></script>');
  const catalogIdx = indexHtml.indexOf('const EXERCISE_CATALOG =');
  assert.ok(scriptIdx > -1, 'falta el script del módulo');
  assert.ok(catalogIdx > -1, 'falta el catálogo');
  assert.ok(scriptIdx < catalogIdx, 'el módulo debe cargarse antes');
});

test('sw.js cachea el módulo de formato', function () {
  assert.ok(swJs.indexOf("'./storage_format.js?v=1'") >= 0);
});

test('handleNoteChange usa debounce', function () {
  const fn = extractFunction(indexHtml, 'handleNoteChange');
  assert.ok(fn.indexOf('scheduleSaveWorkoutState(400)') >= 0);
  assert.ok(fn.indexOf('saveWorkoutState();') < 0);
});

test('applyRestoredState persiste antes de tocar la UI y no sanea', function () {
  const fn = extractFunction(indexHtml, 'applyRestoredState');
  const persistIdx = fn.indexOf('persistStateRaw()');
  const uiIdx = fn.indexOf('applyLoadedStateToUI()');
  assert.ok(persistIdx >= 0);
  assert.ok(uiIdx > persistIdx);
  assert.ok(fn.indexOf('workoutState = previousState') >= 0);
  assert.ok(fn.indexOf('sanitizeImportedState') < 0);
});

test('loadWorkoutState usa el decodificador y aplica la UI', function () {
  const fn = extractFunction(indexHtml, 'loadWorkoutState');
  assert.ok(fn.indexOf('decodeStoredState()') >= 0);
  assert.ok(fn.indexOf('applyLoadedStateToUI()') >= 0);
});

test('initApp cuenta arranques y limpia el legacy', function () {
  const fn = extractFunction(indexHtml, 'initApp');
  assert.ok(fn.indexOf('countStorageStart()') >= 0);
  assert.ok(fn.indexOf('cleanupLegacyBackup()') >= 0);
});

test('el helper de rollback está expuesto en window', function () {
  assert.ok(indexHtml.indexOf('window.__vigorexiRollbackV1 = function') >= 0);
});

test('la exportación sigue siendo el estado canónico legible', function () {
  assert.ok(indexHtml.indexOf('JSON.stringify(workoutState, null, 2)') >= 0);
});

test('las claves de almacenamiento esperadas existen', function () {
  [KEY, LEGACY, V2BACKUP, CORRUPT, MODE, META].forEach(function (key) {
    assert.ok(indexHtml.indexOf("'" + key + "'") >= 0, 'falta ' + key);
  });
  assert.ok(indexHtml.indexOf("'vigorexiapp_pre_restore'") >= 0);
});

test('el módulo es UMD (Node y navegador)', function () {
  const source = fs.readFileSync(path.join(__dirname, '..', 'storage_format.js'), 'utf8');
  assert.ok(source.indexOf('module.exports = factory()') >= 0);
  assert.ok(source.indexOf('root.VigorexiStorage = factory()') >= 0);
});

// ===========================================================================
console.log('\n' + '='.repeat(52));
if (failures.length) {
  console.log('\u274C ' + failures.length + ' fallo(s) de ' + (passed + failures.length) + ' pruebas');
  failures.forEach(function (failure) {
    console.log('\n- ' + failure.name);
    console.log((failure.err && failure.err.stack) || String(failure.err));
  });
  process.exit(1);
} else {
  console.log('\u2705 ' + passed + ' pruebas superadas');
}
