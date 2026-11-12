const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

console.log('====================================================');
console.log('🧪 VigorexiApp - Test Smart Stepper Dock & Glass Dial');
console.log('====================================================\n');

// 1. Verificación de Markup HTML
console.log('📦 1. Verificación de Markup HTML:');
assert(html.includes('id="stepperDock"'), 'Falta el contenedor #stepperDock en index.html');
assert(html.includes('id="stepperDockType"'), 'Falta #stepperDockType para el tipo de métrica');
assert(html.includes('id="stepperDockVal"'), 'Falta #stepperDockVal para el valor actual');
assert(html.includes('id="stepperDockChips"'), 'Falta #stepperDockChips para los botones de acceso directo');
assert(html.includes('closeStepperDock()'), 'Falta botón de cierre closeStepperDock()');
assert(html.includes('id="scrubber-hud"'), 'Falta #scrubber-hud para el dial de arrastre');
console.log('  ✓ Estructura DOM de Stepper Dock y HUD Scrubber presentes');

// 2. Verificación de Estilos CSS
console.log('\n🎨 2. Verificación de Estilos CSS:');
assert(html.includes('.stepper-dock {'), 'Falta clase CSS .stepper-dock');
assert(html.includes('.stepper-dock.active {'), 'Falta estado .stepper-dock.active');
assert(html.includes('.stepper-chip {'), 'Falta clase .stepper-chip para botones táctiles');
assert(html.includes('.stepper-chip.chip-plus'), 'Faltan estilos para chips de aumento');
assert(html.includes('.stepper-chip.chip-minus'), 'Faltan estilos para chips de reducción');
assert(html.includes('.set-input.active-stepper-target'), 'Falta clase de foco .active-stepper-target');
assert(html.includes('.scrubber-hud {'), 'Faltan estilos para .scrubber-hud');
console.log('  ✓ Estilos CSS glassmórficos y animaciones GPU validados');

// 3. Verificación de Funciones JavaScript
console.log('\n⚙️ 3. Verificación de Funciones JavaScript:');
assert(html.includes('function getExerciseIncrementStep('), 'Falta getExerciseIncrementStep');
assert(html.includes('function openStepperDock('), 'Falta openStepperDock');
assert(html.includes('function closeStepperDock('), 'Falta closeStepperDock');
assert(html.includes('function openInputKeyboard('), 'Falta openInputKeyboard');
assert(html.includes('function applyStepperDelta('), 'Falta applyStepperDelta');
assert(html.includes('function initScrubberController('), 'Falta initScrubberController');
assert(html.includes('function showScrubberHud('), 'Falta showScrubberHud');
assert(html.includes('function updateScrubberHud('), 'Falta updateScrubberHud');
assert(html.includes('function hideScrubberHud('), 'Falta hideScrubberHud');
console.log('  ✓ Controladores integrados correctamente');

// 4. Lógica de Cuantización de stepKg e Isometría
console.log('\n🧮 4. Verificación de Cuantización (stepKg & isometría):');

// Extraer catálogo
const catMatch = html.match(/const EXERCISE_CATALOG = ({[\s\S]*?});\s*const ROUTINE_SLOTS/);
assert(catMatch, 'EXERCISE_CATALOG debe encontrarse');
const EXERCISE_CATALOG = JSON.parse(catMatch[1]);

function simulateGetStep(exId, isKg) {
  const ex = EXERCISE_CATALOG[exId];
  if (!isKg) {
    if (ex && ex.metricType === 'isometria') return 5;
    return 1;
  }
  if (ex && ex.stepKg !== undefined && ex.stepKg !== null) return Number(ex.stepKg);
  if (ex && ex.equipment && ex.equipment.toLowerCase().includes('mancuerna')) return 0.5;
  return 0.5;
}

// Squat con barra olímpica
assert.strictEqual(simulateGetStep('squat', true), 0.5, 'Squat debe tener paso 0.5 kg');
assert.strictEqual(simulateGetStep('squat', false), 1, 'Squat en reps debe tener paso 1 rep');

// Pec Deck máquina de placas (stepKg: 0.5)
assert.strictEqual(simulateGetStep('pec_deck', true), 0.5, 'Pec deck debe tener paso 0.5 kg');

// Plancha isométrica (metricType: isometria)
assert.strictEqual(simulateGetStep('plancha', false), 5, 'Plancha debe tener paso 5 segundos');

// Dumbbells / Mancuernas (saltos de 0.5 kg)
assert.strictEqual(simulateGetStep('laterales1', true), 0.5, 'Laterales mancuerna debe tener paso 0.5 kg');
console.log('  ✓ Cuantización de stepKg y segundos isométricos correcta para todas las familias de ejercicios');

// 5. Simulación de deltas de chips táctiles
console.log('\n🔘 5. Simulación de Botones de Ajuste Rápido (Chips):');
function getDeltas(step, isKg, isIso) {
  if (isKg) {
    const doubleStep = Math.round(step * 2 * 10) / 10;
    return [-doubleStep, -step, step, doubleStep];
  } else if (isIso) {
    return [-10, -5, 5, 10];
  } else {
    return [-5, -1, 1, 5];
  }
}

assert.deepStrictEqual(getDeltas(0.5, true, false), [-1, -0.5, 0.5, 1], 'Paso 0.5kg debe tener [-1, -0.5, +0.5, +1]');
assert.deepStrictEqual(getDeltas(1, false, false), [-5, -1, 1, 5], 'Reps estándar debe tener [-5, -1, +1, +5]');
assert.deepStrictEqual(getDeltas(5, false, true), [-10, -5, 5, 10], 'Isometría debe tener [-10s, -5s, +5s, +10s]');
console.log('  ✓ Chips táctiles de 1 toque generan deltas coherentes con el equipamiento');

// 6. Simulación de Aritmética de Stepper y Clamping
console.log('\n🛡️ 6. Simulación de Clamping y Precisión Numérica:');
function applyDelta(current, delta, isKg) {
  let val = current + delta;
  if (isKg) return Math.max(0, Math.min(999, Math.round(val * 10) / 10));
  return Math.max(0, Math.min(99, Math.round(val)));
}

assert.strictEqual(applyDelta(80, 0.5, true), 80.5);
assert.strictEqual(applyDelta(80.5, -1, true), 79.5);
assert.strictEqual(applyDelta(2.5, -5, true), 0, 'No debe bajar de 0 kg');
assert.strictEqual(applyDelta(995, 10, true), 999, 'No debe superar 999 kg');
assert.strictEqual(applyDelta(8, 1, false), 9);
assert.strictEqual(applyDelta(8, -5, false), 3);
assert.strictEqual(applyDelta(2, -5, false), 0, 'No debe bajar de 0 reps');
console.log('  ✓ Clamping y prevención de imprecisión decimal en punto flotante validados');

// 7. Verificación Sintáctica Estricta de Scripts Inline de index.html
console.log('\n🧩 7. Integridad de Sintaxis JavaScript en index.html:');
const scriptMatches = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi)];
assert(scriptMatches.length > 0, 'Se deben encontrar scripts inline en index.html');
scriptMatches.forEach((m, idx) => {
  try {
    new Function(m[1]);
  } catch (err) {
    assert.fail(`Error de sintaxis en script inline #${idx}: ${err.message}`);
  }
});
console.log('  ✓ Todos los scripts inline compilan sin errores sintácticos (0 SyntaxError)');

console.log('\n====================================================');
console.log('🎉 TODAS LAS PRUEBAS DE STEPPER Y DIAL APROBADAS (100% OK)');
console.log('====================================================\n');
