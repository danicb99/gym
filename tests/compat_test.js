const fs = require('fs');
const assert = require('assert');

console.log('====================================================');
console.log('🧪 VigorexiApp - Verificación de Compatibilidad v1.6.0');
console.log('====================================================');

const indexHtml = fs.readFileSync('index.html', 'utf8');
const swJs = fs.readFileSync('sw.js', 'utf8');
const watchAppJson = JSON.parse(fs.readFileSync('watch/app.json', 'utf8'));

// 1. Verificar versiones
console.log('\n📦 1. Verificación de Versiones:');
assert(swJs.includes('vigorexiapp-v1.6.0-design9'), 'sw.js debe tener la caché v1.6.0');
console.log('  ✓ sw.js caché actualizada a v1.6.0-design1');

assert.strictEqual(watchAppJson.app.version.code, 16, 'watch/app.json code debe ser 16');
assert.strictEqual(watchAppJson.app.version.name, '1.6.0', 'watch/app.json name debe ser 1.6.0');
console.log('  ✓ watch/app.json versión code=16, name=1.6.0');

// 2. Verificar componentes móviles críticos en index.html
console.log('\n📱 2. Verificación de Componentes Móviles (PWA):');

const requiredIds = [
  // Cabecera y selectores
  'btnProgramSwitch', 'daySelector', 'topTimerWidget', 'timerDisplay',
  'workoutProgressBar', 'headerProgSets', 'headerProgPct',
  // Secciones principales
  'fullbodyA', 'fullbodyB', 'fullbodyC', 'torsoA', 'piernaA', 'torsoB', 'piernaB',
  'historialView', 'routinePlanView',
  // Barra de navegación inferior
  'appBottomNav', 'tabBtnTrain', 'tabBtnHist', 'tabBtnPlan',
  // Dock de descanso flotante
  'restTimerDock', 'restTimerDigits', 'restTimerSub', 'skipRestBtn',
  // Modales
  'guideModal', 'swapModal', 'historyModal', 'workoutSummaryModal', 'programSelectModal',
  // Quick Stepper
  'quickStepperBar', 'stepperTitle',
  // Historial
  'statTotalSessions', 'statAvgDuration', 'statTotalVolume',
  'streakCalendarCard', 'streakBadge', 'calendarDaysGrid', 'historyExSelector'
];

requiredIds.forEach(id => {
  assert(indexHtml.includes(`id="${id}"`), `Elemento con id="${id}" debe existir en index.html`);
});
console.log(`  ✓ Los ${requiredIds.length} IDs estructurales requeridos existen en index.html`);

// 3. Verificar funciones JS clave
console.log('\n⚙️ 3. Verificación de Funciones JavaScript:');
const requiredFunctions = [
  'switchMainTab', 'updateRoutinePlanViewCards', 'selectDay', 'handleDaySelectChange',
  'switchRoutineProgram', 'completeSet', 'updateProgress', 'updateTimerUI',
  'triggerRest', 'resetTimerDock', 'finishDaySession', 'downloadBackupJSON',
  'shareBackup', 'restoreBackupFromFile', 'copyBackupToClipboard', 'pasteBackupFromClipboard'
];

requiredFunctions.forEach(fn => {
  assert(indexHtml.includes(`function ${fn}`), `La función ${fn} debe estar definida en index.html`);
});
console.log(`  ✓ Las ${requiredFunctions.length} funciones clave de interacción están presentes`);

// 4. Verificar soporte AMOLED y Colores
console.log('\n🎨 4. Verificación de Paleta Cromática y AMOLED:');
assert(indexHtml.includes('--bg: #060a12;'), 'Fondo debe ser #060a12 (Obsidian AMOLED)');
assert(indexHtml.includes('--primary: #fbbf24;'), 'Primario debe ser #fbbf24 (Dorado)');
assert(indexHtml.includes('--emerald: #10b981;'), 'Éxito debe ser #10b981 (Esmeralda)');
assert(indexHtml.includes('--cyan: #38bdf8;'), 'Cyan debe ser #38bdf8');
assert(indexHtml.includes('--rose: #f43f5e;'), 'Rosa debe ser #f43f5e');
console.log('  ✓ Paleta original completa preservada en index.html');

// 5. Verificar reloj (Zepp OS)
console.log('\n⌚ 5. Verificación de Pantallas del Reloj (Zepp OS):');
const workoutJs = fs.readFileSync('watch/page/workout/index.js', 'utf8');
const timerJs = fs.readFileSync('watch/page/timer/index.js', 'utf8');
const daySelectJs = fs.readFileSync('watch/page/day_select/index.js', 'utf8');
const summaryJs = fs.readFileSync('watch/page/summary/index.js', 'utf8');
const themeJs = fs.readFileSync('watch/utils/theme.js', 'utf8');

assert(workoutJs.includes('THEME_COLORS'), 'workout/index.js debe importar THEME_COLORS');
assert(timerJs.includes('THEME_COLORS'), 'timer/index.js debe importar THEME_COLORS');
assert(daySelectJs.includes('THEME_COLORS'), 'day_select/index.js debe importar THEME_COLORS');
assert(summaryJs.includes('THEME_COLORS'), 'summary/index.js debe importar THEME_COLORS');

// Steppers de 68px
assert(/w:\s*68,\s*h:\s*68,\s*radius:\s*34/.test(workoutJs), 'workout/index.js debe tener steppers de 68px');
// Botón Hecha
assert(workoutJs.includes("text: '✓ Hecha'"), "workout/index.js debe tener botón '✓ Hecha'");
console.log('  ✓ Reloj incluye steppers de 68px, botón Hecha y widgets nativos');

console.log('\n====================================================');
console.log('🎉 Todas las verificaciones de compatibilidad aprobadas');
console.log('====================================================');
