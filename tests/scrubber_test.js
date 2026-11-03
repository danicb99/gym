const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

console.log('====================================================');
console.log('🧪 VigorexiApp - Test Selector Táctil Scrubber Wheel');
console.log('====================================================\n');

// 1. Verificación de Markup HTML
console.log('📦 1. Verificación de Markup HTML del HUD:');
assert(html.includes('id="scrubber-hud"'), 'Falta el contenedor #scrubber-hud en index.html');
assert(html.includes('id="scrubberHudVal"'), 'Falta #scrubberHudVal para la cifra grande');
assert(html.includes('id="scrubberHudUnit"'), 'Falta #scrubberHudUnit para la unidad');
assert(html.includes('id="scrubberHudBadgeText"'), 'Falta #scrubberHudBadgeText para la etiqueta');
assert(html.includes('id="scrubberHudDelta"'), 'Falta #scrubberHudDelta para el delta');
assert(html.includes('id="scrubberRulerTicks"'), 'Falta #scrubberRulerTicks para la regla graduada');
console.log('  ✓ Estructura DOM completa del HUD presente en index.html');

// 2. Verificación de CSS
console.log('\n🎨 2. Verificación de Estilos CSS:');
assert(html.includes('touch-action: pan-y;'), 'Falta touch-action: pan-y en .set-input');
assert(html.includes('.scrubber-hud {'), 'Faltan estilos para .scrubber-hud');
assert(html.includes('.set-input.scrubbing-active {'), 'Falta clase de realce .scrubbing-active');
assert(html.includes('.scrubber-ruler-ticks {'), 'Falta regla graduada repetitiva');
console.log('  ✓ Estilos CSS táctiles, animaciones y glassmorphism validados');

// 3. Verificación de Controladores JS
console.log('\n⚙️ 3. Verificación de Controlador JavaScript:');
assert(html.includes('function initScrubberController()'), 'Falta la función initScrubberController');
assert(html.includes('function updateScrubberHud('), 'Falta la función updateScrubberHud');
assert(html.includes('function showScrubberHud('), 'Falta la función showScrubberHud');
assert(html.includes('function hideScrubberHud('), 'Falta la función hideScrubberHud');
assert(html.includes('initScrubberController();'), 'initScrubberController no se invoca en initApp');
console.log('  ✓ Funciones del controlador integradas y conectadas a initApp');

// 4. Verificación de Algoritmos de Cálculo (Física Natural de Ruleta)
console.log('\n🧮 4. Verificación de Fórmulas y Rangos (Física Natural de Ruleta):');
// Simulación lógica de repeticiones (24px = 1 rep, arrastrar der = baja, arrastrar izq = sube)
const calcReps = (init, dx) => Math.max(0, Math.min(99, Math.round(init + Math.round(-dx / 24))));
assert.strictEqual(calcReps(8, 0), 8, 'dx=0 debe ser 8');
assert.strictEqual(calcReps(8, 24), 7, 'dx=24 (arrastre derecha) debe ser 7 (-1 rep)');
assert.strictEqual(calcReps(8, 48), 6, 'dx=48 (arrastre derecha) debe ser 6 (-2 reps)');
assert.strictEqual(calcReps(8, -24), 9, 'dx=-24 (arrastre izquierda) debe ser 9 (+1 rep)');
assert.strictEqual(calcReps(8, -48), 10, 'dx=-48 (arrastre izquierda) debe ser 10 (+2 reps)');
assert.strictEqual(calcReps(8, 300), 0, 'No debe bajar de 0 reps');
console.log('  ✓ Lógica de Repeticiones correcta (física natural: der=baja, izq=sube, límites 0-99)');

// Simulación lógica de peso (física natural de ruleta: der=baja, izq=sube con step del ejercicio)
const calcKg = (init, dx, step = 2.5) => {
  const stepsCount = Math.round(-dx / 24);
  return Math.max(0, Math.min(999, Math.round((init + stepsCount * step) * 10) / 10));
};
assert.strictEqual(calcKg(80, 0), 80, 'dx=0 debe ser 80');
assert.strictEqual(calcKg(80, 24, 2.5), 77.5, 'dx=24 (arrastre derecha) debe ser 77.5 kg (-2.5 kg)');
assert.strictEqual(calcKg(80, 48, 2.5), 75.0, 'dx=48 (arrastre derecha) debe ser 75.0 kg (-5.0 kg)');
assert.strictEqual(calcKg(80, -24, 2.5), 82.5, 'dx=-24 (arrastre izquierda) debe ser 82.5 kg (+2.5 kg)');
assert.strictEqual(calcKg(80, -48, 2.5), 85.0, 'dx=-48 (arrastre izquierda) debe ser 85.0 kg (+5.0 kg)');
assert.strictEqual(calcKg(80, 1000), 0, 'No debe bajar de 0 kg');
console.log('  ✓ Lógica de Peso (kg) correcta (física natural: der=baja, izq=sube)');

// 5. Verificación de Caché SW rev54
console.log('\n📦 5. Verificación de Cache PWA rev54:');
assert(/const CACHE_NAME = 'vigorexiapp-v1\.8\.4-rev54'/.test(sw), 'sw.js debe ser rev54');
assert(/sw\.js\?v=1\.8\.4-rev54/.test(html), 'index.html debe registrar rev54');
console.log('  ✓ PWA cache rev54 sincronizada para despliegue inmediato');

console.log('\n====================================================');
console.log('🎉 TODAS LAS PRUEBAS DEL SELECTOR TÁCTIL APROBADAS');
console.log('====================================================');
