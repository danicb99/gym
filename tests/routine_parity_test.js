const fs = require('fs');
const assert = require('assert');

console.log('====================================================');
console.log('🧪 VigorexiApp - Prueba de Paridad Móvil ↔ Reloj');
console.log('====================================================');

// 1. Extraer ROUTINE_SLOTS de index.html
const indexHtml = fs.readFileSync('index.html', 'utf8');
const indexStart = indexHtml.indexOf('const ROUTINE_SLOTS = ');
assert(indexStart !== -1, 'ROUTINE_SLOTS debe estar definido en index.html');
const indexEnd = indexHtml.indexOf(';', indexStart);
const mobileSlots = JSON.parse(indexHtml.substring(indexStart + 'const ROUTINE_SLOTS = '.length, indexEnd));

// 2. Extraer ROUTINE_SLOTS de watch/utils/routine_data.js
const watchCode = fs.readFileSync('watch/utils/routine_data.js', 'utf8');
const watchMatch = watchCode.match(/export const ROUTINE_SLOTS = (\{[\s\S]+?\n\};)/);
assert(watchMatch, 'ROUTINE_SLOTS debe estar definido en watch/utils/routine_data.js');
const watchSlots = eval('(' + watchMatch[1].replace(/;\s*$/, '') + ')');

console.log('\n📦 1. Verificación de Días y Estructura Global:');
const expectedDays = ['fullbodyA', 'fullbodyB', 'fullbodyC', 'torsoA', 'piernaA', 'torsoB', 'piernaB'];

expectedDays.forEach(dayId => {
  assert(mobileSlots[dayId], `Día ${dayId} debe existir en móvil`);
  assert(watchSlots[dayId], `Día ${dayId} debe existir en reloj`);
  assert.strictEqual(
    mobileSlots[dayId].totalSets,
    watchSlots[dayId].totalSets,
    `totalSets en ${dayId} debe coincidir (móvil: ${mobileSlots[dayId].totalSets}, reloj: ${watchSlots[dayId].totalSets})`
  );
  console.log(`  ✓ ${dayId}: totalSets = ${mobileSlots[dayId].totalSets} idéntico en ambos`);
});

console.log('\n🔍 2. Verificación Exhaustiva de Slots, Series y Emparejamientos:');
let totalSlotsChecked = 0;

expectedDays.forEach(dayId => {
  const mSlots = mobileSlots[dayId].slots;
  const wSlots = watchSlots[dayId].slots;

  assert.strictEqual(mSlots.length, wSlots.length, `Cantidad de slots en ${dayId} debe coincidir`);

  mSlots.forEach((mSlot, idx) => {
    totalSlotsChecked++;
    const wSlot = wSlots[idx];

    // Identificadores y orden
    assert.strictEqual(mSlot.slotId, wSlot.slotId, `slotId en ${dayId}[${idx}] difiere`);
    assert.strictEqual(mSlot.defaultExId, wSlot.defaultExId, `defaultExId en ${mSlot.slotId} difiere`);
    assert.strictEqual(String(mSlot.num), String(wSlot.num), `num en ${mSlot.slotId} difiere`);

    // Series y Repeticiones
    assert.strictEqual(mSlot.sets.length, wSlot.sets.length, `Cantidad de series en ${mSlot.slotId} difiere`);
    mSlot.sets.forEach((s, sIdx) => {
      assert.strictEqual(s[0], wSlot.sets[sIdx][0], `Kg de serie ${sIdx + 1} en ${mSlot.slotId} difiere: ${s[0]} vs ${wSlot.sets[sIdx][0]}`);
      assert.strictEqual(s[1], wSlot.sets[sIdx][1], `Reps de serie ${sIdx + 1} en ${mSlot.slotId} difiere: ${s[1]} vs ${wSlot.sets[sIdx][1]}`);
    });

    // Emparejamientos (Superseries / Biseries)
    if (mSlot.pairSlotId || wSlot.pairSlotId) {
      assert.strictEqual(mSlot.pairSlotId, wSlot.pairSlotId, `pairSlotId en ${mSlot.slotId} difiere`);
      assert.strictEqual(mSlot.pairRole, wSlot.pairRole, `pairRole en ${mSlot.slotId} difiere`);
      assert.strictEqual(mSlot.pairType, wSlot.pairType, `pairType en ${mSlot.slotId} difiere`);
      assert.strictEqual(mSlot.pairRest, wSlot.pairRest, `pairRest en ${mSlot.slotId} difiere`);
    }
  });
  console.log(`  ✓ ${dayId}: ${mSlots.length} slots y emparejamientos 100% idénticos`);
});

console.log(`\n🎉 Total de slots verificados sin ninguna discrepancia: ${totalSlotsChecked}`);
console.log('====================================================');
console.log('✅ PRUEBA DE PARIDAD MÓVIL ↔ RELOJ SUPERADA');
console.log('====================================================');
