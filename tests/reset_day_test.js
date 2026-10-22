const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok  ' + name);
  } catch (err) {
    console.error('  FAIL ' + name);
    throw err;
  }
}

function extractBalanced(src, start, open = '{', close = '}') {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let quote = '';
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error('Unbalanced source');
}

function extractFunction(name) {
  const start = html.indexOf('function ' + name);
  assert(start !== -1, 'No se encontro ' + name);
  const brace = html.indexOf('{', start);
  const body = extractBalanced(html, brace);
  return html.slice(start, brace + body.length);
}

function classList(initial = []) {
  const values = new Set(initial);
  return {
    add(...names) { names.forEach(name => values.add(name)); },
    remove(...names) { names.forEach(name => values.delete(name)); },
    contains(name) { return values.has(name); },
    has(name) { return values.has(name); }
  };
}

function createSection(slots) {
  const cards = slots.map(slotId => {
    const rows = [0, 1].map(() => ({ classList: classList(['done']) }));
    const inputs = [
      { className: 'set-input input-kg', value: '100' },
      { className: 'set-input input-reps', value: '8' },
      { className: 'input-warmup-kg', value: '40' }
    ];
    return {
      classList: classList(['exercise-completed', 'manually-expanded', 'collapsed']),
      getAttribute(name) { return name === 'data-slot' ? slotId : null; },
      querySelectorAll(selector) {
        if (selector === '.set-row, .warmup-row') return rows;
        if (selector === '.set-input, .input-warmup-kg, .input-warmup-reps') return inputs;
        return [];
      },
      rows,
      inputs
    };
  });

  return {
    cards,
    querySelectorAll(selector) {
      if (selector === '.exercise-card') return cards;
      return [];
    }
  };
}

function runReset(dayId, options = {}) {
  const calls = [];
  const now = Date.now();
  const slotId = 'fullbodyA_1';
  const section = createSection([slotId]);
  const state = {
    completed: [slotId + '_0', 'fullbodyB_1_0'],
    inputs: {
      [slotId + '_0_kg']: '100',
      'fullbodyB_1_0_kg': '80'
    },
    setTimestamps: {
      [slotId + '_0']: now,
      'fullbodyB_1_0': now
    },
    warmupChecks: {
      [slotId + '_1']: true,
      'fullbodyB_1_1': true
    },
    warmupInputs: {
      [slotId + '_1_kg']: '40',
      'fullbodyB_1_1_kg': '30'
    },
    sessionStartTime: {
      fullbodyA: now - 9 * 60 * 1000,
      fullbodyB: now - 5 * 60 * 1000
    },
    lastActivityTime: {
      fullbodyA: now - 60 * 1000,
      fullbodyB: now - 30 * 1000
    },
    sessionIds: {
      fullbodyA: 'session-a',
      fullbodyB: 'session-b'
    }
  };

  const context = {
    workoutState: state,
    ROUTINE_SLOTS: { fullbodyA: { slots: [{ slotId }] } },
    _hasShown42MinAlert: { fullbodyA: true },
    document: {
      getElementById(id) { return id === 'fullbodyA' ? section : null; }
    },
    resetTimerDock() { calls.push('resetTimerDock'); },
    saveWorkoutState() { calls.push('saveWorkoutState'); },
    scheduleBroadcast() { calls.push('scheduleBroadcast'); },
    broadcastActiveWorkoutToWatch() { calls.push('broadcastActiveWorkoutToWatch'); },
    updateSessionTimerDisplay(id) { calls.push('updateSessionTimerDisplay:' + id); },
    updateProgress() { calls.push('updateProgress'); },
    updateDayExerciseAccordion(id) { calls.push('updateDayExerciseAccordion:' + id); },
    resetSessionPR() { calls.push('resetSessionPR'); },
    resetCoachBubbleState() { calls.push('resetCoachBubbleState'); },
    refreshMascotBadge() { calls.push('refreshMascotBadge'); },
    showToast(message) { calls.push('showToast:' + message); }
  };

  vm.createContext(context);
  vm.runInContext(extractFunction('resetDayWorkout'), context);
  const result = context.resetDayWorkout(dayId);
  return { result, state, section, calls, slotId };
}

test('resetDayWorkout existe y elimina el estado del dia activo', () => {
  const { result, state } = runReset('fullbodyA');

  assert.strictEqual(result, true);
  assert.deepStrictEqual(state.completed, ['fullbodyB_1_0']);
  assert.deepStrictEqual(Object.keys(state.inputs), ['fullbodyB_1_0_kg']);
  assert.deepStrictEqual(Object.keys(state.setTimestamps), ['fullbodyB_1_0']);
  assert.deepStrictEqual(Object.keys(state.warmupChecks), ['fullbodyB_1_1']);
  assert.deepStrictEqual(Object.keys(state.warmupInputs), ['fullbodyB_1_1_kg']);
  assert.strictEqual(state.sessionStartTime.fullbodyA, undefined);
  assert.strictEqual(state.lastActivityTime.fullbodyA, undefined);
  assert.strictEqual(state.sessionIds.fullbodyA, undefined);
  assert.strictEqual(state.sessionStartTime.fullbodyB > 0, true);
  assert.strictEqual(state.sessionIds.fullbodyB, 'session-b');
});

test('resetDayWorkout limpia la UI y refresca los contadores', () => {
  const { section, calls } = runReset('fullbodyA');
  const card = section.cards[0];

  assert.strictEqual(card.classList.contains('exercise-completed'), false);
  assert.strictEqual(card.classList.contains('manually-expanded'), false);
  card.rows.forEach(row => assert.strictEqual(row.classList.contains('done'), false));
  card.inputs.forEach(input => assert.strictEqual(input.value, ''));
  assert.strictEqual(calls.includes('resetTimerDock'), true);
  assert.strictEqual(calls.includes('saveWorkoutState'), true);
  assert.strictEqual(calls.includes('updateProgress'), true);
  assert.strictEqual(calls.includes('updateDayExerciseAccordion:fullbodyA'), true);
  assert.strictEqual(calls.includes('showToast:Series y tiempos de hoy reiniciados'), true);
});

test('resetDayWorkout ignora vistas que no son dias de entreno', () => {
  const { result } = runReset('historialView');
  assert.strictEqual(result, false);
  assert.strictEqual(runReset('routinePlanView').result, false);
  assert.strictEqual(runReset('').result, false);
});

console.log('\nReset Day: ' + passed + '/' + passed + ' OK');
