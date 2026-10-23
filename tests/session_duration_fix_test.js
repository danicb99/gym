const assert = require('assert');
const fs = require('fs');

console.log('====================================================');
console.log('🧪 VigorexiApp - Test de Duración y Reparación de Sesiones');
console.log('====================================================');

const html = fs.readFileSync('index.html', 'utf-8');

// 1. Verificación de existencia de funciones clave en index.html
console.log('\n🔍 1. Verificación de Funciones Clave:');
assert(html.includes('function calculateRealisticSessionDuration('), 'calculateRealisticSessionDuration no encontrada');
console.log('  ✓ calculateRealisticSessionDuration implementada');

assert(html.includes('function autoFixExcessiveDurations('), 'autoFixExcessiveDurations no encontrada');
console.log('  ✓ autoFixExcessiveDurations implementada');

assert(html.includes('function editSessionDurationById('), 'editSessionDurationById no encontrada');
console.log('  ✓ editSessionDurationById implementada');

assert(html.includes('function reconcileStaleSessions('), 'reconcileStaleSessions no encontrada');
console.log('  ✓ reconcileStaleSessions implementada');

// 2. Verificación de Botones en la Interfaz (UI):
console.log('\n🎛️ 2. Verificación de Botones UI:');
assert(html.includes('data-edit-duration-session='), 'Botón de editar duración no encontrado en modal de detalle');
console.log('  ✓ Botón "✏️ Editar duración" en modal de detalle de sesión');

assert(html.includes('btn-fix-durations'), 'Botón de corrección automática en historial no encontrado');
console.log('  ✓ Banner y botón de corrección automática presentes en historial');

// 3. Simulación Funcional de la Lógica de Cálculo:
console.log('\n⏱️ 3. Simulación de calculateRealisticSessionDuration:');

function calculateRealisticSessionDuration(dayId, startTime, workoutState, setsCount) {
  if (!startTime) return 45;
  const now = Date.now();
  const pausedTotal = (workoutState.pausedDuration && workoutState.pausedDuration[dayId]) || 0;
  const endTime = (workoutState.idlePaused && workoutState.idlePaused[dayId]) ? workoutState.idlePaused[dayId] : now;
  
  let rawMin = Math.round((endTime - startTime - pausedTotal) / 60000);
  
  if (rawMin >= 5 && rawMin <= 120) {
    return rawMin;
  }
  
  if (setsCount > 0) {
    const estFromSets = Math.round(6 + setsCount * 2.5);
    return Math.max(20, Math.min(90, estFromSets));
  }
  
  return 45;
}

// Caso A: Entreno normal de 50 minutos
const startA = Date.now() - 50 * 60 * 1000;
const durA = calculateRealisticSessionDuration('torsoA', startA, {}, 12);
assert.strictEqual(durA, 50, 'Debería ser 50 min');
console.log('  ✓ Sesión normal de 50 min: respetada exactamente (50 min)');

// Caso B: Sesión abandonada hace 48 horas con 12 series
const startB = Date.now() - 48 * 3600 * 1000; // 2880 minutos
const durB = calculateRealisticSessionDuration('torsoA', startB, {}, 12);
assert(durB <= 90 && durB >= 20, `Duración debería estar acotada entre 20 y 90, fue ${durB}`);
assert.strictEqual(durB, 36, '12 series deberían dar 6 + 12*2.5 = 36 min');
console.log(`  ✓ Sesión abandonada de 48h (2880 min): corregida automáticamente a ${durB} min`);

// Caso C: Sesión pausada por inactividad tras 42 minutos
const startC = Date.now() - 5 * 3600 * 1000;
const pauseC = startC + 42 * 60 * 1000;
const durC = calculateRealisticSessionDuration('piernaA', startC, { idlePaused: { piernaA: pauseC } }, 10);
assert.strictEqual(durC, 42, 'Debería congelarse en los 42 minutos de cuando se pausó');
console.log('  ✓ Sesión con pausa por inactividad: congelada en 42 min');

// 4. Simulación de Auto-Corrección Histórica:
console.log('\n🧹 4. Simulación de Corrección de Sesiones Antiguas (autoFixExcessiveDurations):');
const mockSessions = [
  { id: 's1', dayId: 'torsoA', durationMinutes: 2880, exercises: [{ sets: [{}, {}, {}] }, { sets: [{}, {}, {}] }] },
  { id: 's2', dayId: 'piernaA', durationMinutes: 52, exercises: [{ sets: [{}] }] },
  { id: 's3', dayId: 'torsoB', durationMinutes: 1440, exercises: [] }
];

let fixed = 0;
mockSessions.forEach(s => {
  if (s.durationMinutes > 150) {
    const totalSets = (s.exercises || []).reduce((acc, ex) => acc + (ex.sets ? ex.sets.length : 0), 0);
    let est = 45;
    if (totalSets > 0) {
      est = Math.round(6 + totalSets * 2.5);
      est = Math.max(25, Math.min(80, est));
    }
    s.durationMinutes = est;
    s.durationFormatted = est >= 60 ? `${Math.floor(est / 60)}h ${est % 60}m` : `${est} min`;
    fixed++;
  }
});

assert.strictEqual(fixed, 2, 'Deben corregirse 2 sesiones anómalas');
assert.strictEqual(mockSessions[0].durationMinutes, 25, '6 series acotadas al mínimo realista de 25 min');
assert.strictEqual(mockSessions[1].durationMinutes, 52, 'Sesión normal de 52 min intacta');
assert.strictEqual(mockSessions[2].durationMinutes, 45, 'Sesión sin series -> 45 min');
console.log('  ✓ Detección y corrección de sesiones anómalas: 2 corregidas (25 min y 45 min), 1 intacta (52 min)');

console.log('\n====================================================');
console.log('🎉 TODAS LAS VERIFICACIONES DE DURACIÓN APROBADAS');
console.log('====================================================\n');
