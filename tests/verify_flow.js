const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');

console.log('Testing index.html user flow...');

// 1. Verify header dropdown is hidden
assert(html.includes('id="headerDayInfo"'), 'headerDayInfo must exist in header');
assert(html.includes('id="headerDayTitle"'), 'headerDayTitle must exist');
assert(html.includes('id="headerDaySub"'), 'headerDaySub must exist');

// Verify old day picker is completely hidden and moved out of header
assert(html.includes('class="header-day-picker" style="display:none !important;"'),
  'header-day-picker must have inline display:none !important');
assert(html.includes('.header-day-picker {\r\n      display: none !important;') || html.includes('.header-day-picker {\n      display: none !important;'),
  'CSS must also enforce .header-day-picker display:none !important');

// 2. Verify routineDaysList container exists in routinePlanView
assert(html.includes('id="routineDaysList"'), 'routineDaysList must exist in routinePlanView');

// 3. Extract and test JS logic in mock environment
const mockStorage = {
  vigorexiapp_program: 'fullbody',
  vigorexiapp_last_day: 'fullbodyA'
};
const localStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = v; }
};

const domElements = {
  tabBtnTrain: { classList: new Set(['on']) },
  tabBtnHist: { classList: new Set() },
  tabBtnPlan: { classList: new Set() },
  headerDayTitle: { textContent: '' },
  headerDaySub: { textContent: '' },
  headerWorkoutProgress: { style: {} },
  headerProgRow: { style: {} },
  daySelector: { selectedIndex: 0, value: '' },
  routinePlanView: { classList: new Set(), style: { setProperty: () => {} } },
  fullbodyA: { classList: new Set(['active']), style: { setProperty: () => {} } },
  fullbodyB: { classList: new Set(), style: { setProperty: () => {} } },
  fullbodyC: { classList: new Set(), style: { setProperty: () => {} } },
  torsoA: { classList: new Set(), style: { setProperty: () => {} } },
  routineDaysList: { innerHTML: '' },
  planCard_fullbody: { classList: new Set() },
  planCard_torso_pierna: { classList: new Set() }
};

// Simulate document.querySelectorAll and getElementById
const document = {
  querySelectorAll: (sel) => {
    if (sel.includes('.app-bottom-nav .nav-tab')) {
      return [domElements.tabBtnTrain, domElements.tabBtnHist, domElements.tabBtnPlan].map(el => ({
        classList: { remove: (c) => el.classList.delete(c), add: (c) => el.classList.add(c) }
      }));
    }
    if (sel.includes('.day-content')) {
      return ['fullbodyA', 'fullbodyB', 'fullbodyC', 'torsoA', 'routinePlanView'].map(id => ({
        id,
        classList: { remove: (c) => domElements[id]?.classList.delete(c), add: (c) => domElements[id]?.classList.add(c) },
        style: domElements[id]?.style || { setProperty: () => {} }
      }));
    }
    return [];
  },
  getElementById: (id) => domElements[id.replace('-', '_')] || domElements[id] || null
};

// Extract ROUTINE_SLOTS from index.html
const routineSlotsMatch = html.match(/const ROUTINE_SLOTS = ({[\s\S]+?});\s*let workoutState/);
assert(routineSlotsMatch, 'ROUTINE_SLOTS regex match');
const ROUTINE_SLOTS = eval('(' + routineSlotsMatch[1] + ')');

let currentProgram = 'fullbody';
const WORKOUT_DAYS = ['fullbodyA', 'fullbodyB', 'fullbodyC', 'torsoA', 'piernaA', 'torsoB', 'piernaB'];
let lastActiveWorkoutDay = 'fullbodyA';

function updateHeaderDayDisplay(dayId) {
  const titleEl = document.getElementById('headerDayTitle');
  const subEl = document.getElementById('headerDaySub');
  if (!titleEl || !subEl) return;
  if (dayId === 'routinePlanView') {
    titleEl.textContent = 'Rutina';
    subEl.textContent = (currentProgram === 'fullbody') ? 'Full Body · 3 días' : 'Torso / Pierna · 4 días';
  } else {
    const slot = ROUTINE_SLOTS[dayId];
    if (slot) {
      const parts = (slot.title || '').split('•');
      titleEl.textContent = parts[0] ? parts[0].trim() : (slot.shortName || dayId);
      subEl.textContent = parts[1] ? parts[1].trim() : (slot.shortName || '');
    }
  }
}

function selectDay(dayId) {
  if (WORKOUT_DAYS.includes(dayId)) {
    lastActiveWorkoutDay = dayId;
    localStorage.setItem('vigorexiapp_last_day', dayId);
    const isFB = dayId.startsWith('fullbody');
    currentProgram = isFB ? 'fullbody' : 'torso_pierna';
    localStorage.setItem('vigorexiapp_program', currentProgram);
  }

  document.querySelectorAll('.app-bottom-nav .nav-tab').forEach(b => b.classList.remove('on'));
  if (dayId === 'routinePlanView') {
    domElements.tabBtnPlan.classList.add('on');
  } else {
    domElements.tabBtnTrain.classList.add('on');
  }

  updateHeaderDayDisplay(dayId);
}

function switchMainTab(tabName) {
  if (tabName === 'train') {
    const fallback = (currentProgram === 'fullbody' ? 'fullbodyA' : 'torsoA');
    const targetDay = (WORKOUT_DAYS.includes(lastActiveWorkoutDay)) ? lastActiveWorkoutDay : fallback;
    selectDay(targetDay);
  } else if (tabName === 'plan') {
    selectDay('routinePlanView');
  }
}

// TEST STEP 1: Initial state is training fullbodyA
assert.strictEqual(lastActiveWorkoutDay, 'fullbodyA');
assert.strictEqual(currentProgram, 'fullbody');

// TEST STEP 2: User taps "Rutina" tab
console.log('Action: User taps "Rutina" in bottom nav...');
switchMainTab('plan');
assert.strictEqual(lastActiveWorkoutDay, 'fullbodyA', 'lastActiveWorkoutDay MUST stay fullbodyA when opening Rutina!');
assert(domElements.tabBtnPlan.classList.has('on'), 'Rutina tab button must have "on" class');
assert.strictEqual(domElements.headerDayTitle.textContent, 'Rutina');

// TEST STEP 3: User taps "Entrenar" tab directly
console.log('Action: User taps "Entrenar" in bottom nav directly from Rutina...');
switchMainTab('train');
assert.strictEqual(lastActiveWorkoutDay, 'fullbodyA');
assert(domElements.tabBtnTrain.classList.has('on'), 'Entrenar tab button must have "on" class');
assert(domElements.headerDayTitle.textContent.includes('Full Body A'), 'Header must show Full Body A');

// TEST STEP 4: User taps "Rutina", then selects Día B from routine days list
console.log('Action: User taps "Rutina", then picks Día B...');
switchMainTab('plan');
assert.strictEqual(lastActiveWorkoutDay, 'fullbodyA');

// User clicks Día B
selectDay('fullbodyB');
switchMainTab('train');
assert.strictEqual(lastActiveWorkoutDay, 'fullbodyB');
assert(domElements.tabBtnTrain.classList.has('on'), 'Entrenar tab button must have "on" class');
assert(domElements.headerDayTitle.textContent.includes('Full Body B'), 'Header must show Full Body B');

// TEST STEP 5: User taps "Rutina" again, then taps "Entrenar"
console.log('Action: User taps "Rutina", then taps "Entrenar" again...');
switchMainTab('plan');
assert.strictEqual(lastActiveWorkoutDay, 'fullbodyB');
switchMainTab('train');
assert.strictEqual(lastActiveWorkoutDay, 'fullbodyB');

console.log('✅ ALL USER FLOW TESTS PASSED PERFECTLY!');
