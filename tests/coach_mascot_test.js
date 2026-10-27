const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

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

function extractBalanced(src, start, open = '{', close = '}') {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let quote = '';
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        inString = false;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error('Unbalanced source');
}

function extractFunction(name) {
  const start = html.indexOf('function ' + name);
  assert(start !== -1, 'No se encontro ' + name);
  const brace = html.indexOf('{', start);
  const body = extractBalanced(html, brace);
  return html.slice(start, brace + body.length);
}

function extractCatalog() {
  const marker = 'const EXERCISE_CATALOG = ';
  const start = html.indexOf(marker);
  assert(start !== -1, 'No se encontro EXERCISE_CATALOG');
  const brace = html.indexOf('{', start);
  return JSON.parse(extractBalanced(html, brace));
}

function extractHelpers() {
  const start = html.indexOf('// COACH:HELPERS:START');
  const end = html.indexOf('// COACH:HELPERS:END');
  assert(start !== -1 && end !== -1, 'No se encontraron los marcadores de helpers');
  return html.slice(start, end);
}

function targetReps(dose) {
  if (!dose) return { min: 8, max: 8 };
  const m = dose.match(/(\d+)\s*[-–]\s*(\d+)\s*reps?/i);
  if (m) return { min: parseInt(m[1], 10), max: parseInt(m[2], 10) };
  const single = dose.match(/(\d+)\s*reps?/i);
  if (single) return { min: parseInt(single[1], 10), max: parseInt(single[1], 10) };
  return { min: 8, max: 10 };
}

function oneRepMax(kg, reps) {
  if (!kg || kg <= 0) return 0;
  if (!reps || reps <= 1) return kg;
  return Math.round(kg * (1 + reps / 30) * 10) / 10;
}

const catalog = extractCatalog();

const freshMap = {};
let vibrateCalls = 0;
const sandbox = {
  workoutState: { exerciseHistory: {}, coachPersonality: 'gymbro' },
  getExerciseTargetReps: targetReps,
  calculate1RM: oneRepMax,
  getFreshOverload: exId => freshMap[exId] || null,
  navigator: { vibrate() { vibrateCalls++; } },
  console: console,
  Math: Math,
  JSON: JSON,
  Number: Number,
  String: String,
  Array: Array,
  Set: Set
};
vm.createContext(sandbox);
vm.runInContext(extractHelpers(), sandbox);

function daysAgo(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

console.log('Coach Mascota (rev16)');

test('Cabecera: mascota es un boton accesible sin onclick inline', () => {
  const tag = html.match(/<button[^>]*id="mascotBtn"[^>]*>/);
  assert(tag, 'Falta el boton #mascotBtn');
  assert(!/onclick/i.test(tag[0]), 'El boton no debe tener onclick inline');
  assert(/aria-haspopup="dialog"/.test(tag[0]), 'Falta aria-haspopup');
  assert(/aria-label="Abrir coach"/.test(tag[0]), 'Falta aria-label inicial');
  assert(/<span class="mascot-badge" id="mascotBadge" aria-hidden="true"><\/span>/.test(html), 'Falta badge aria-hidden');
  assert(/<div class="modal-title" id="coachModalTitle">Grefusito Poderoso<\/div>/.test(html), 'El título del modal debe ser Grefusito Poderoso');
});

test('Globo contextual: markup accesible y estilos de cabecera', () => {
  assert(/<div class="coach-bubble-layer" id="coachBubbleLayer">\s*<span class="coach-bubble" id="coachBubble" role="status" aria-live="polite" aria-atomic="true"><\/span>\s*<\/div>/.test(html), 'Falta el globo accesible');
  const layer = html.match(/\.coach-bubble-layer\s*\{[\s\S]*?\}/);
  const bubble = html.match(/\.coach-bubble\s*\{[\s\S]*?\}/);
  assert(layer && /position:\s*absolute/.test(layer[0]), 'La capa no es absoluta');
  assert(layer && /pointer-events:\s*none/.test(layer[0]), 'La capa debe dejar pasar el tacto');
  assert(layer && /justify-content:\s*center/.test(layer[0]), 'El globo debe centrarse sobre la marca');
  assert(layer && /padding:\s*4px 12px 0/.test(layer[0]), 'El globo debe quedar en la fila de marca');
  assert(bubble && /max-width:\s*min\(270px/.test(bubble[0]), 'Falta el ancho maximo del globo');
  assert(/\.coach-bubble\.show\s*\{[\s\S]*?pointer-events:\s*auto/.test(html), 'El globo visible debe ser interactivo');
});

test('Cache rev35 en sw.js y en el registro', () => {
  assert(/const CACHE_NAME = 'vigorexiapp-v1\.8\.4-rev35'/.test(sw), 'CACHE_NAME no es rev35');
  assert(/sw\.js\?v=1\.8\.4-rev35/.test(html), 'El registro no apunta a rev35');
});

test('Personalidad: whitelist y fallback a gymbro', () => {
  const ctx = {
    COACH_PERSONALITIES: ['sargento', 'ciencia', 'gymbro'],
    isPlainObject: v => !!v && typeof v === 'object' && !Array.isArray(v)
  };
  vm.createContext(ctx);
  vm.runInContext(extractFunction('sanitizeImportedState'), ctx);
  assert.strictEqual(ctx.sanitizeImportedState({ coachPersonality: 'sargento' }).coachPersonality, 'sargento');
  assert.strictEqual(ctx.sanitizeImportedState({ coachPersonality: 'ciencia' }).coachPersonality, 'ciencia');
  assert.strictEqual(ctx.sanitizeImportedState({ coachPersonality: 'inventado' }).coachPersonality, 'gymbro');
  assert.strictEqual(ctx.sanitizeImportedState({}).coachPersonality, 'gymbro');
  assert.strictEqual(ctx.sanitizeImportedState({ coachTiredMode: true }).coachTiredMode, true);
  assert.strictEqual(ctx.sanitizeImportedState({ coachTiredMode: 'true' }).coachTiredMode, false);
  assert.strictEqual(ctx.sanitizeImportedState({}).coachTiredMode, false);
});

test('Alertas: inactivity, fatigue y yesterday con type', () => {
  const ctx = { workoutState: { sessions: [] }, console: console };
  vm.createContext(ctx);
  vm.runInContext(extractFunction('getConsecutiveTrainingAlert'), ctx);

  ctx.workoutState.sessions = [{ date: daysAgo(6), dayId: 'torsoA', dayName: 'Torso A' }];
  assert.strictEqual(ctx.getConsecutiveTrainingAlert().type, 'inactivity');

  ctx.workoutState.sessions = [
    { date: daysAgo(0), dayId: 'torsoA', dayName: 'Torso A' },
    { date: daysAgo(1), dayId: 'piernaA', dayName: 'Pierna A' },
    { date: daysAgo(2), dayId: 'torsoB', dayName: 'Torso B' }
  ];
  assert.strictEqual(ctx.getConsecutiveTrainingAlert().type, 'fatigue');

  ctx.workoutState.sessions = [{ date: daysAgo(1), dayId: 'torsoA', dayName: 'Torso A' }];
  assert.strictEqual(ctx.getConsecutiveTrainingAlert().type, 'yesterday');
});

test('Fecha relativa: hoy, ayer y hace 2 dias por dia natural', () => {
  const ctx = { Date: Date, Number: Number, Math: Math };
  vm.createContext(ctx);
  vm.runInContext(extractFunction('getRelativeWorkoutInfo'), ctx);
  const now = new Date(2026, 9, 22, 8, 0, 0);
  assert.strictEqual(ctx.getRelativeWorkoutInfo(new Date(2026, 9, 22, 23, 0, 0), now).relative, 'Hoy');
  assert.strictEqual(ctx.getRelativeWorkoutInfo(new Date(2026, 9, 21, 23, 0, 0), now).relative, 'Ayer');
  assert.strictEqual(ctx.getRelativeWorkoutInfo(new Date(2026, 9, 20, 23, 0, 0), now).relative, 'Hace 2 días');
  assert.strictEqual(ctx.getRelativeWorkoutInfo(new Date(2026, 9, 17, 23, 0, 0), now).relative, 'Hace 5 días');
});

test('Globo: textos de PR y sobrecarga con datos concretos', () => {
  const ctx = { Number: Number };
  vm.createContext(ctx);
  vm.runInContext(extractFunction('formatCoachBubblePR') + '\n' + extractFunction('formatCoachBubbleOverload'), ctx);
  assert.strictEqual(ctx.formatCoachBubblePR({ exId: 'squat', kind: '1rm', value: 112.5 }, 'Sentadilla'), 'Sentadilla: 112.5 kg de 1RM estimado, nuevo récord.');
  assert.strictEqual(ctx.formatCoachBubblePR({ exId: 'plank', kind: 'seconds', value: 75 }, 'Plancha'), 'Plancha: 75 s, nuevo récord de tiempo.');
  assert.strictEqual(ctx.formatCoachBubbleOverload('Press banca', 82.5, 6), 'Press banca: sube a 82.5 kg × 6 reps en la próxima sesión.');
});

test('Globo: prioridad, cierre, pausa y supresion por input', () => {
  assert(/const COACH_BUBBLE_MS = 5000/.test(html), 'Falta el auto-cierre de 5 s');
  assert(/COACH_BUBBLE_PRIORITY = \{ briefing: 1, overload: 2, pr: 3 \}/.test(html), 'Prioridad incorrecta');
  assert(/let bubbleShown = new Set\(\)/.test(html) && /let bubbleDismissed = new Set\(\)/.test(html), 'Faltan los sets de estado');
  const show = extractFunction('showCoachBubble');
  assert(/priority < COACH_BUBBLE_PRIORITY\.pr && isCoachBubbleInputFocused\(\)/.test(show), 'El PR debe poder mostrarse con un input enfocado');
  assert(/bubbleDismissed\.has\(key\)/.test(show), 'Falta respetar el cierre manual');
  assert(/bubbleShown\.add\(key\)/.test(show), 'Falta marcar el globo como mostrado');
  const pause = extractFunction('pauseCoachBubble');
  const resume = extractFunction('resumeCoachBubble');
  assert(/Date\.now\(\) - coachBubbleStartedAt/.test(pause), 'La pausa no descuenta el tiempo transcurrido');
  assert(/startCoachBubbleTimer\(coachBubbleRemaining/.test(resume), 'La reanudacion no conserva el tiempo restante');
  const dismiss = extractFunction('dismissCoachBubble');
  assert(/bubbleDismissed\.add\(coachBubbleKey\)/.test(dismiss), 'El clic no registra el cierre');
});

test('Globo: hooks de PR, sobrecarga, briefing y resets', () => {
  const mark = extractFunction('markExercisePR');
  assert(/typeof showCoachPRBubble === 'function'/.test(mark), 'Falta el guard de PR');
  assert(/showCoachPRBubble\(lastPRInfo\)/.test(mark), 'El PR no dispara el globo');
  const check = extractFunction('checkExerciseCardCompletion');
  assert(/function checkExerciseCardCompletion\(card, announce\)/.test(check), 'Falta el flag announce');
  assert(/announce && typeof showCoachOverloadBubble === 'function'/.test(check), 'La sobrecarga no dispara el globo');
  assert(/checkExerciseCardCompletion\(card, isDone\)/.test(html), 'completeSet no anuncia la serie completada');
  const select = extractFunction('selectDay');
  assert(/resetCoachBubbleState\(\)/.test(select), 'selectDay no reinicia el globo');
  assert(/showCoachBriefingBubble\(dayId\)/.test(select), 'selectDay no muestra el briefing');
  const archive = extractFunction('executeDayArchive');
  assert(/resetCoachBubbleState\(\)/.test(archive), 'El archivo no reinicia el globo');
});

test('Briefing: ultimo entreno usa la sesion mas reciente, no el dia activo', () => {
  const latest = { date: '2026-10-20T18:00:00', dayId: 'fullbodyB' };
  const ctx = {
    workoutState: { sessions: [latest, { date: '2026-10-17T18:00:00', dayId: 'fullbodyA' }] },
    currentProgram: 'fullbody',
    lastActiveWorkoutDay: 'fullbodyA',
    getLastSession: () => latest,
    getRelativeWorkoutInfo: value => ({ relative: value === latest.date ? 'Hace 2 días' : 'Hace 5 días' }),
    calculateStreak: () => 1,
    getNextRecommendedDay: () => 'fullbodyC',
    ROUTINE_SLOTS: { fullbodyC: { shortName: 'Día C' } }
  };
  vm.createContext(ctx);
  vm.runInContext(extractFunction('getCoachTiredMode') + '\n' + extractFunction('getCoachBriefing'), ctx);
  const rows = ctx.getCoachBriefing();
  assert.strictEqual(rows.find(r => r.label === 'Último entreno').value, 'Hace 2 días');
  ctx.workoutState.coachTiredMode = true;
  assert.strictEqual(ctx.getCoachBriefing().find(r => r.label === 'Modo').value, 'Cansado · -10% carga');
});

test('Hora estimada de salida descuenta las series completadas', () => {
  const ctx = {
    ROUTINE_SLOTS: {
      test: {
        slots: [
          { slotId: 'test_1', sets: [[0, 1], [0, 1]] },
          { slotId: 'test_2', sets: [[0, 1], [0, 1]] },
          { slotId: 'test_3', sets: [[0, 1], [0, 1]], isSkippable: true }
        ]
      }
    },
    workoutState: {
      sessionStartTime: { test: new Date(2026, 9, 22, 10, 0, 0).getTime() },
      completed: ['test_1_0', 'test_2_0']
    },
    isExpressMode: false,
    calculateDayEstimatedDuration: () => 60,
    Date: Date,
    Math: Math,
    Number: Number,
    String: String,
    Set: Set
  };
  vm.createContext(ctx);
  vm.runInContext([
    extractFunction('getDayTotalSets'),
    extractFunction('getDayCompletedSets'),
    extractFunction('getEstimatedExitTime')
  ].join('\n'), ctx);

  const res = ctx.getEstimatedExitTime('test', new Date(2026, 9, 22, 10, 10, 0).getTime());
  assert.strictEqual(res.total, 6);
  assert.strictEqual(res.done, 2);
  assert.strictEqual(res.remainingMin, 40);
  assert.strictEqual(res.clock, '10:50');
  assert.strictEqual(res.label, '10:50 · ~40 min');
  assert.strictEqual(ctx.getEstimatedExitTime('otro', Date.now()), null, 'Sin día válido no debe estimar salida');
});

test('Modo cansado: markup, estado y recomendación conservadora', () => {
  assert(/id="coachTiredToggle"[^>]*aria-pressed="false"[^>]*onclick="toggleCoachTiredMode\(\)"/.test(html), 'Falta el toggle de modo cansado');
  assert(/Baja un 10% la carga/.test(html), 'Falta la recomendación de carga');
  const toggle = extractFunction('toggleCoachTiredMode');
  assert(/coachTiredMode = typeof force === 'boolean'/.test(toggle), 'El toggle no acepta un valor explícito');
  assert(/renderCoachModal\(\)/.test(toggle), 'El toggle no refresca el modal');
  const render = extractFunction('renderCoachModal');
  assert(/Hoy cansado: usa el 90% de esa carga/.test(render), 'El modal no ajusta la recomendación');
});

test('Gym SOS: tres escenarios y salida a alternativas', () => {
  const sos = extractFunction('coachSOS');
  assert(/scenario === 'lleno'/.test(sos), 'Falta el escenario de gym lleno');
  assert(/scenario === 'sin-material'/.test(sos), 'Falta el escenario sin material');
  assert(/scenario === 'sin-energia'/.test(sos), 'Falta el escenario sin energía');
  assert(/openSwapModal\(context\.slotId\)/.test(sos), 'Gym lleno no abre alternativas');
  assert(/coachTiredMode = true/.test(sos), 'Sin energía no activa modo cansado');
  assert(/onclick="coachSOS\('lleno'\)"/.test(html), 'Falta el botón de gym lleno');
  assert(/onclick="coachSOS\('sin-material'\)"/.test(html), 'Falta el botón sin material');
  assert(/onclick="coachSOS\('sin-energia'\)"/.test(html), 'Falta el botón sin energía');
});

test('Flex Card: sello de mascota limitado a 112 px', () => {
  assert(/const FLEX_CARD_MASCOT_MAX = 112/.test(html), 'Falta el límite de 112 px');
  const seal = extractFunction('drawFlexCardMascot');
  assert(/Math\.min\(FLEX_CARD_MASCOT_MAX/.test(seal), 'El sello no respeta el máximo');
  assert(/drawImage\(img/.test(seal), 'El sello no dibuja mascot.png');
  assert(/\.\/mascot\.png/.test(extractFunction('getFlexCardMascot')), 'No se carga mascot.png');
  assert(/drawFlexCardMascot\(ctx, W\)/.test(extractFunction('drawFlexCard')), 'La Flex Card no dibuja el sello');
  assert(/mascot\.onload = \(\) => drawFlexCard/.test(extractFunction('openWorkoutSummaryModal')), 'No se redibuja al cargar la mascota');
});

test('PR 1RM supera el mejor historico', () => {
  const logs = [{ best1RM: 100 }, { best1RM: 90 }];
  const res = sandbox.evaluatePR({ metricType: 'reps' }, 80, 10, logs);
  assert.strictEqual(res.isPR, true);
  assert.strictEqual(res.kind, '1rm');
  assert.strictEqual(res.prev, 100);
});

test('PR isometrico por segundos', () => {
  const res = sandbox.evaluatePR({ metricType: 'isometria' }, 0, 70, [{ bestReps: 60 }]);
  assert.strictEqual(res.isPR, true);
  assert.strictEqual(res.kind, 'seconds');
});

test('PR de peso corporal ignora entradas con lastre', () => {
  const logs = [{ bestKg: 0, bestReps: 20 }, { bestKg: 20, bestReps: 5 }];
  const res = sandbox.evaluatePR({ metricType: 'peso_corporal' }, 0, 21, logs);
  assert.strictEqual(res.isPR, true);
  assert.strictEqual(res.kind, 'reps');
  assert.strictEqual(res.prev, 20);
});

test('PR una sola vez por ejercicio y reset de sesion', () => {
  sandbox.resetSessionPR();
  assert.strictEqual(sandbox.markExercisePR('squat', '1rm', 120, 110), true);
  assert.strictEqual(sandbox.markExercisePR('squat', '1rm', 130, 120), false);
  assert.strictEqual(sandbox.hasSessionPR(), true);
  sandbox.resetSessionPR();
  assert.strictEqual(sandbox.hasSessionPR(), false);
});

test('Rampa 70/75/80 mantiene 80 kg y sube a 6 reps', () => {
  const ex = { dose: '4 × 6-8 reps', stepKg: 2.5 };
  const res = sandbox.computeDoubleProgression('test_ramp', ex, [
    { kg: 70, reps: 10 }, { kg: 75, reps: 8 }, { kg: 80, reps: 5 }
  ]);
  assert.strictEqual(res.source, 'volume');
  assert.strictEqual(res.kg, 80);
  assert.strictEqual(res.reps, 6);
});

test('Rampa 70/80/80 al techo sube a 82.5 kg x 6', () => {
  const ex = { dose: '4 × 6-8 reps', stepKg: 2.5 };
  const res = sandbox.computeDoubleProgression('test_ceiling', ex, [
    { kg: 70, reps: 10 }, { kg: 80, reps: 8 }, { kg: 80, reps: 8 }
  ]);
  assert.strictEqual(res.source, 'ceiling');
  assert.strictEqual(res.kg, 82.5);
  assert.strictEqual(res.reps, 6);
});

test('pec_deck usa su stepKg de 5 kg', () => {
  const ex = catalog.pec_deck;
  assert(ex, 'Falta pec_deck en el catalogo');
  const t = targetReps(ex.dose);
  const res = sandbox.computeDoubleProgression('pec_deck', ex, [
    { kg: 50, reps: t.max }, { kg: 50, reps: t.max }
  ]);
  assert.strictEqual(res.source, 'ceiling');
  assert.strictEqual(res.kg, 55);
});

test('Sugerencia fresca de sobrecarga tiene precedencia', () => {
  freshMap.test_fresh = { nextKg: 90, baseReps: 6 };
  const res = sandbox.computeDoubleProgression('test_fresh', { dose: '4 × 6-8 reps', stepKg: 2.5 }, [
    { kg: 70, reps: 10 }
  ]);
  delete freshMap.test_fresh;
  assert.strictEqual(res.source, 'overload');
  assert.strictEqual(res.kg, 90);
  assert.strictEqual(res.reps, 6);
});

test('Sin ejercicio activo y sin historial devuelve none', () => {
  sandbox.workoutState.exerciseHistory = {};
  assert.strictEqual(sandbox.computeDoubleProgression('nope', null, []).source, 'none');
  const res = sandbox.computeDoubleProgression('squat', catalog.squat, []);
  assert.strictEqual(res.source, 'none');
  assert(/Sin historial/.test(res.text));
});

test('Paridad de getWeightStep en todo el catalogo', () => {
  const ids = Object.keys(catalog);
  assert(ids.length >= 100, 'Catalogo inesperadamente corto: ' + ids.length);
  ids.forEach(id => {
    const expected = Number(catalog[id].stepKg) || 2.5;
    assert.strictEqual(sandbox.getWeightStep(catalog[id]), expected, id);
  });
  assert.strictEqual(sandbox.supportsLoadProgression(catalog.squat), true);
  const iso = ids.find(id => catalog[id].metricType === 'isometria');
  if (iso) assert.strictEqual(sandbox.supportsLoadProgression(catalog[iso]), false);
});

console.log('\n' + passed + ' tests OK');
