const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

console.log('====================================================');
console.log('🧪 VigorexiApp - Test Post-Entreno, Descanso e Historial');
console.log('====================================================\n');

// 1. Verificación de versiones
console.log('📦 1. Verificación de Versiones de Caché (rev28):');
assert(/const CACHE_NAME = 'vigorexiapp-v1\.8\.4-rev28'/.test(sw), 'sw.js no tiene rev28');
assert(/sw\.js\?v=1\.8\.4-rev28/.test(html), 'index.html no registra rev28');
console.log('  ✓ Cache rev28 sincronizada en index.html y sw.js');

// 2. Verificación de Historial en Negrita
console.log('\n📅 2. Verificación de Día Actual en Negrita en el Historial:');
assert(/\.cal-day-cell\.today\s*\.cal-day-num\s*\{[^}]*font-weight:\s*900/i.test(html), 'Falta estilo font-weight: 900 en el número de hoy en el calendario');
assert(/isCurrentDay\s*\?[\s\S]*?<strong class="cal-day-num" style="font-weight:\s*900/i.test(html), 'renderStreakCalendar debe renderizar strong con font-weight 900 para hoy');
assert(/isTodaySession\s*\?[\s\S]*?<strong style="font-weight:\s*900/i.test(html), 'sessionsTimelineList debe renderizar fecha en negrita para hoy');
console.log('  ✓ Día actual formateado en negrita tanto en calendario como en la línea de tiempo');

// 3. Verificación de Popup Simple de Felicitación
console.log('\n🎉 3. Verificación del Popup Simple de Felicitación:');
assert(html.includes('id="congratsMetricsRow"'), 'Falta el contenedor de métricas congratsMetricsRow');
assert(html.includes('id="congratsPRCard"'), 'Falta la tarjeta de récord/logro congratsPRCard');
assert(html.includes('id="congratsTipCard"'), 'Falta la tarjeta de sobrecarga/mejora congratsTipCard');
assert(html.includes('id="congratsNextCard"'), 'Falta la tarjeta de descanso congratsNextCard');
assert(html.includes('btn-congrats-rest'), 'Falta el botón ¡A descansar!');
assert(html.includes('id="workoutShareCanvas"'), 'workoutShareCanvas debe existir en el DOM para compatibilidad');

// Comprobar que closeWorkoutSummaryModal ya NO conmuta de día automáticamente
const closeSummaryCode = html.slice(html.indexOf('function closeWorkoutSummaryModal'), html.indexOf('function closeWorkoutSummaryModal') + 300);
assert(!closeSummaryCode.includes('selectDay(nextRec)'), 'closeWorkoutSummaryModal no debe forzar el salto al día siguiente');
console.log('  ✓ Estructura de felicitación completa y cierre sin salto forzado al día siguiente');

// 4. Verificación de Lógica de Descanso y Retención de Día
console.log('\n🛌 4. Verificación de Retención de Día y Aviso de Descanso:');
assert(html.includes('function updateRestWarningBanner'), 'Falta la función updateRestWarningBanner');
assert(html.includes('function getTodayCompletedSession'), 'Falta la función getTodayCompletedSession');
assert(html.includes('function isDateToday'), 'Falta la función isDateToday');

// Simulación de función getTodayCompletedSession y updateRestWarningBanner
const sandbox = {
  workoutState: {
    sessions: [
      {
        id: 'ses_today',
        date: new Date().toISOString(),
        dayId: 'fullbodyA',
        dayName: 'Día A: Squat + Torso',
        durationMinutes: 42,
        exercises: []
      }
    ]
  },
  currentProgram: 'fullbody',
  escapeHtml: s => String(s)
};

// Extraer funciones para ejecutarlas en sandbox
function extractFunction(name) {
  const start = html.indexOf('function ' + name);
  assert(start !== -1, 'No se encontró ' + name);
  let depth = 0;
  let brace = html.indexOf('{', start);
  for (let i = brace; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') {
      depth--;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  throw new Error('Unbalanced ' + name);
}

vm.createContext(sandbox);
vm.runInContext(extractFunction('isDateToday'), sandbox);
vm.runInContext(extractFunction('getTodayCompletedSession'), sandbox);
vm.runInContext(extractFunction('getNextWorkoutDayTitle'), sandbox);

const todaySession = sandbox.getTodayCompletedSession();
assert(todaySession !== null, 'getTodayCompletedSession debe encontrar la sesión de hoy');
assert.strictEqual(todaySession.dayId, 'fullbodyA');
console.log('  ✓ getTodayCompletedSession detecta correctamente la sesión realizada hoy');

const nextTitle = sandbox.getNextWorkoutDayTitle('fullbodyA');
assert(nextTitle.includes('Día B'), `El siguiente día debe ser Día B, se obtuvo: ${nextTitle}`);
console.log('  ✓ getNextWorkoutDayTitle sugiere correctamente el Día B tras el Día A');

// Comprobar autoSelectInitialDay con sesión de hoy
assert(/if\s*\(typeof isDateToday === 'function' && isDateToday\(lastSession\.date\)\)\s*\{\s*\/\/[^\n]*\s*selectDay\(lastDayId\);/i.test(html), 'autoSelectInitialDay debe seleccionar el día completado hoy si ya se entrenó hoy');
console.log('  ✓ autoSelectInitialDay retiene el día completado hoy en vez de saltar al de mañana');

// 5. Verificación de Iconos Vectoriales y Coherencia de Diseño Sin Degradados (rev28)
console.log('\n✨ 5. Verificación de Iconos Vectoriales y Cohesión Visual (rev28):');
assert(html.includes('.today-done-badge'), 'Falta la clase CSS .today-done-badge');
assert(html.includes('.rest-warning-badge'), 'Falta la clase CSS .rest-warning-badge');
assert(!/class="today-done-banner"[^>]*>[\s\S]*?✅/i.test(html), 'today-done-banner no debe usar el emoji ✅ genérico');
assert(html.includes('class="today-done-badge"'), 'today-done-banner debe usar el badge vectorial today-done-badge');
assert(html.includes('class="rest-warning-badge"'), 'rest-warning-banner debe usar el badge vectorial rest-warning-badge');
assert(!/updateRestWarningBanner[\s\S]*?✅/.test(html), 'updateRestWarningBanner no debe contener emojis ✅');
assert(!/\.today-done-badge\s*\{[^}]*linear-gradient/i.test(html), 'today-done-badge no debe tener degradados');
assert(!/\.rest-warning-badge\s*\{[^}]*linear-gradient/i.test(html), 'rest-warning-badge no debe tener degradados');
assert(!/📅/.test(html), 'index.html no debe contener el emoji de calendario 📅');
assert(html.includes('rect x="3" y="4" width="18" height="18"'), 'El calendario del desplegable debe usar el icono SVG idéntico al del historial');
console.log('  ✓ Iconos vectoriales dorados/cyan integrados en un solo color sin degradados ni emojis');

console.log('\n====================================================');
console.log('🎉 TODAS LAS PRUEBAS POST-ENTRENO Y DESCANSO APROBADAS');
console.log('====================================================');
