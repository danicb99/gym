const fs = require('fs');
const assert = require('assert');
const path = require('path');

console.log('====================================================');
console.log('🧪 VigorexiApp - Test de Series de Calentamiento Dinámicas');
console.log('====================================================\n');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// 1. Verificación estructural en index.html
console.log('📦 1. Verificación de Funciones Clave en Código:');
assert(html.includes('function getWarmupTargetWeight'), 'getWarmupTargetWeight debe estar definida');
assert(html.includes('function calculateWarmupWeight'), 'calculateWarmupWeight debe estar definida');
assert(html.includes('function updateCardWarmupRows'), 'updateCardWarmupRows debe estar definida');
assert(html.includes('function updateAllWarmupRows'), 'updateAllWarmupRows debe estar definida');
console.log('  ✓ Funciones principales de cálculo dinámico y actualización DOM presentes');

// 2. Extraer EXERCISE_CATALOG
const catMatch = html.match(/const EXERCISE_CATALOG = ({[\s\S]*?});\s*const ROUTINE_SLOTS/);
assert(catMatch, 'EXERCISE_CATALOG debe encontrarse en index.html');
const EXERCISE_CATALOG = JSON.parse(catMatch[1]);

// Extraer funciones puras de cálculo desde index.html para evaluarlas
const getWeightCode = html.match(/function calculateWarmupWeight\(exId, targetKg, pct\) \{([\s\S]*?)\n    \}/);
assert(getWeightCode, 'calculateWarmupWeight debe extraerse');
const calculateWarmupWeight = new Function('exId', 'targetKg', 'pct', 'EXERCISE_CATALOG', `
  ${getWeightCode[1]}
`).bind(null);

console.log('\n🏋️ 2. Pruebas de Cálculo de Carga y Redondeo según Equipamiento:');

// Barra olímpica (ej. squat, target 100 kg)
// 0a (~50%): 50 kg
const squat50 = calculateWarmupWeight('squat', 100, 0.5, EXERCISE_CATALOG);
assert.strictEqual(squat50, 50, 'Sentadilla 100kg -> 50% debe ser 50 kg');
// 0b (~75%): 75 kg
const squat75 = calculateWarmupWeight('squat', 100, 0.75, EXERCISE_CATALOG);
assert.strictEqual(squat75, 75, 'Sentadilla 100kg -> 75% debe ser 75 kg');
console.log('  ✓ Sentadilla 100 kg -> 0a: 50 kg, 0b: 75 kg');

// Barra con peso bajo (ej. target 30 kg, 50% = 15 kg -> suelo de barra olímpica/ligera)
const squatLow = calculateWarmupWeight('squat', 30, 0.5, EXERCISE_CATALOG);
assert(squatLow >= 15, 'En barra con objetivo bajo debe respetar mínimo de barra');
console.log(`  ✓ Barra con carga ligera respeta suelo de barra (${squatLow} kg)`);

// Mancuernas (ej. laterales1, target 12 kg, 50% = 6 kg)
const lat50 = calculateWarmupWeight('laterales1', 12, 0.5, EXERCISE_CATALOG);
assert.strictEqual(lat50, 6, 'Laterales 12 kg -> 50% debe ser 6 kg');
const latOdd = calculateWarmupWeight('laterales1', 15, 0.5, EXERCISE_CATALOG);
assert.strictEqual(latOdd, 8, 'Laterales 15 kg -> 50% (7.5) debe redondear a 8 kg');
console.log('  ✓ Mancuernas calculan pasos enteros sin números fraccionarios imposibles');

// Máquinas / Poleas (ej. jalon, target 70 kg, 50% = 35 kg)
const jalon50 = calculateWarmupWeight('jalon', 70, 0.5, EXERCISE_CATALOG);
assert.strictEqual(jalon50, 35, 'Jalón 70 kg -> 50% debe ser 35 kg');
const jalon75 = calculateWarmupWeight('jalon', 75, 0.5, EXERCISE_CATALOG);
assert.strictEqual(jalon75, 37.5, 'Jalón 75 kg -> 50% debe ser 37.5 kg (placas de 2.5 kg)');
console.log('  ✓ Jalón al pecho 75 kg -> 37.5 kg (paso de placas correcto)');

// 3. Simulación de getWarmupTargetWeight (prioridad peso máximo)
console.log('\n🎯 3. Pruebas de Detección de Peso Máximo:');

const getTargetCode = html.match(/function getWarmupTargetWeight\(exId, cardEl\) \{([\s\S]*?)\n    \}/);
assert(getTargetCode, 'getWarmupTargetWeight debe extraerse');

// Caso A: Si hay historial relacional con varias series, coge el mejor kg
let testState = {
  exerciseHistory: {
    squat: [
      { date: '2026-10-20', bestKg: 95, sets: [{ kg: 90 }, { kg: 95 }] },
      { date: '2026-10-25', bestKg: 105, sets: [{ kg: 100 }, { kg: 105 }, { kg: 105 }] }
    ]
  },
  previous: {},
  sessions: []
};

const getTarget = new Function('exId', 'cardEl', 'workoutState', getTargetCode[1]);

const maxFromHist = getTarget('squat', null, testState);
assert.strictEqual(maxFromHist, 105, 'Debe extraer el peso máximo de la última sesión (105 kg)');
console.log('  ✓ Historial de sesiones: detecta el peso máximo de la última sesión (105 kg)');

// Caso B: Si solo tiene campo "Anterior" con varias series
let testPrevState = {
  exerciseHistory: {},
  sessions: [],
  previous: {
    banca: {
      0: '75kg × 8',
      1: '80kg × 8',
      2: '82.5kg × 6'
    }
  }
};
const maxFromPrev = getTarget('banca', null, testPrevState);
assert.strictEqual(maxFromPrev, 82.5, 'Debe extraer el peso MÁXIMO de todas las series previas (82.5 kg)');
console.log('  ✓ Campo "Anterior": detecta el máximo entre todas las series (82.5 kg, no se para en la primera)');

// Caso C: Si el usuario escribe hoy un peso objetivo en la serie 1, tiene máxima prioridad
const mockCard = {
  querySelector(sel) {
    if (sel === '.set-row[data-set-num="1"]') {
      return {
        querySelector(sub) {
          if (sub === '.input-kg') return { value: '110', placeholder: '100' };
          return null;
        }
      };
    }
    return null;
  }
};
const maxFromTyped = getTarget('squat', mockCard, testState);
assert.strictEqual(maxFromTyped, 110, 'El peso escrito hoy para la sesión tiene prioridad (110 kg)');
console.log('  ✓ Input Serie 1 hoy: si el usuario escribe 110 kg, prima sobre el historial previo');

// 4. Verificación de actualización en hooks clave
console.log('\n🔗 4. Verificación de Disparadores Automáticos:');
assert(html.includes("if (card && input.classList.contains('input-kg') && row && row.getAttribute('data-set-num') === '1') {\n        updateCardWarmupRows(card);"), 'handleSetInput debe actualizar updateCardWarmupRows al teclear en serie 1');
console.log('  ✓ handleSetInput recalcula calentamiento en tiempo real al escribir en Serie 1');

assert(html.includes('if (typeof updateCardWarmupRows === \'function\') updateCardWarmupRows(card);'), 'renderSlotExercise debe llamar a updateCardWarmupRows al cambiar alternativa');
console.log('  ✓ renderSlotExercise recalcula calentamiento al cambiar a una máquina alternativa');

assert(html.includes('if (typeof updateAllWarmupRows === \'function\') updateAllWarmupRows();'), 'applyLoadedStateToUI debe llamar a updateAllWarmupRows al hidratar la app');
console.log('  ✓ applyLoadedStateToUI actualiza todas las filas al abrir/cargar la app');

console.log('\n====================================================');
console.log('🎉 TODAS LAS PRUEBAS DE CALENTAMIENTO DINÁMICO APROBADAS');
console.log('====================================================');
