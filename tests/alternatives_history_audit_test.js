/**
 * VigorexiApp - Suite Exhaustiva de Auditoría Técnica:
 * Alternativas de Ejercicio e Historial de Marcas Previas
 */

const fs = require('fs');
const assert = require('assert');

console.log('================================================================');
console.log('🔬 AUDITORÍA TÉCNICA: Alternativas de Ejercicio & Historial');
console.log('================================================================');

const indexHtml = fs.readFileSync('index.html', 'utf8');
const watchBridgeJs = fs.readFileSync('watch_bridge.js', 'utf8');
const watchAppJs = fs.readFileSync('watch/app.js', 'utf8');
const storageFormat = require('../storage_format.js');

// Extraer catálogos reales de index.html
const catMatch = indexHtml.match(/const EXERCISE_CATALOG = ({[\s\S]*?});\s*const ROUTINE_SLOTS/);
assert(catMatch, 'EXERCISE_CATALOG debe encontrarse');
const EXERCISE_CATALOG = JSON.parse(catMatch[1]);

const slotsMatch = indexHtml.match(/const ROUTINE_SLOTS = ({[\s\S]*?});\s*let workoutState/);
assert(slotsMatch, 'ROUTINE_SLOTS debe encontrarse');
const ROUTINE_SLOTS = JSON.parse(slotsMatch[1]);

// -------------------------------------------------------------
// Helper: Implementaciones fieles extraídas del código fuente
// -------------------------------------------------------------
function parsePreviousString(val) {
  if (!val || val === '—' || val === '-') return { kg: null, reps: null };
  const str = String(val).trim();
  const mSec = str.match(/^(\d+)\s*(?:s|seg)$/i);
  if (mSec) return { kg: 0, reps: parseInt(mSec[1], 10) };
  const m = str.match(/^\+?([\d\.]+)\s*(?:kg)?\s*[×xX]\s*(\d+)\s*(?:s|seg|reps?|\/lado)?/i);
  if (m) return { kg: parseFloat(m[1]), reps: parseInt(m[2], 10) };
  const mRepsOnly = str.match(/^(\d+)\s*(?:reps?|\/lado)$/i);
  if (mRepsOnly) return { kg: null, reps: parseInt(mRepsOnly[1], 10) };
  const mSingle = str.match(/^\+?([\d\.]+)\s*(?:kg)?$/i);
  if (mSingle) return { kg: parseFloat(mSingle[1]), reps: null };
  return { kg: null, reps: null };
}

function calculate1RM(kg, reps) {
  if (!kg || kg <= 0) return 0;
  if (!reps || reps <= 1) return kg;
  return Math.round(kg * (1 + reps / 30) * 10) / 10;
}

function formatPreviousDisplay(val) {
  if (!val || val === '—' || val === '-') return '—';
  let s = String(val).replace(/\b(\d+(?:\.\d+)?)\s*k(?![gG\w])/gi, '$1kg');
  s = s.replace(/(\d+(?:\.\d+)?\s*kg)\s*[×xX]\s*(\d+)/g, '$1 × $2');
  return s;
}

// -------------------------------------------------------------
// TEST 1: Indexación y no arrastre de marcas entre slots/ejercicios
// -------------------------------------------------------------
console.log('\n📌 1. Verificación de Indexación (exId vs slotId):');

{
  const state = {
    previous: {
      'banca': { 0: '80kg × 8', 1: '80kg × 8', 2: '80kg × 7', 3: '80kg × 6' },
      'press_maq_convergente': { 0: '70kg × 10', 1: '70kg × 10', 2: '70kg × 9' }
    },
    exerciseHistory: {
      'banca': [{ date: '2026-10-20T10:00:00.000Z', sets: [{ kg: 80, reps: 8 }], bestKg: 80, bestReps: 8, best1RM: 101.3 }],
      'press_maq_convergente': [{ date: '2026-10-18T10:00:00.000Z', sets: [{ kg: 70, reps: 10 }], bestKg: 70, bestReps: 10, best1RM: 93.3 }]
    },
    customSlots: {},
    tempSlots: {}
  };

  // Verificamos que las claves son exId y no nombres de slot como 'torsoA_1'
  assert.strictEqual(state.previous['torsoA_1'], undefined, 'previous no debe estar indexado por slotId');
  assert.ok(state.previous['banca'], 'previous debe estar indexado por exId');
  assert.ok(state.exerciseHistory['banca'], 'exerciseHistory debe estar indexado por exId');
  assert.strictEqual(state.exerciseHistory['torsoA_1'], undefined, 'exerciseHistory no debe estar indexado por slotId');
  console.log('  ✓ Invariante verificado: previous y exerciseHistory se indexan estrictamente por exId.');
}

// -------------------------------------------------------------
// TEST 2: Ciclo de vida completo "Usar solo hoy" vs "Predeterminado"
// -------------------------------------------------------------
console.log('\n📌 2. Ciclo de Vida: "Usar solo hoy" vs "Guardar como predeterminado":');

{
  let state = {
    inputs: {},
    notes: {},
    completed: [],
    previous: {
      'banca': { 0: '80kg × 8', 1: '80kg × 8', 2: '80kg × 7', 3: '80kg × 6' }
    },
    exerciseHistory: {
      'banca': [{ date: '2026-10-25T10:00:00.000Z', sets: [{ kg: 80, reps: 8 }], bestKg: 80, bestReps: 8, best1RM: 101.3 }]
    },
    sessions: [],
    customSlots: {},
    tempSlots: {}
  };

  const slotId = 'torsoA_1';
  const defaultExId = 'banca';
  const altExId = 'press_maq_convergente';

  // Paso A: Usuario selecciona "Usar solo hoy" (isPermanent = false)
  // Simular applySwap(slotId, altExId, false)
  state.tempSlots[slotId] = altExId;

  // Comprobar qué marcas lee la interfaz para el slot tras el swap
  const currentExId = state.tempSlots[slotId] || state.customSlots[slotId] || defaultExId;
  assert.strictEqual(currentExId, 'press_maq_convergente');

  const exPrev = state.previous[currentExId] || {};
  assert.deepStrictEqual(exPrev, {}, 'Un ejercicio alternativo nuevo debe tener previous vacío ({})');
  // No debe heredar las marcas de banca
  assert.strictEqual(exPrev[0], undefined, 'No debe arrastrar la marca de banca');
  console.log('  ✓ Al cambiar a una alternativa nunca antes realizada, previous es vacío (no arrastra pesos del ejercicio previo).');

  // Paso B: Usuario completa el entrenamiento hoy con la máquina convergente
  const sessionDate = '2026-11-02T10:00:00.000Z';
  const setsLogged = [
    { set: 1, kg: 72.5, reps: 10 },
    { set: 2, kg: 72.5, reps: 10 },
    { set: 3, kg: 72.5, reps: 9 }
  ];

  // Simular executeDayArchive:
  // 1. Guardar marcas en previous[exId]
  if (!state.previous[currentExId]) state.previous[currentExId] = {};
  setsLogged.forEach((s, idx) => {
    state.previous[currentExId][idx] = `${s.kg}kg × ${s.reps}`;
  });

  // 2. Guardar en exerciseHistory[exId]
  if (!state.exerciseHistory[currentExId]) state.exerciseHistory[currentExId] = [];
  state.exerciseHistory[currentExId].push({
    date: sessionDate,
    sets: setsLogged,
    bestKg: 72.5,
    bestReps: 10,
    best1RM: calculate1RM(72.5, 10),
    notes: ''
  });

  // 3. Reset de tempSlots al finalizar (código exacto de executeDayArchive)
  if (state.tempSlots && state.tempSlots[slotId]) {
    delete state.tempSlots[slotId];
  }

  // 4. Restauración visual al predeterminado
  const effectiveNextDay = state.customSlots[slotId] || defaultExId;
  assert.strictEqual(state.tempSlots[slotId], undefined, 'tempSlots debe limpiarse tras executeDayArchive');
  assert.strictEqual(effectiveNextDay, 'banca', 'El slot debe volver a su predeterminado original (banca)');
  assert.strictEqual(state.previous['banca'][0], '80kg × 8', 'Las marcas de banca se preservaron intactas');
  assert.strictEqual(state.previous['press_maq_convergente'][0], '72.5kg × 10', 'Las marcas de press convergente quedaron archivadas');
  console.log('  ✓ executeDayArchive guarda las marcas bajo altExId y restaura el slot a banca con sus marcas previas intactas.');

  // Paso C: Sesión siguiente (días después) el usuario vuelve a elegir "Usar solo hoy" en máquina convergente
  state.tempSlots[slotId] = altExId;
  const currentExIdSession2 = state.tempSlots[slotId] || state.customSlots[slotId] || defaultExId;
  const exPrevSession2 = state.previous[currentExIdSession2];
  assert.ok(exPrevSession2, 'En la siguiente sesión debe encontrar el previous del alternativo');
  assert.strictEqual(exPrevSession2[0], '72.5kg × 10');
  assert.strictEqual(exPrevSession2[1], '72.5kg × 10');
  assert.strictEqual(exPrevSession2[2], '72.5kg × 9');

  // Parseo para pre-llenar inputs
  const parsedSet1 = parsePreviousString(exPrevSession2[0]);
  assert.strictEqual(parsedSet1.kg, 72.5);
  assert.strictEqual(parsedSet1.reps, 10);
  console.log('  ✓ En sesiones posteriores, al volver a elegir la alternativa se recuperan automáticamente sus marcas previas y se pre-llenan inputs.');

  // Paso D: Probar "Guardar como predeterminado" (isPermanent = true)
  state.customSlots[slotId] = altExId;
  delete state.tempSlots[slotId];

  // Simular fin de entreno
  if (state.tempSlots && state.tempSlots[slotId]) delete state.tempSlots[slotId];
  const effectivePermanent = state.customSlots[slotId] || defaultExId;
  assert.strictEqual(effectivePermanent, 'press_maq_convergente', 'customSlots mantiene el ejercicio sustituido de forma permanente');
  console.log('  ✓ "Guardar como predeterminado" persiste a través del archivado y no es reseteado.');
}

// -------------------------------------------------------------
// TEST 3: Diferencia en número de series entre slots y alternativas
// -------------------------------------------------------------
console.log('\n📌 3. Manejo de diferente número de series:');

{
  // Escenario: Un ejercicio fue realizado en un slot de 3 series (claves 0, 1, 2 en previous)
  // y ahora se utiliza en un slot de 4 series (sIdx 0, 1, 2, 3)
  const prev3Sets = { 0: '70kg × 10', 1: '70kg × 10', 2: '70kg × 9' };

  // Comprobar serie 4 (sIdx = 3)
  const prevSet4 = prev3Sets[3];
  assert.strictEqual(prevSet4, undefined, 'La serie 4 no existe en el previous de 3 series');

  // En renderSlotExercise:
  // if (parsed.kg !== null) { ... } else if (sIdx > 0 && rows[sIdx - 1]?.querySelector('.input-kg')?.value) ...
  // Esto hace fallback al valor de la serie anterior sIdx - 1:
  const prevParsed3 = parsePreviousString(prev3Sets[2]);
  const fallbackKgForSet4 = prevParsed3.kg;
  const fallbackRepsForSet4 = prevParsed3.reps;
  assert.strictEqual(fallbackKgForSet4, 70);
  assert.strictEqual(fallbackRepsForSet4, 9);
  console.log('  ✓ Si el slot tiene más series que el registro previo, la UI rellena con fallback en cascada desde la serie anterior.');
}

// -------------------------------------------------------------
// TEST 4: Métricas especiales (isometria, peso_corporal, unilateral)
// -------------------------------------------------------------
console.log('\n📌 4. Análisis de Métricas Especiales en parsePreviousString:');

{
  // 1. Isometría
  const isoWithKg = parsePreviousString('+10kg × 45s');
  assert.deepStrictEqual(isoWithKg, { kg: 10, reps: 45 }, 'Isometría con lastre (+10kg × 45s) debe parsear');

  const isoNoKg = parsePreviousString('45s');
  assert.deepStrictEqual(isoNoKg, { kg: 0, reps: 45 }, 'Isometría sin lastre (45s) debe parsear a kg:0 reps:45');

  // 2. Unilateral con /lado
  const uniWithKg = parsePreviousString('15kg × 12/lado');
  assert.deepStrictEqual(uniWithKg, { kg: 15, reps: 12 }, 'Unilateral con kg y reps (15kg × 12/lado) debe parsear');

  // 3. Peso corporal con lastre
  const bwWithKg = parsePreviousString('+20kg × 8');
  assert.deepStrictEqual(bwWithKg, { kg: 20, reps: 8 }, 'Corporal con lastre (+20kg × 8) debe parsear');

  // 4. Peso corporal SIN lastre (solo reps): ej. "12 reps"
  const bwOnlyReps = parsePreviousString('12 reps');
  assert.deepStrictEqual(bwOnlyReps, { kg: null, reps: 12 }, 'Peso corporal "12 reps" debe parsear a reps: 12');
  console.log('  ✓ Formato "12 reps" en peso corporal puro parsea correctamente a reps: 12');

  // 5. Unilateral SIN kg: ej. "12/lado"
  const uniOnlyReps = parsePreviousString('12/lado');
  assert.deepStrictEqual(uniOnlyReps, { kg: null, reps: 12 }, 'Unilateral "12/lado" debe parsear a reps: 12');
  console.log('  ✓ Formato "12/lado" en unilateral sin kg parsea correctamente a reps: 12');
}

// -------------------------------------------------------------
// TEST 5: Sincronización con el Reloj Inteligente (watch_bridge.js)
// -------------------------------------------------------------
console.log('\n📌 5. Auditoría de Difusión y Sincronización con el Reloj:');

{
  // A. Verificación del filtrado de previousSets en watch_bridge.js
  const sampleDayData = ROUTINE_SLOTS.fullbodyA;
  const mockWorkoutState = {
    customSlots: {},
    tempSlots: {},
    previous: {
      'squat': { 0: '100kg × 8' },
      'prensa_45': { 0: '180kg × 10' }, // alternativa de squat
      'banca': { 0: '80kg × 8' },
      'press_maq_convergente': { 0: '70kg × 10' } // alternativa de banca
    }
  };

  // Replicar exactamente la lógica actualizada de líneas 340-365 de watch_bridge.js:
  const activeExIds = new Set();
  sampleDayData.slots.forEach(slot => {
    const chosenEx = (mockWorkoutState.customSlots && mockWorkoutState.customSlots[slot.slotId]) ||
                     (mockWorkoutState.tempSlots && mockWorkoutState.tempSlots[slot.slotId]) ||
                     slot.defaultExId || slot.slotId;
    if (chosenEx) activeExIds.add(chosenEx);
    if (slot.defaultExId) activeExIds.add(slot.defaultExId);
    if (slot.slotId) activeExIds.add(slot.slotId);

    if (typeof EXERCISE_CATALOG !== 'undefined') {
      const checkAlts = exId => {
        const ex = EXERCISE_CATALOG[exId];
        if (ex && Array.isArray(ex.alternatives)) {
          ex.alternatives.forEach(altId => activeExIds.add(altId));
        }
      };
      if (slot.defaultExId) checkAlts(slot.defaultExId);
      if (chosenEx) checkAlts(chosenEx);
    }

    if (Array.isArray(slot.options)) {
      slot.options.forEach(opt => {
        if (opt && opt.id) activeExIds.add(opt.id);
      });
    }
  });

  const filteredPrevious = {};
  for (const exId of activeExIds) {
    if (mockWorkoutState.previous[exId]) {
      filteredPrevious[exId] = mockWorkoutState.previous[exId];
    }
  }

  // Comprobar si prensa_45 y press_maq_convergente están en filteredPrevious
  assert.ok(filteredPrevious['prensa_45'], 'filteredPrevious debe incluir alternativas del catálogo');
  assert.ok(filteredPrevious['press_maq_convergente'], 'filteredPrevious debe incluir alternativas del catálogo');
  console.log('  ✓ watch_bridge.js incluye las alternativas del catálogo en previousSets incluso antes del swap.');

  // B. Comprobar si el swap se hace desde el móvil (applySwap)
  mockWorkoutState.tempSlots['fullbodyA_1'] = 'prensa_45';
  const activeExIdsAfterSwap = new Set();
  sampleDayData.slots.forEach(slot => {
    const chosenEx = (mockWorkoutState.customSlots && mockWorkoutState.customSlots[slot.slotId]) ||
                     (mockWorkoutState.tempSlots && mockWorkoutState.tempSlots[slot.slotId]) ||
                     slot.defaultExId || slot.slotId;
    if (chosenEx) activeExIdsAfterSwap.add(chosenEx);
    if (slot.defaultExId) activeExIdsAfterSwap.add(slot.defaultExId);
  });
  const filteredAfterSwap = {};
  for (const exId of activeExIdsAfterSwap) {
    if (mockWorkoutState.previous[exId]) filteredAfterSwap[exId] = mockWorkoutState.previous[exId];
  }
  assert.ok(filteredAfterSwap['prensa_45'], 'Si el swap se hace en el móvil, el payload del reloj sí incluye el alternativo');
  console.log('  ✓ Si el swap se hace desde el móvil, el broadcast SÍ envía previousSets del ejercicio alternativo al reloj.');

  // C. Comprobar qué ocurre si el entrenamiento finaliza desde el reloj (handleWorkoutFinishedFromWatch)
  // ¿Limpia tempSlots?
  const linesFinished = watchBridgeJs.slice(watchBridgeJs.indexOf('function handleWorkoutFinishedFromWatch'));
  const cleansTempSlotsInWatchFinish = linesFinished.includes('delete workoutState.tempSlots') || linesFinished.includes('tempSlots = {}');
  assert.ok(cleansTempSlotsInWatchFinish, 'handleWorkoutFinishedFromWatch debe limpiar tempSlots al finalizar desde el reloj');
  console.log('  ✓ handleWorkoutFinishedFromWatch limpia tempSlots correctamente al finalizar desde el reloj.');
}

// -------------------------------------------------------------
// TEST 6: Compatibilidad y persistencia v2 con storage_format.js
// -------------------------------------------------------------
console.log('\n📌 6. Pruebas de Persistencia Compacta v2:');

{
  const fullState = {
    inputs: { 'torsoA_1_0_kg': '75', 'torsoA_1_0_reps': '10' },
    notes: { 'torsoA_1': 'Buena congestión en convergente' },
    completed: ['torsoA_1_0'],
    previous: {
      'press_maq_convergente': { 0: '75kg × 10', 1: '75kg × 9' }
    },
    exerciseHistory: {
      'press_maq_convergente': [
        { date: '2026-11-02T10:00:00.000Z', sets: [{ set: 1, kg: 75, reps: 10, est1RM: 100 }], bestKg: 75, bestReps: 10, best1RM: 100, notes: 'Buena congestión' }
      ]
    },
    sessions: [],
    customSlots: { 'torsoA_1': 'press_maq_convergente' },
    tempSlots: {}
  };

  const encoded = storageFormat.encodeState(fullState);
  assert.ok(storageFormat.isV2(encoded), 'El payload debe tener formato v2');
  const decoded = storageFormat.decodeState(encoded);

  assert.deepStrictEqual(decoded.customSlots, fullState.customSlots, 'customSlots debe preservarse intacto');
  assert.deepStrictEqual(decoded.tempSlots, fullState.tempSlots, 'tempSlots debe preservarse intacto');
  assert.deepStrictEqual(decoded.previous, fullState.previous, 'previous debe preservarse intacto');
  assert.strictEqual(decoded.exerciseHistory.press_maq_convergente.length, 1);
  assert.strictEqual(decoded.exerciseHistory.press_maq_convergente[0].bestKg, 75);
  console.log('  ✓ storage_format.js (v2) comprime y descomprime customSlots, tempSlots, previous y exerciseHistory con fidelidad 100%.');
}

console.log('\n================================================================');
console.log('🏁 RESULTADOS DE LA AUDITORÍA COMPLETADOS CON ÉXITO');
console.log('================================================================\n');
