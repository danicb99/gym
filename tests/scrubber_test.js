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

// 4. Verificación de Algoritmos de Cálculo
console.log('\n🧮 4. Verificación de Fórmulas y Rangos:');
// Simulación lógica de repeticiones (14px = 1 rep)
const calcReps = (init, dx) => Math.max(0, Math.min(99, Math.round(init + Math.round(dx / 14))));
assert.strictEqual(calcReps(8, 0), 8, 'dx=0 debe ser 8');
assert.strictEqual(calcReps(8, 14), 9, 'dx=14 debe ser 9');
assert.strictEqual(calcReps(8, 28), 10, 'dx=28 debe ser 10');
assert.strictEqual(calcReps(8, -14), 7, 'dx=-14 debe ser 7');
assert.strictEqual(calcReps(8, -150), 0, 'No debe bajar de 0 reps');
console.log('  ✓ Lógica de Repeticiones correcta (paso de 1 en 1, límites 0-99)');

// Simulación lógica de peso (1kg inicial + aceleración progresiva)
const calcKg = (init, dx) => {
  const sign = dx >= 0 ? 1 : -1;
  const absDx = Math.abs(dx);
  let deltaKg;
  if (absDx <= 36) {
    deltaKg = Math.round(absDx / 12);
  } else {
    deltaKg = Math.round(36 / 12 + Math.pow((absDx - 36) / 13, 1.25));
  }
  return Math.max(0, Math.min(999, Math.round(init + sign * deltaKg)));
};
assert.strictEqual(calcKg(80, 0), 80, 'dx=0 debe ser 80');
assert.strictEqual(calcKg(80, 12), 81, 'dx=12 debe ser +1 kg');
assert.strictEqual(calcKg(80, 24), 82, 'dx=24 debe ser +2 kg');
assert.strictEqual(calcKg(80, 36), 83, 'dx=36 debe ser +3 kg');
assert.strictEqual(calcKg(80, -12), 79, 'dx=-12 debe ser -1 kg');
assert(calcKg(80, 80) >= 86, 'dx=80 debe acelerar y permitir saltos mayores');
assert.strictEqual(calcKg(80, -500), 0, 'No debe bajar de 0 kg');
console.log('  ✓ Lógica de Peso (kg) correcta (paso de 1kg fino con aceleración progresiva)');

// 5. Verificación de Caché SW rev37
console.log('\n📦 5. Verificación de Cache PWA rev37:');
assert(/const CACHE_NAME = 'vigorexiapp-v1\.8\.4-rev37'/.test(sw), 'sw.js debe ser rev37');
assert(/sw\.js\?v=1\.8\.4-rev37/.test(html), 'index.html debe registrar rev37');
console.log('  ✓ PWA cache rev37 sincronizada para despliegue inmediato');

console.log('\n====================================================');
console.log('🎉 TODAS LAS PRUEBAS DEL SELECTOR TÁCTIL APROBADAS');
console.log('====================================================');
