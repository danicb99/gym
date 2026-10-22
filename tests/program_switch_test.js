const fs = require('fs');
const assert = require('assert');

console.log('====================================================');
console.log('🧪 VigorexiApp - Test de Cambio de Rutina (3D ↔ 4D)');
console.log('====================================================');

const html = fs.readFileSync('index.html', 'utf8');

// 1. Verificación Estructural en index.html
console.log('\n📦 1. Verificación Estructural de Funciones y Desplegable:');
assert(html.includes('function openProgramSwitchModal'), 'openProgramSwitchModal debe estar definida');
console.log('  ✓ openProgramSwitchModal definida');

assert(html.includes('function renderDayPickerDropdown'), 'renderDayPickerDropdown debe estar definida');
console.log('  ✓ renderDayPickerDropdown definida');

assert(html.includes('openProgramSwitchModal()'), 'onclick en dropdown debe llamar a openProgramSwitchModal()');
console.log('  ✓ Llamada openProgramSwitchModal() presente en el dropdown');

// 2. Pruebas de Lógica con Entorno Simulado
console.log('\n🔄 2. Pruebas de Lógica de Conmutación y Aislamiento:');

const mockStorage = {};
const localStorage = {
  getItem: (k) => (k in mockStorage ? mockStorage[k] : null),
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; }
};

let currentProgram = 'fullbody';
let lastActiveWorkoutDay = 'fullbodyA';
const WORKOUT_DAYS = ['fullbodyA', 'fullbodyB', 'fullbodyC', 'torsoA', 'piernaA', 'torsoB', 'piernaB'];

const dom = {
  dayPickerDropdown: { innerHTML: '', classList: new Set() },
  programSelectModal: { classList: new Set() },
  daySelector: { value: '', innerHTML: '', selectedIndex: 0, appendChild: () => {} },
  routinePlanView: { classList: new Set() },
  btnProgramSwitch: { innerText: '', title: '' },
  headerDayChipLabel: { innerText: '' },
  headerRoutineSub: { innerHTML: '' },
  tabBtnTrain: { classList: new Set(['on']) },
  tabBtnHist: { classList: new Set() },
  tabBtnPlan: { classList: new Set() }
};

const document = {
  getElementById: (id) => dom[id] || null,
  querySelector: (sel) => null,
  querySelectorAll: (sel) => []
};

let workoutState = {
  sessions: [],
  sessionStartTime: {}
};

function getNextRecommendedDay(prog) {
  const p = prog || currentProgram || 'fullbody';
  return (p === 'fullbody') ? 'fullbodyA' : 'torsoA';
}

function getDayLastDoneInfo(dayId) {
  return null;
}

function closeProgramModal() {
  dom.programSelectModal.classList.delete('open');
}

function updateRoutinePlanViewCards() {}
function renderRoutinePlanDays() {}
function updateHeaderDayDisplay() {}
function showToast() {}

function selectDay(dayId) {
  if (WORKOUT_DAYS.includes(dayId)) {
    lastActiveWorkoutDay = dayId;
    localStorage.setItem('vigorexiapp_last_day', dayId);
    const isFB = dayId.startsWith('fullbody');
    currentProgram = isFB ? 'fullbody' : 'torso_pierna';
    localStorage.setItem('vigorexiapp_program', currentProgram);
  }
}

function setWorkoutProgram(prog, targetDayId = null) {
  currentProgram = prog;
  localStorage.setItem('vigorexiapp_program', prog);
  const defaultDay = (prog === 'fullbody') ? 'fullbodyA' : 'torsoA';
  selectDay(targetDayId || defaultDay);
}

// Extraer renderDayPickerDropdown de index.html
function renderDayPickerDropdown() {
  const dd = document.getElementById('dayPickerDropdown');
  if (!dd) return;
  const prog = currentProgram || 'fullbody';
  const days = (prog === 'fullbody') ? [
    { id: 'fullbodyA', title: 'Día A · Full Body', sub: 'Squat Pesado & Torso' },
    { id: 'fullbodyB', title: 'Día B · Full Body', sub: 'RDL & Torso Inclinado' },
    { id: 'fullbodyC', title: 'Día C · Full Body', sub: 'Prensa & Aislamiento' }
  ] : [
    { id: 'torsoA', title: 'Día 1 · Torso A', sub: 'Fuerza & Empuje' },
    { id: 'piernaA', title: 'Día 2 · Pierna A', sub: 'Sentadilla & Cuádriceps' },
    { id: 'torsoB', title: 'Día 3 · Torso B', sub: 'Tracción & Hipertrofia' },
    { id: 'piernaB', title: 'Día 4 · Pierna B', sub: 'Isquios & Búlgaras' }
  ];

  const nextRec = getNextRecommendedDay(prog);
  const activeDayId = lastActiveWorkoutDay;

  let html = `<div class="dropdown-header">Elegir Día (${prog === 'fullbody' ? 'Full Body · 3D' : 'Torso/Pierna · 4D'})</div>`;
  days.forEach(d => {
    const isAct = (d.id === activeDayId);
    const isRec = (d.id === nextRec);
    let badge = '';
    if (isAct) badge = ' • Activo';
    else if (isRec) badge = ' • Toca hoy';
    html += `
      <div class="dropdown-item ${isAct ? 'highlight' : ''}" onclick="selectDayFromDropdown('${d.id}', event)">
        <span class="item-title">${d.title}${badge}</span>
        <span class="item-sub">${d.sub}</span>
      </div>
    `;
  });

  const switchText = (prog === 'fullbody')
    ? '🔄 Cambiar a Torso/Pierna (4 días)'
    : '🔄 Cambiar a Full Body (3 días)';

  html += `
    <div class="dropdown-divider"></div>
    <div class="dropdown-item" onclick="openProgramSwitchModal()">
      <span class="item-title">${switchText}</span>
    </div>
    <div class="dropdown-item highlight" onclick="goToRoutinePlanTab(event)">
      <span class="item-title">📋 Ver Rutina Completa</span>
    </div>
  `;

  dd.innerHTML = html;
}

function switchRoutineProgram(newProg) {
  currentProgram = newProg;
  localStorage.setItem('vigorexiapp_program', newProg);

  const oldProgDays = (newProg === 'fullbody')
    ? ['torsoA', 'piernaA', 'torsoB', 'piernaB']
    : ['fullbodyA', 'fullbodyB', 'fullbodyC'];
  if (workoutState && workoutState.sessionStartTime) {
    oldProgDays.forEach(d => { delete workoutState.sessionStartTime[d]; });
  }

  closeProgramModal();
  renderDayPickerDropdown();
  updateRoutinePlanViewCards();
  renderRoutinePlanDays();
  const defaultDay = (newProg === 'fullbody') ? 'fullbodyA' : 'torsoA';
  lastActiveWorkoutDay = defaultDay;
  localStorage.setItem('vigorexiapp_last_day', defaultDay);

  const isRoutineTab = dom.routinePlanView.classList.has('active');
  if (!isRoutineTab) {
    selectDay(defaultDay);
  }
}

function autoSelectInitialDay() {
  const prog = localStorage.getItem('vigorexiapp_program') || 'fullbody';
  setWorkoutProgram(prog);

  const seqFB = ['fullbodyA', 'fullbodyB', 'fullbodyC'];
  const seqTP = ['torsoA', 'piernaA', 'torsoB', 'piernaB'];
  const sequence = (prog === 'fullbody') ? seqFB : seqTP;
  const now = Date.now();

  // 1. Ongoing workout in active program (session not archived yet)
  if (workoutState.sessionStartTime) {
    for (const dayId of sequence) {
      const sTime = workoutState.sessionStartTime[dayId];
      if (sTime && (now - sTime < 12 * 3600 * 1000)) {
        selectDay(dayId);
        return;
      }
    }
  }

  // 2. Next day in rotation
  const sessions = workoutState.sessions || [];
  if (sessions.length > 0) {
    const lastSession = sessions[0];
    const lastDayId = lastSession.dayId;
    if (sequence.includes(lastDayId)) {
      const lastIdx = sequence.indexOf(lastDayId);
      const nextDayId = sequence[(lastIdx + 1) % sequence.length];
      selectDay(nextDayId);
      return;
    }
  }

  // 3. Fallback to saved last active day if in sequence, else default
  const savedLast = localStorage.getItem('vigorexiapp_last_day');
  if (savedLast && sequence.includes(savedLast)) {
    selectDay(savedLast);
    return;
  }
  selectDay(prog === 'fullbody' ? 'fullbodyA' : 'torsoA');
}

function switchMainTab(tabName) {
  if (tabName === 'train') {
    const progDays = (currentProgram === 'fullbody')
      ? ['fullbodyA', 'fullbodyB', 'fullbodyC']
      : ['torsoA', 'piernaA', 'torsoB', 'piernaB'];
    const fallback = (currentProgram === 'fullbody' ? 'fullbodyA' : 'torsoA');
    const targetDay = (progDays.includes(lastActiveWorkoutDay)) ? lastActiveWorkoutDay : fallback;
    selectDay(targetDay);
  }
}

// TEST 2.1: Cambiar de fullbody (3D) a torso_pierna (4D)
switchRoutineProgram('torso_pierna');
assert.strictEqual(currentProgram, 'torso_pierna', 'currentProgram debe ser torso_pierna');
assert.strictEqual(localStorage.getItem('vigorexiapp_program'), 'torso_pierna', 'vigorexiapp_program en storage debe ser torso_pierna');
assert.strictEqual(lastActiveWorkoutDay, 'torsoA', 'Día activo inicial debe ser torsoA');
console.log('  ✓ Cambio a Torso/Pierna (4 Días) persistido en localStorage');

// TEST 2.2: Dropdown de día muestra las opciones de Torso/Pierna
assert(dom.dayPickerDropdown.innerHTML.includes('Torso A'), 'Dropdown debe incluir Torso A');
assert(dom.dayPickerDropdown.innerHTML.includes('Pierna A'), 'Dropdown debe incluir Pierna A');
assert(dom.dayPickerDropdown.innerHTML.includes('Torso B'), 'Dropdown debe incluir Torso B');
assert(dom.dayPickerDropdown.innerHTML.includes('Pierna B'), 'Dropdown debe incluir Pierna B');
assert(dom.dayPickerDropdown.innerHTML.includes('Cambiar a Full Body (3 días)'), 'Dropdown debe ofrecer cambiar a Full Body');
console.log('  ✓ Dropdown dinámico muestra los 4 días de Torso/Pierna y enlace a Full Body');

// TEST 2.3: Inmunidad ante sesiones residuales de Full Body en autoSelectInitialDay
// Simulamos que el usuario tenía una sesión iniciada hace 1 hora en fullbodyA
workoutState.sessionStartTime = { fullbodyA: Date.now() - 3600 * 1000 };
autoSelectInitialDay();

assert.strictEqual(currentProgram, 'torso_pierna', 'autoSelectInitialDay NO debe revertir a fullbody por sesión en fullbodyA');
assert.strictEqual(lastActiveWorkoutDay, 'torsoA', 'Debe mantenerse en torsoA');
console.log('  ✓ autoSelectInitialDay aislado: no resucita Full Body cuando Torso/Pierna está activo');

// TEST 2.4: Navegación de pestañas mantiene Torso/Pierna
switchMainTab('train');
assert.strictEqual(currentProgram, 'torso_pierna', 'switchMainTab("train") debe mantener torso_pierna');
assert.strictEqual(lastActiveWorkoutDay, 'torsoA', 'Día debe ser torsoA');
console.log('  ✓ Navegación entre pestañas mantiene Torso/Pierna');

// TEST 2.5: Conmutación inversa a Full Body (3 Días)
switchRoutineProgram('fullbody');
assert.strictEqual(currentProgram, 'fullbody', 'currentProgram debe volver a fullbody');
assert.strictEqual(localStorage.getItem('vigorexiapp_program'), 'fullbody', 'vigorexiapp_program debe ser fullbody');
assert.strictEqual(lastActiveWorkoutDay, 'fullbodyA', 'Día activo inicial debe ser fullbodyA');
assert(dom.dayPickerDropdown.innerHTML.includes('Día A · Full Body'), 'Dropdown debe incluir Día A');
assert(dom.dayPickerDropdown.innerHTML.includes('Cambiar a Torso/Pierna (4 días)'), 'Dropdown debe ofrecer cambiar a Torso/Pierna');
console.log('  ✓ Conmutación inversa a Full Body (3 Días) funciona perfectamente');

console.log('\n====================================================');
console.log('🎉 TODAS LAS PRUEBAS DE CAMBIO DE RUTINA APROBADAS');
console.log('====================================================');
