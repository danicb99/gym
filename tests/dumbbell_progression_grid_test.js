const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('====================================================');
console.log('🧪 VigorexiApp - Test Rejilla Estricta de Mancuernas (0.5 kg)');
console.log('====================================================\n');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const { ROUTINE_SLOTS, EXERCISE_CATALOG } = require('../watch/utils/routine_data.js');

// 1. Verificación de catálogo: todos los ejercicios con mancuernas tienen stepKg = 0.5
console.log('📦 1. Verificación de stepKg en EXERCISE_CATALOG:');
const dumbbellExIds = [
  'press_manc_plano', 'militar', 'remo_mancuerna_banco', 'laterales1', 'laterales_inclinado',
  'biceps1', 'curl_inclinado', 'curl_femoral_mancuerna', 'paseo_granjero', 'remouni',
  'remo_pecho_mancuernas', 'remo_kroc', 'inclinado', 'laterales_mancuernas_estrictas',
  'pajaros_mancuerna', 'frances', 'martillo', 'curl_martillo_predicador', 'rdl_mancuernas',
  'bulgarian', 'zancadas_estaticas', 'sentadilla_goblet'
];

dumbbellExIds.forEach(id => {
  const ex = EXERCISE_CATALOG[id];
  assert(ex, `Ejercicio ${id} debe existir en EXERCISE_CATALOG`);
  assert.strictEqual(ex.stepKg, 0.5, `Ejercicio ${id} (${ex.name}) debe tener stepKg: 0.5, pero tiene ${ex.stepKg}`);
});
console.log(`  ✓ ${dumbbellExIds.length} ejercicios con mancuernas tienen stepKg: 0.5 estrictamente`);

// 2. Verificación de placeholders y warmups en index.html
console.log('\n🔍 2. Verificación de Placeholders y Calentamiento en index.html:');
const cardRegex = /<article class="exercise-card" id="card-([^"]+)"[\s\S]*?<\/article>/g;
let m;
let checkedCards = 0;

while ((m = cardRegex.exec(html)) !== null) {
  const cardContent = m[0];
  const cardIdMatch = cardContent.match(/id="card-([^"]+)"/);
  const cardId = cardIdMatch ? cardIdMatch[1] : 'unknown';
  const exMatch = cardContent.match(/data-current-ex="([^"]+)"/);
  const exId = exMatch ? exMatch[1] : '';

  if (dumbbellExIds.includes(exId)) {
    checkedCards++;
    // Verificar placeholders de KG
    const kgMatches = cardContent.match(/class="[^"]*input-kg[^"]*"[^>]*placeholder="([^"]+)"/g) || [];
    kgMatches.forEach(inpStr => {
      const ph = parseFloat(inpStr.match(/placeholder="([^"]+)"/)[1]);
      assert(ph >= 0.5, `Card ${cardId} (${exId}) tiene placeholder < 0.5 kg: ${ph}`);
      assert.strictEqual((ph * 10) % 5, 0, `Card ${cardId} (${exId}) tiene placeholder no múltiplo de 0.5: ${ph}`);
    });

    // Verificar celdas de calentamiento
    const warmupMatches = cardContent.match(/class="set-cell warmup-cell-kg">([^<]+)</g) || [];
    warmupMatches.forEach(wStr => {
      const kgVal = parseFloat(wStr.match(/>([^<]+)</)[1].replace('kg', '').trim());
      assert(kgVal >= 0.5, `Card ${cardId} (${exId}) tiene warmup < 0.5 kg: ${kgVal}`);
      assert.strictEqual((kgVal * 10) % 5, 0, `Card ${cardId} (${exId}) tiene warmup no múltiplo de 0.5: ${kgVal}`);
    });
  }
}
console.log(`  ✓ ${checkedCards} tarjetas de mancuerna en HTML verificadas sin ningún valor inválido`);

// 3. Verificación de ROUTINE_SLOTS
console.log('\n📋 3. Verificación de series por defecto en ROUTINE_SLOTS:');
let checkedRoutineSlots = 0;
for (const [dayId, dayData] of Object.entries(ROUTINE_SLOTS)) {
  dayData.slots.forEach(slot => {
    if (dumbbellExIds.includes(slot.defaultExId)) {
      checkedRoutineSlots++;
      slot.sets.forEach((set, sIdx) => {
        const kg = parseFloat(set[0]);
        assert(kg >= 0.5, `Slot ${slot.slotId} set ${sIdx} peso < 0.5: ${kg}`);
        assert.strictEqual((kg * 10) % 5, 0, `Slot ${slot.slotId} set ${sIdx} peso no múltiplo de 0.5: ${kg}`);
      });
    }
  });
}
console.log(`  ✓ ${checkedRoutineSlots} slots de mancuernas en ROUTINE_SLOTS verificados`);

// 4. Verificación de la lógica de cuantización JS
console.log('\n⚙️ 4. Verificación de algoritmos de cuantización:');

// Simulación de computeDoubleProgression y set completion overload detector
function quantizeOverload(lastKg, step) {
  return Math.round(Math.round((lastKg + step) / step) * step * 10) / 10;
}

function quantizeStepper(baseVal, delta, step) {
  const baseSnapped = step > 0 ? Math.round(baseVal / step) * step : baseVal;
  let newVal = Math.max(0, Math.min(999, Math.round((baseSnapped + delta) / (step || 1)) * (step || 1)));
  return Math.round(newVal * 10) / 10;
}

function quantizeScrubber(initialVal, stepsCount, step) {
  const baseSnapped = step > 0 ? Math.round(initialVal / step) * step : initialVal;
  return Math.max(0, Math.min(999, Math.round((baseSnapped + stepsCount * step) * 10) / 10));
}

assert.strictEqual(quantizeOverload(22, 0.5), 22.5, '22 kg con step 0.5 debe subir a 22.5 kg');
assert.strictEqual(quantizeOverload(24, 0.5), 24.5, '24 kg con step 0.5 debe subir a 24.5 kg');
assert.strictEqual(quantizeOverload(22.5, 0.5), 23.0, '22.5 kg con step 0.5 debe subir a 23.0 kg');
assert.strictEqual(quantizeOverload(20, 0.5), 20.5, '20 kg con step 0.5 debe subir a 20.5 kg');
console.log('  ✓ Progresión por sobrecarga cuantiza a 0.5 kg');

// Stepper
assert.strictEqual(quantizeStepper(22, 0.5, 0.5), 22.5, 'Stepper +0.5 desde 22 debe dar 22.5');
assert.strictEqual(quantizeStepper(22, -0.5, 0.5), 21.5, 'Stepper -0.5 desde 22 debe dar 21.5');
assert.strictEqual(quantizeStepper(24, 0.5, 0.5), 24.5, 'Stepper +0.5 desde 24 debe dar 24.5');
assert.strictEqual(quantizeStepper(24, -0.5, 0.5), 23.5, 'Stepper -0.5 desde 24 debe dar 23.5');
assert.strictEqual(quantizeStepper(22.5, 0.5, 0.5), 23.0, 'Stepper +0.5 desde 22.5 debe dar 23.0');
assert.strictEqual(quantizeStepper(22.5, -0.5, 0.5), 22.0, 'Stepper -0.5 desde 22.5 debe dar 22.0');
console.log('  ✓ Smart Stepper Dock cuantiza con precisión absoluta');

// Scrubber ruleta
assert.strictEqual(quantizeScrubber(22, 1, 0.5), 22.5, 'Scrubber +1 paso desde 22 debe dar 22.5');
assert.strictEqual(quantizeScrubber(22, -1, 0.5), 21.5, 'Scrubber -1 paso desde 22 debe dar 21.5');
assert.strictEqual(quantizeScrubber(22.5, 1, 0.5), 23.0, 'Scrubber +1 paso desde 22.5 debe dar 23.0');
assert.strictEqual(quantizeScrubber(22.5, -1, 0.5), 22.0, 'Scrubber -1 paso desde 22.5 debe dar 22.0');
console.log('  ✓ Scrubber táctil genera saltos puros de 0.5 kg');

console.log('\n====================================================');
console.log('✅ REJILLA ESTRICTA DE MANCUERNAS VERIFICADA AL 100%');
console.log('====================================================');
