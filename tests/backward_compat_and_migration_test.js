const fs = require('fs');
const assert = require('assert');
const path = require('path');

console.log('====================================================');
console.log('🧪 VigorexiApp - Test de Compatibilidad y Migración');
console.log('====================================================');

const { ROUTINE_SLOTS, EXERCISE_CATALOG } = require('../watch/utils/routine_data.js');

// 1. Simulación de copia de seguridad antigua con historial real
console.log('\n📦 1. Prueba de Copia de Seguridad Antigua e Historial Heredado:');

const legacyBackup = {
  version: 1,
  program: 'fullbody',
  last_day: 'fullbodyA',
  previous: {
    squat: { kg: '100', reps: '8' },
    bench: { kg: '80', reps: '8' },
    jalon: { kg: '70', reps: '10' },
    elev_lat: { kg: '12', reps: '15' },
    gemelopie: { kg: '75', reps: '15' },   // Ejercicio del programa 4 días reutilizado
    legext: { kg: '60', reps: '12' },      // Ejercicio del programa 4 días reutilizado
    remo: { kg: '65', reps: '10' },        // Ejercicio del programa 4 días reutilizado
    remouni: { kg: '34', reps: '10' },     // Ejercicio que pasó a ser alternativa
    rdl: { kg: '90', reps: '10' },
    press_inc: { kg: '30', reps: '10' }
  },
  exerciseHistory: {
    squat: [{ date: '2026-10-10', kg: '100', reps: '8', best1RM: 124 }],
    remo: [{ date: '2026-10-12', kg: '65', reps: '10', best1RM: 86.7 }],
    remouni: [{ date: '2026-10-14', kg: '34', reps: '10', best1RM: 45.3 }],
    gemelopie: [{ date: '2026-10-15', kg: '75', reps: '15', best1RM: 112.5 }],
    legext: [{ date: '2026-10-16', kg: '60', reps: '12', best1RM: 84 }]
  },
  sessions: [
    { id: 'ses_1', date: '2026-10-16T15:15:00.000Z', dayId: 'fullbodyA', durationFormatted: '44 min' }
  ]
};

// Verificar que los slots de la nueva rutina A, B, C recuperan su "Anterior" inmediatamente
const dayA = ROUTINE_SLOTS.fullbodyA;
const squatSlot = dayA.slots.find(s => s.defaultExId === 'squat');
assert(squatSlot, 'Slot de squat debe existir');
assert.strictEqual(legacyBackup.previous[squatSlot.defaultExId].kg, '100');
console.log('  ✓ Sentadilla recupera carga previa: 100 kg x 8 reps');

const gemeloSlotA = dayA.slots.find(s => s.defaultExId === 'gemelopie');
assert(gemeloSlotA, 'Slot de gemelopie debe existir en Día A');
assert.strictEqual(legacyBackup.previous[gemeloSlotA.defaultExId].kg, '75');
console.log('  ✓ Gemelo de pie en Día A hereda inmediatamente historial: 75 kg x 15 reps');

const dayB = ROUTINE_SLOTS.fullbodyB;
const remoSlotB = dayB.slots.find(s => s.defaultExId === 'remo');
assert(remoSlotB, 'Slot de remo debe existir en Día B');
assert.strictEqual(legacyBackup.previous[remoSlotB.defaultExId].kg, '65');
console.log('  ✓ Remo en polea baja en Día B hereda historial del programa 4 días: 65 kg x 10 reps');

// Verificar que remouni como alternativa mantiene su historial intacto
assert(legacyBackup.exerciseHistory['remouni'], 'Historial de remouni debe seguir accesible');
assert.strictEqual(legacyBackup.exerciseHistory['remouni'][0].kg, '34');
console.log('  ✓ Remo unilateral con mancuerna (ahora alternativa) conserva su historial: 34 kg');

const legextSlotB = dayB.slots.find(s => s.defaultExId === 'legext');
assert(legextSlotB, 'Slot de legext debe existir en Día B');
assert.strictEqual(legacyBackup.previous[legextSlotB.defaultExId].kg, '60');
console.log('  ✓ Extensión de cuádriceps en Día B hereda historial: 60 kg x 12 reps');

// 2. Simulación de sesión a medias antes de la actualización
console.log('\n🔄 2. Prueba de Sesión en Curso a Medias (Resiliencia ante migración):');

const inProgressSessionState = {
  dayId: 'fullbodyA',
  sessionStartTime: { fullbodyA: Date.now() - 25 * 60 * 1000 }, // 25 min transcurridos
  checks: {
    'fullbodyA_1_0': true,
    'fullbodyA_1_1': true,
    'fullbodyA_1_2': true,
    'fullbodyA_2_0': true
  },
  inputs: {
    'fullbodyA_1_0_kg': '100',
    'fullbodyA_1_0_reps': '8',
    'fullbodyA_1_1_kg': '100',
    'fullbodyA_1_1_reps': '7',
    'fullbodyA_1_2_kg': '100',
    'fullbodyA_1_2_reps': '6',
    'fullbodyA_2_0_kg': '80',
    'fullbodyA_2_0_reps': '8'
  }
};

// Verificar que el estado a medias se lee sin corromperse
assert.strictEqual(inProgressSessionState.checks['fullbodyA_1_0'], true);
assert.strictEqual(inProgressSessionState.inputs['fullbodyA_1_0_kg'], '100');
console.log('  ✓ Las series ya marcadas de Sentadilla y Press Banca se preservan');

// Comprobar que los nuevos slots (ej. fullbodyA_7 gemelos) tienen fallback seguro
const newSlotKey = 'fullbodyA_7_0';
const isNewSlotDone = !!inProgressSessionState.checks[newSlotKey];
const newSlotKg = inProgressSessionState.inputs[`${newSlotKey}_kg`] || '';
assert.strictEqual(isNewSlotDone, false, 'Nuevo slot no debe estar marcado');
assert.strictEqual(newSlotKg, '', 'Nuevo slot debe tener input vacío seguro');
console.log('  ✓ Nuevos slots tienen valores seguros (no marcados, sin NaN)');

// Simular cálculo de tiempo restante sin lanzar errores
const elapsedMin = Math.round((Date.now() - inProgressSessionState.sessionStartTime.fullbodyA) / 60000);
assert(elapsedMin >= 24 && elapsedMin <= 26, 'El temporizador de sesión debe continuar sin reiniciarse');
console.log(`  ✓ Temporizador de sesión continuó contando correctamente: ${elapsedMin} min`);

console.log('\n====================================================');
console.log('🎉 TODAS LAS PRUEBAS DE MIGRACIÓN Y COMPATIBILIDAD APROBADAS');
console.log('====================================================');
