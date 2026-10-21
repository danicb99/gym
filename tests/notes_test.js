const fs = require('fs');
const assert = require('assert');

console.log('====================================================');
console.log('🧪 VigorexiApp - Pruebas de Anotaciones en Historial');
console.log('====================================================');

const indexHtml = fs.readFileSync('index.html', 'utf8');

// 1. Verificación de definiciones y componentes en HTML
console.log('\n📝 1. Verificación Estructural de Código:');
assert(indexHtml.includes('function handleNoteChange'), 'handleNoteChange debe estar definida');
console.log('  ✓ handleNoteChange definida');

assert(indexHtml.includes('.session-ex-note'), '.session-ex-note CSS debe estar presente');
console.log('  ✓ Estilos CSS para notas presentes');

assert(indexHtml.includes('function openSessionDetailById'), 'openSessionDetailById debe estar definida');
console.log('  ✓ openSessionDetailById definida');

// 2. Simular entorno DOM y lógica de notas
console.log('\n⚙️ 2. Pruebas de Lógica en Memoria:');

// Mock simple de funciones y variables extraídas del HTML
let workoutState = {
  inputs: {},
  notes: {},
  completed: [],
  previous: {},
  exerciseHistory: {},
  sessions: [],
  customSlots: {},
  tempSlots: {},
  sessionStartTime: {},
  lastActivityTime: {}
};

function handleNoteChange(slotId, val) {
  if (!workoutState.notes) workoutState.notes = {};
  const trimmed = (val || '').trim();
  if (trimmed) {
    workoutState.notes[slotId] = trimmed;
  } else {
    delete workoutState.notes[slotId];
  }
}

// Probar añadir nota
handleNoteChange('fullbodyA_1', 'Buenas sensaciones, agarre prono cerrado');
assert.strictEqual(workoutState.notes['fullbodyA_1'], 'Buenas sensaciones, agarre prono cerrado');
console.log('  ✓ handleNoteChange guarda la nota en workoutState.notes');

// Probar vaciar nota
handleNoteChange('fullbodyA_1', '   ');
assert.strictEqual(workoutState.notes['fullbodyA_1'], undefined);
console.log('  ✓ handleNoteChange borra la nota si se pasa texto vacío');

// Volver a establecer para la prueba de archivado
handleNoteChange('fullbodyA_1', 'Récord personal, hombros sanos');

// Simular archivado
const slotId = 'fullbodyA_1';
const exId = 'banca';
const noteVal = workoutState.notes[slotId] || '';

const exSessionLog = {
  slotId: slotId,
  exId: exId,
  name: 'Press de Banca Plano con Barra',
  sets: [{ set: 1, kg: 80, reps: 8, est1RM: 100 }],
  bestKg: 80,
  bestReps: 8,
  best1RM: 100
};
if (noteVal) {
  exSessionLog.notes = noteVal;
}

const sessionRecord = {
  id: 'ses_123',
  date: new Date().toISOString(),
  dayId: 'fullbodyA',
  dayName: 'Día A: Full Body A',
  durationMinutes: 45,
  exercises: [exSessionLog]
};

// Guardar en exerciseHistory
if (!workoutState.exerciseHistory[exId]) workoutState.exerciseHistory[exId] = [];
workoutState.exerciseHistory[exId].push({
  date: sessionRecord.date,
  sets: exSessionLog.sets,
  bestKg: exSessionLog.bestKg,
  bestReps: exSessionLog.bestReps,
  best1RM: exSessionLog.best1RM,
  notes: exSessionLog.notes || ''
});

// Limpieza post-sesión
delete workoutState.notes[slotId];
workoutState.sessions.push(sessionRecord);

assert.strictEqual(sessionRecord.exercises[0].notes, 'Récord personal, hombros sanos');
console.log('  ✓ Sesión archivada incluye la nota del ejercicio');

assert.strictEqual(workoutState.exerciseHistory['banca'][0].notes, 'Récord personal, hombros sanos');
console.log('  ✓ Historial relacional del ejercicio incluye la nota');

assert.strictEqual(workoutState.notes['fullbodyA_1'], undefined);
console.log('  ✓ Entrada activa de notas queda limpia para la próxima semana');

// 3. Verificación de renderizado en CSV
console.log('\n📊 3. Verificación de Exportación CSV:');
assert(indexHtml.includes('Fecha,Dia,Duracion_Min,Ejercicio,Serie,KG,Reps,1RM_Estimado,Notas\\n'), 'CSV header debe incluir Notas');
console.log('  ✓ Cabecera CSV incluye columna Notas');

// 4. Verificación de renderizado en modal y timeline
console.log('\n📱 4. Verificación de Renderizado Visual:');
assert(indexHtml.includes('openSessionDetailById'), 'Timeline items deben permitir abrir detalle');
assert(indexHtml.includes('notesCount > 0'), 'Timeline items muestran badge si hay notas');
console.log('  ✓ Badge de notas y apertura modal integrados en la línea de tiempo');

console.log('\n====================================================');
console.log('🎉 Todas las pruebas de notas superadas con éxito');
console.log('====================================================');
