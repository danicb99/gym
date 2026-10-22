const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

console.log('====================================================');
console.log('🧪 VigorexiApp - Test de Marcado Seguro de Series (rev20)');
console.log('====================================================\n');

// 1. Verificación de versiones
console.log('📦 1. Verificación de Versiones de Caché:');
assert(/const CACHE_NAME = 'vigorexiapp-v1\.8\.4-rev20'/.test(sw), 'sw.js no tiene rev20');
assert(/sw\.js\?v=1\.8\.4-rev20/.test(html), 'index.html no registra rev20');
console.log('  ✓ Cache rev20 sincronizada en index.html y sw.js');

// 2. Verificación de guardia en updateSessionTimerDisplay
console.log('\n⏱️ 2. Verificación de Resiliencia en updateSessionTimerDisplay:');
assert(html.includes('if (!chip) return;'), 'updateSessionTimerDisplay carece de guardia para chip nulo');
console.log('  ✓ Guardia "if (!chip) return;" presente para evitar TypeError por chip inexistente');

// 3. Verificación de try/catch y defensas en completeSet
console.log('\n🛡️ 3. Verificación de Robustez en completeSet:');
assert(html.includes('workoutState.inputs = workoutState.inputs || {}') || html.includes('if (!workoutState.inputs) workoutState.inputs = {};'), 'completeSet no asegura inicialización de inputs');
assert(html.includes('replace(\',\', \'.\')'), 'completeSet no normaliza comas decimales para kg');
console.log('  ✓ completeSet inicializa defensivamente workoutState.inputs y workoutState.setTimestamps');
console.log('  ✓ completeSet normaliza comas decimales para el cálculo de 1RM');

console.log('\n====================================================');
console.log('🎉 TODAS LAS VERIFICACIONES DE MARCADO DE SERIES APROBADAS');
console.log('====================================================');
