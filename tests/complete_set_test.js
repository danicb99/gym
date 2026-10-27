const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

console.log('====================================================');
console.log('🧪 VigorexiApp - Test de Marcado y Auto-Colapso (rev28)');
console.log('====================================================\n');

// 1. Verificación de versiones
console.log('📦 1. Verificación de Versiones de Caché:');
assert(/const CACHE_NAME = 'vigorexiapp-v1\.8\.4-rev36'/.test(sw), 'sw.js no tiene rev36');
assert(/sw\.js\?v=1\.8\.4-rev36/.test(html), 'index.html no registra rev36');
console.log('  ✓ Cache sincronizada en index.html y sw.js');

// 2. Verificación de colores amarillos en checks de serie
console.log('\n💛 2. Verificación de Check Buttons Amarillos:');
assert(/\.set-row\.done\s*\.check-btn\s*\{[\s\S]*?#fbbf24/.test(html), 'El botón de serie completada no tiene amarillo #fbbf24');
assert(/\.set-row\.done\s*\{[\s\S]*?rgba\(251,\s*191,\s*36/.test(html), 'La fila de serie completada no tiene tinte dorado');
console.log('  ✓ Botones de serie completada estilizados en degradado dorado (#fbbf24 / #d97706) con stroke oscuro');

// 2. Verificación de auto-colapso al completar ejercicio
console.log('\n🗂️ 2. Verificación de Auto-Colapso al Completar Todas las Series:');
assert(html.includes("card.classList.add('collapsed')"), 'completeSet no añade la clase collapsed a la card completada');
assert(html.includes("card.classList.remove('manually-expanded')"), 'completeSet no retira manually-expanded de la card completada');
console.log('  ✓ completeSet colapsa formalmente la tarjeta (.collapsed) y retira .manually-expanded al terminar sus series');

// 3. Verificación de resiliencia en updateSessionTimerDisplay
console.log('\n⏱️ 3. Verificación de Resiliencia en updateSessionTimerDisplay:');
assert(html.includes('if (!chip) return;'), 'updateSessionTimerDisplay carece de guardia para chip nulo');
console.log('  ✓ Guardia "if (!chip) return;" presente');

console.log('\n====================================================');
console.log('🎉 TODAS LAS VERIFICACIONES DE AUTO-COLAPSO APROBADAS');
console.log('====================================================');
