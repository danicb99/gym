const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

console.log('====================================================');
console.log('🧪 VigorexiApp - Test de Tiempos Previstos (Con/Sin Superseries)');
console.log('====================================================');

const html = fs.readFileSync('index.html', 'utf8');

// 1. Verificación Estructural en index.html
console.log('\n📦 1. Verificación Estructural en HTML y CSS:');
assert(html.includes('id="headerEstDurationNoSS"'), 'headerEstDurationNoSS debe estar en el HTML inicial');
console.log('  ✓ Elemento headerEstDurationNoSS presente en la cabecera');

assert(html.includes('.header-est-noss'), 'Clase CSS .header-est-noss debe estar definida');
console.log('  ✓ Estilos .header-est-noss presentes en CSS');

assert(html.includes('function updateHeaderEstimatedDuration'), 'updateHeaderEstimatedDuration debe estar definida');
console.log('  ✓ updateHeaderEstimatedDuration definida en JS');

// 2. Extracción y pruebas de lógica con VM
console.log('\n⏱️ 2. Pruebas de Cálculo de Duración (calculateDayEstimatedDuration):');

// Extraer ROUTINE_SLOTS y EXERCISE_CATALOG
const rMatch = html.match(/const ROUTINE_SLOTS = ({[\s\S]*?});/);
const eMatch = html.match(/const EXERCISE_CATALOG = ({[\s\S]*?});/);
assert(rMatch && eMatch, 'No se pudo extraer ROUTINE_SLOTS o EXERCISE_CATALOG');

const ROUTINE_SLOTS = JSON.parse(rMatch[1]);
const EXERCISE_CATALOG = JSON.parse(eMatch[1]);

// Extraer calculateDayEstimatedDuration
const fnMatch = html.match(/function calculateDayEstimatedDuration\([\s\S]*?\n    \}/);
assert(fnMatch, 'No se pudo extraer calculateDayEstimatedDuration');

const ctx = {
  ROUTINE_SLOTS,
  EXERCISE_CATALOG,
  Math,
  Date,
  String,
  Number,
  Set
};
vm.createContext(ctx);
vm.runInContext(fnMatch[0], ctx);

// A) Duraciones Full Body con y sin superseries
const durA_SS = ctx.calculateDayEstimatedDuration('fullbodyA', false, false);
const durA_NoSS = ctx.calculateDayEstimatedDuration('fullbodyA', false, true);
assert.strictEqual(durA_SS, 42, `Día A con superseries debe ser ~42 min, obtenido: ${durA_SS}`);
assert.strictEqual(durA_NoSS, 57, `Día A sin superseries debe ser ~57 min, obtenido: ${durA_NoSS}`);
console.log(`  ✓ Día A: ${durA_SS} min con superseries | ${durA_NoSS} min sin superseries`);

const durB_SS = ctx.calculateDayEstimatedDuration('fullbodyB', false, false);
const durB_NoSS = ctx.calculateDayEstimatedDuration('fullbodyB', false, true);
assert.strictEqual(durB_SS, 42, `Día B con superseries debe ser ~42 min, obtenido: ${durB_SS}`);
assert.strictEqual(durB_NoSS, 57, `Día B sin superseries debe ser ~57 min, obtenido: ${durB_NoSS}`);
console.log(`  ✓ Día B: ${durB_SS} min con superseries | ${durB_NoSS} min sin superseries`);

const durC_SS = ctx.calculateDayEstimatedDuration('fullbodyC', false, false);
const durC_NoSS = ctx.calculateDayEstimatedDuration('fullbodyC', false, true);
assert.strictEqual(durC_SS, 42, `Día C con superseries debe ser ~42 min, obtenido: ${durC_SS}`);
assert.strictEqual(durC_NoSS, 57, `Día C sin superseries debe ser ~57 min, obtenido: ${durC_NoSS}`);
console.log(`  ✓ Día C: ${durC_SS} min con superseries | ${durC_NoSS} min sin superseries`);

// B) Modo Exprés
const durA_Exp_SS = ctx.calculateDayEstimatedDuration('fullbodyA', true, false);
const durA_Exp_NoSS = ctx.calculateDayEstimatedDuration('fullbodyA', true, true);
assert.strictEqual(durA_Exp_SS, 33, `Día A exprés con superseries debe ser ~33 min, obtenido: ${durA_Exp_SS}`);
assert.strictEqual(durA_Exp_NoSS, 48, `Día A exprés sin superseries debe ser ~48 min, obtenido: ${durA_Exp_NoSS}`);
console.log(`  ✓ Día A (Exprés): ${durA_Exp_SS} min con SS | ${durA_Exp_NoSS} min sin SS`);

// 3. Verificación de renderizado en cabecera
console.log('\n🖥️ 3. Pruebas de Renderizado en Cabecera (updateHeaderEstimatedDuration):');

const headerFnMatch = html.match(/function updateHeaderEstimatedDuration\([\s\S]*?\n    \}/);
assert(headerFnMatch, 'No se pudo extraer updateHeaderEstimatedDuration');

const domHeader = { innerHTML: '' };
ctx.document = {
  getElementById: (id) => (id === 'headerRoutineSub' ? domHeader : null)
};
ctx.lastActiveWorkoutDay = 'fullbodyA';
ctx.currentProgram = 'fullbody';
ctx.isExpressMode = false;
vm.runInContext(headerFnMatch[0], ctx);

// Test Día A Full Body
ctx.updateHeaderEstimatedDuration('fullbodyA');
assert(domHeader.innerHTML.includes('~42 min'), 'Debe incluir ~42 min para Día A');
assert(domHeader.innerHTML.includes('(sin SS: ~57 min)'), 'Debe incluir (sin SS: ~57 min) para Día A');
assert(domHeader.innerHTML.includes('id="headerEstDurationNoSS"'), 'Debe incluir id headerEstDurationNoSS');
console.log('  ✓ Renderiza correctamente tiempo con SS y sin SS para Full Body A');

// Test Modo Exprés en Cabecera
ctx.isExpressMode = true;
ctx.updateHeaderEstimatedDuration('fullbodyA');
assert(domHeader.innerHTML.includes('~33 min'), 'Debe incluir ~33 min en exprés');
assert(domHeader.innerHTML.includes('(sin SS: ~48 min)'), 'Debe incluir (sin SS: ~48 min) en exprés');
console.log('  ✓ Actualiza correctamente tiempos exprés en cabecera');

// Test Torso / Pierna (sin superseries)
ctx.isExpressMode = false;
ctx.updateHeaderEstimatedDuration('torsoA');
assert(domHeader.innerHTML.includes('Torso/Pierna · 4 días'), 'Debe indicar Torso/Pierna');
assert(!domHeader.innerHTML.includes('(sin SS:'), 'Torso/Pierna no debe tener etiqueta sin SS');
console.log('  ✓ Torso / Pierna muestra duración sin etiqueta redundante de superseries');

// 4. Pruebas de Tiempo Estimado de Salida / Finalización en Progreso (getEstimatedExitTime)
console.log('\n🏁 4. Pruebas de Tiempo Estimado de Salida / Finalización (getEstimatedExitTime):');

const exitFnMatch = html.match(/function getEstimatedExitTime\([\s\S]*?\n    \}/);
const totalSetsFnMatch = html.match(/function getDayTotalSets\([\s\S]*?\n    \}/);
const completedSetsFnMatch = html.match(/function getDayCompletedSets\([\s\S]*?\n    \}/);
assert(exitFnMatch && totalSetsFnMatch && completedSetsFnMatch, 'No se pudo extraer getEstimatedExitTime o helpers de series');

vm.runInContext(totalSetsFnMatch[0], ctx);
vm.runInContext(completedSetsFnMatch[0], ctx);
vm.runInContext(exitFnMatch[0], ctx);

// Simular sesión de Full Body A iniciada hace 10 minutos con 5 series completadas
const baseSimTime = new Date(2026, 9, 30, 10, 0, 0).getTime();
const currentSimTime = baseSimTime + 10 * 60000;
ctx.Date.now = () => currentSimTime;
ctx.workoutState = {
  sessionStartTime: { fullbodyA: baseSimTime, torsoA: baseSimTime },
  completed: ['fullbodyA_1_0', 'fullbodyA_1_1', 'fullbodyA_1_2', 'fullbodyA_1_3', 'fullbodyA_2_0']
};

const exitFB = ctx.getEstimatedExitTime('fullbodyA', currentSimTime);
assert(exitFB !== null, 'getEstimatedExitTime debe devolver objeto de salida para Full Body A');
assert.strictEqual(exitFB.hasSupersets, true, 'Full Body A debe marcar hasSupersets=true');
assert.strictEqual(exitFB.baseMinutesSS, 42, 'baseMinutesSS debe ser 42 min');
assert.strictEqual(exitFB.baseMinutesNoSS, 57, 'baseMinutesNoSS debe ser 57 min');
assert(exitFB.remainingMinSS < exitFB.remainingMinNoSS, 'El tiempo con superseries debe ser menor que sin superseries');
assert(exitFB.clockSS !== exitFB.clockNoSS, 'La hora de fin con superseries debe ser anterior a sin superseries');
assert(exitFB.label.includes('(sin SS:'), 'El label debe detallar el tiempo sin superseries cuando tiene superseries');
assert(exitFB.labelNoSS.includes('min'), 'labelNoSS debe estar formateado');
console.log(`  ✓ Full Body A en progreso: ${exitFB.remainingMinSS} min rest. (fin ~${exitFB.clockSS}) | sin SS: ${exitFB.remainingMinNoSS} min rest. (fin ~${exitFB.clockNoSS})`);

// Llamada explícita with withoutSupersets=true
const exitFB_NoSS = ctx.getEstimatedExitTime('fullbodyA', currentSimTime, true);
assert.strictEqual(exitFB_NoSS.remainingMin, exitFB.remainingMinNoSS, 'remainingMin con flag true debe coincidir con remainingMinNoSS');
assert.strictEqual(exitFB_NoSS.clock, exitFB.clockNoSS, 'clock con flag true debe coincidir con clockNoSS');
console.log('  ✓ getEstimatedExitTime con withoutSupersets=true devuelve cálculo lineal como principal');

// Renderizado en cabecera durante sesión activa con superseries
ctx.isExpressMode = false;
ctx.updateHeaderEstimatedDuration('fullbodyA');
assert(domHeader.innerHTML.includes('header-rem-badge'), 'Debe incluir badge de tiempo restante en progreso');
assert(domHeader.innerHTML.includes('id="headerEstDurationNoSS"'), 'Debe incluir id="headerEstDurationNoSS" en progreso');
assert(domHeader.innerHTML.includes('(sin SS: ~' + exitFB.remainingMinNoSS + ' min, fin ~' + exitFB.clockNoSS + ')'), 'Debe incluir hora y minutos sin superseries en cabecera en progreso');
console.log('  ✓ Cabecera en sesión activa muestra tiempo restante con SS Y sin SS con hora de finalización');

// Renderizado en cabecera durante sesión activa sin superseries (Torso A)
ctx.workoutState.completed = ['torsoA_1_0', 'torsoA_1_1'];
const exitTorso = ctx.getEstimatedExitTime('torsoA', currentSimTime);
assert.strictEqual(exitTorso.hasSupersets, false, 'Torso A no tiene superseries');
assert.strictEqual(exitTorso.remainingMinSS, exitTorso.remainingMinNoSS, 'En Torso A ambos cálculos de duración deben coincidir');
ctx.updateHeaderEstimatedDuration('torsoA');
assert(!domHeader.innerHTML.includes('(sin SS:'), 'Torso A no debe incluir badge redundante sin SS');
console.log('  ✓ Torso A en sesión activa no muestra etiqueta redundante sin superseries');

console.log('\n====================================================');
console.log('🎉 TODAS LAS PRUEBAS DE TIEMPOS PREVISTOS SUPERADAS');
console.log('====================================================');
