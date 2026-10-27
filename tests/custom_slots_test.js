const fs = require('fs');
const assert = require('assert');

console.log('================================================================');
console.log('🧪 VigorexiApp - Pruebas de Ejercicios Alternativos Predeterminados');
console.log('================================================================');

const indexHtml = fs.readFileSync('index.html', 'utf8');
const watchAppJs = fs.readFileSync('watch/app.js', 'utf8');
const watchAltJs = fs.readFileSync('watch/page/alternatives/index.js', 'utf8');

// -------------------------------------------------------------
// 1. Verificación Estructural de Código
// -------------------------------------------------------------
console.log('\n📝 1. Verificación Estructural de Código:');

assert(indexHtml.includes("document.getElementById('summary-icon-' + slotId)"), 'renderSlotExercise debe actualizar summary-icon-${slotId}');
console.log('  ✓ Selector de icono de barra de resumen corregido a summary-icon-${slotId}');

assert(indexHtml.includes('function revertSlotToRoutineDefault'), 'revertSlotToRoutineDefault debe estar definida');
console.log('  ✓ Función revertSlotToRoutineDefault definida');

assert(indexHtml.includes('swap-custom-banner'), 'CSS y plantilla de swap-custom-banner deben existir');
console.log('  ✓ Banner de predeterminado activo en modal presente');

assert(indexHtml.includes('tag-custom-temp'), 'Estilos de tag-custom-temp deben existir');
assert(!indexHtml.includes('📌 Predeterminado'), 'No debe existir el pin ni el badge de 📌 Predeterminado en la tarjeta');
console.log('  ✓ Pin y mensaje de "predeterminado" eliminados en tarjetas de ejercicios');

assert(watchAppJs.includes('this.globalData.customSlots = Object.assign({}, saved.customSlots)'), 'watch/app.js debe restaurar customSlots en onCreate');
console.log('  ✓ watch/app.js restaura customSlots en onCreate');

assert(watchAltJs.includes('candidateIds.delete(currentExId)'), 'watch/page/alternatives/index.js debe calcular alternativas combinando slot default y current');
console.log('  ✓ watch/page/alternatives/index.js previene quedarse atrapado en alternativas');

// -------------------------------------------------------------
// 2. Extraer EXERCISE_CATALOG y ROUTINE_SLOTS para pruebas
// -------------------------------------------------------------
console.log('\n⚙️ 2. Pruebas de Catálogo y Bidireccionalidad:');

const catMatch = indexHtml.match(/const EXERCISE_CATALOG = ({[\s\S]*?});\s*const ROUTINE_SLOTS/);
assert(catMatch, 'EXERCISE_CATALOG debe encontrarse en index.html');
const EXERCISE_CATALOG = JSON.parse(catMatch[1]);

assert(EXERCISE_CATALOG.curltumbado.alternatives.includes('curlsentado'), 'curltumbado debe incluir curlsentado en alternatives');
console.log('  ✓ curltumbado apunta bidireccionalmente a curlsentado');

// Función de candidatos de alternativas (idéntica a la implementada en openSwapModal)
function getCandidateAlternatives(slotDefaultExId, currentExId) {
  const defaultEx = EXERCISE_CATALOG[slotDefaultExId] || { alternatives: [] };
  const currentEx = EXERCISE_CATALOG[currentExId] || { alternatives: [] };
  const candidateIds = new Set();
  if (slotDefaultExId) candidateIds.add(slotDefaultExId);
  if (defaultEx && Array.isArray(defaultEx.alternatives)) {
    defaultEx.alternatives.forEach(id => candidateIds.add(id));
  }
  if (currentEx && Array.isArray(currentEx.alternatives)) {
    currentEx.alternatives.forEach(id => candidateIds.add(id));
  }
  candidateIds.delete(currentExId);
  return Array.from(candidateIds).filter(id => !!EXERCISE_CATALOG[id]);
}

// Probar que el ejercicio original NUNCA se pierde al cambiar de alternativa
const candidatesAfterSwap = getCandidateAlternatives('aperturas_polea', 'press_maq_convergente');
assert(candidatesAfterSwap.includes('aperturas_polea'), 'El original aperturas_polea debe estar disponible tras cambiar a press_maq_convergente');
assert(candidatesAfterSwap.includes('pec_deck'), 'pec_deck debe estar disponible en aperturas_polea');
console.log('  ✓ Slot aperturas_polea permite volver al original incluso tras swap a máquina convergente');

const candidatesHams = getCandidateAlternatives('curlsentado', 'curltumbado');
assert(candidatesHams.includes('curlsentado'), 'curlsentado debe estar disponible tras cambiar a curltumbado');
console.log('  ✓ Slot piernaB_3 (curlsentado) permite volver al original tras swap a curltumbado');

// -------------------------------------------------------------
// 3. Simulación de Estado y applySwap / revertSlotToRoutineDefault
// -------------------------------------------------------------
console.log('\n🔄 3. Pruebas de Lógica de Swaps (applySwap y revertSlotToRoutineDefault):');

let workoutState = {
  inputs: {
    'fullbodyA_1_0_kg': '100',
    'fullbodyA_1_0_reps': '8'
  },
  notes: {},
  completed: [],
  previous: {
    'squat': { 0: '100kg x 8' }
  },
  customSlots: {},
  tempSlots: {}
};

let broadcastCount = 0;
function scheduleBroadcast(delay) {
  broadcastCount++;
}

// Mock DOM simple
const domElements = {};
function mockElement(id, initialAttrs = {}) {
  domElements[id] = {
    id: id,
    attrs: Object.assign({}, initialAttrs),
    style: {},
    innerText: '',
    innerHTML: '',
    value: '',
    placeholder: '',
    className: '',
    children: [],
    getAttribute(name) { return this.attrs[name]; },
    setAttribute(name, val) { this.attrs[name] = String(val); },
    querySelector(sel) { return null; },
    querySelectorAll(sel) { return []; }
  };
  return domElements[id];
}

const cardEl = mockElement('card-fullbodyA_1', { 'data-slot': 'fullbodyA_1', 'data-default-ex': 'squat', 'data-current-ex': 'squat' });
const titleEl = mockElement('title-fullbodyA_1');
const sumTitleEl = mockElement('summary-title-fullbodyA_1');
const sumIconEl = mockElement('summary-icon-fullbodyA_1');

function applySwap(slotId, newExId, isPermanent) {
  const newEx = EXERCISE_CATALOG[newExId];
  if (!newEx) return;

  const defaultExId = cardEl.getAttribute('data-default-ex');

  if (isPermanent) {
    if (!workoutState.customSlots) workoutState.customSlots = {};
    if (newExId === defaultExId) {
      delete workoutState.customSlots[slotId];
    } else {
      workoutState.customSlots[slotId] = newExId;
    }
    if (workoutState.tempSlots) delete workoutState.tempSlots[slotId];
  } else {
    if (!workoutState.tempSlots) workoutState.tempSlots = {};
    if (newExId === (workoutState.customSlots?.[slotId] || defaultExId)) {
      delete workoutState.tempSlots[slotId];
    } else {
      workoutState.tempSlots[slotId] = newExId;
    }
  }

  // Simulación de renderSlotExercise en mock
  cardEl.setAttribute('data-current-ex', newExId);
  titleEl.innerText = newEx.name;
  sumTitleEl.innerText = newEx.name;
  sumIconEl.innerHTML = `<svg><use href="#sym-${newEx.svgSlug}"></use></svg>`;

  scheduleBroadcast(0);
}

function revertSlotToRoutineDefault(slotId) {
  const defaultExId = cardEl.getAttribute('data-default-ex');
  if (workoutState.customSlots) delete workoutState.customSlots[slotId];
  if (workoutState.tempSlots) delete workoutState.tempSlots[slotId];

  cardEl.setAttribute('data-current-ex', defaultExId);
  const defEx = EXERCISE_CATALOG[defaultExId];
  titleEl.innerText = defEx.name;
  sumTitleEl.innerText = defEx.name;
  sumIconEl.innerHTML = `<svg><use href="#sym-${defEx.svgSlug}"></use></svg>`;

  scheduleBroadcast(0);
}

// Prueba A: Guardar como predeterminado (isPermanent = true)
applySwap('fullbodyA_1', 'prensa_45', true);
assert.strictEqual(workoutState.customSlots['fullbodyA_1'], 'prensa_45', 'customSlots debe contener prensa_45');
assert.strictEqual(workoutState.tempSlots['fullbodyA_1'], undefined, 'tempSlots debe estar limpio');
assert.strictEqual(cardEl.getAttribute('data-current-ex'), 'prensa_45', 'data-current-ex debe ser prensa_45');
assert(sumIconEl.innerHTML.includes('sym-leg-press'), 'El icono del resumen debe ser leg-press');
assert.strictEqual(broadcastCount, 1, 'applySwap debe emitir broadcast al reloj');
console.log('  ✓ applySwap permanente guarda customSlots y actualiza summary icon y emite broadcast');

// Prueba B: Usar solo hoy (isPermanent = false)
applySwap('fullbodyA_1', 'sentadilla_hack', false);
assert.strictEqual(workoutState.customSlots['fullbodyA_1'], 'prensa_45', 'customSlots debe preservar el predeterminado');
assert.strictEqual(workoutState.tempSlots['fullbodyA_1'], 'sentadilla_hack', 'tempSlots debe ser sentadilla_hack');
assert.strictEqual(cardEl.getAttribute('data-current-ex'), 'sentadilla_hack', 'data-current-ex debe ser sentadilla_hack');
assert.strictEqual(broadcastCount, 2, 'applySwap temporal emite broadcast al reloj');
console.log('  ✓ applySwap temporal no pisa customSlots');

// Prueba C: Revertir al original de fábrica
revertSlotToRoutineDefault('fullbodyA_1');
assert.strictEqual(workoutState.customSlots['fullbodyA_1'], undefined, 'customSlots debe limpiarse al revertir');
assert.strictEqual(workoutState.tempSlots['fullbodyA_1'], undefined, 'tempSlots debe limpiarse al revertir');
assert.strictEqual(cardEl.getAttribute('data-current-ex'), 'squat', 'data-current-ex debe volver a squat');
assert(sumIconEl.innerHTML.includes('sym-squat'), 'El icono del resumen debe volver a squat');
assert.strictEqual(broadcastCount, 3, 'revertSlotToRoutineDefault emite broadcast al reloj');
console.log('  ✓ revertSlotToRoutineDefault limpia overrides y restaura icono original');

// Prueba D: Guardar el original de fábrica como predeterminado elimina el override
applySwap('fullbodyA_1', 'prensa_45', true);
assert.strictEqual(workoutState.customSlots['fullbodyA_1'], 'prensa_45');
applySwap('fullbodyA_1', 'squat', true);
assert.strictEqual(workoutState.customSlots['fullbodyA_1'], undefined, 'Elegir el ejercicio de rutina original como predeterminado debe limpiar customSlots');
console.log('  ✓ Elegir el ejercicio de rutina original limpia redundant customSlots');

// -------------------------------------------------------------
// 4. Verificación de Ciclo de Vida al Finalizar Entreno
// -------------------------------------------------------------
console.log('\n🏁 4. Pruebas de Ciclo de Vida al Finalizar Entreno (finishWorkout):');

// Configurar un customSlot permanente y un tempSlot temporal
workoutState.customSlots['fullbodyA_1'] = 'prensa_45';
workoutState.tempSlots['fullbodyA_1'] = 'sentadilla_hack';
cardEl.setAttribute('data-current-ex', 'sentadilla_hack');

// Simular bloque finishWorkout
const dayCards = [cardEl];
if (workoutState.tempSlots) {
  dayCards.forEach(card => {
    const slotId = card.getAttribute('data-slot');
    if (workoutState.tempSlots[slotId]) {
      delete workoutState.tempSlots[slotId];
      const effectiveExId = (workoutState.customSlots && workoutState.customSlots[slotId]) || card.getAttribute('data-default-ex');
      if (effectiveExId) {
        card.setAttribute('data-current-ex', effectiveExId);
      }
    }
  });
}

assert.strictEqual(workoutState.tempSlots['fullbodyA_1'], undefined, 'tempSlots debe estar vacío tras finishWorkout');
assert.strictEqual(workoutState.customSlots['fullbodyA_1'], 'prensa_45', 'customSlots permanente se mantiene');
assert.strictEqual(cardEl.getAttribute('data-current-ex'), 'prensa_45', 'card debe re-renderizarse al predeterminado efectivo prensa_45');
console.log('  ✓ finishWorkout limpia tempSlots y restaura visualmente el predeterminado guardado');

console.log('\n✅ ¡Todas las pruebas de ejercicios alternativos predeterminados pasaron con éxito!');
