const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

console.log('====================================================');
console.log('🧪 VigorexiApp - Test de Marcado y Auto-Colapso (rev21)');
console.log('====================================================\n');

// 1. Verificación de versiones
console.log('📦 1. Verificación de Versiones de Caché:');
assert(/const CACHE_NAME = 'vigorexiapp-v1\.8\.4-rev21'/.test(sw), 'sw.js no tiene rev21');
assert(/sw\.js\?v=1\.8\.4-rev21/.test(html), 'index.html no registra rev21');
console.log('  ✓ Cache rev21 sincronizada en index.html y sw.js');

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
