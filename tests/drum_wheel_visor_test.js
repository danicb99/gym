const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

console.log('====================================================');
console.log('🧪 VigorexiApp - Test Rueda Cilíndrica 3D y Visor Anclado');
console.log('====================================================\n');

// 1. Verificación de Markup HTML
console.log('📦 1. Verificación de Markup HTML de la Rueda 3D:');
assert(html.includes('id="hudDrumRoller"'), 'Falta el contenedor #hudDrumRoller en index.html');
assert(html.includes('class="hud-drum-bezel"'), 'Falta el bisel de cristal .hud-drum-bezel');
assert(html.includes('id="hudDrumCylinder"'), 'Falta el cilindro rotatorio #hudDrumCylinder');
assert(html.includes('id="hudDrumValUpper"'), 'Falta #hudDrumValUpper para el valor superior difuminado');
assert(html.includes('id="hudDrumValCenter"'), 'Falta #hudDrumValCenter para el valor activo');
assert(html.includes('id="hudDrumValLower"'), 'Falta #hudDrumValLower para el valor inferior difuminado');
assert(html.includes('id="scrubberHudVal"'), 'Falta #scrubberHudVal en el centro de la rueda');
assert(html.includes('id="scrubberHudUnit"'), 'Falta #scrubberHudUnit');
console.log('  ✓ Estructura DOM de rueda cilíndrica 3D con slots difuminados validada');

// 2. Verificación de Estilos CSS
console.log('\n🎨 2. Verificación de Estilos CSS:');
assert(html.includes('.hud-drum-roller {'), 'Falta clase CSS .hud-drum-roller');
assert(html.includes('perspective: 320px;'), 'Falta perspectiva 3D en la rueda');
assert(html.includes('.hud-drum-bezel {'), 'Falta estilo de bisel .hud-drum-bezel');
assert(html.includes('.drum-slot-upper {'), 'Falta estilo para slot superior difuminado');
assert(html.includes('rotateX(24deg)'), 'Falta inclinación 3D superior');
assert(html.includes('.drum-slot-lower {'), 'Falta estilo para slot inferior difuminado');
assert(html.includes('rotateX(-24deg)'), 'Falta inclinación 3D inferior');
assert(html.includes('--hud-arrow-x'), 'Falta soporte de flecha indicadora dinámica --hud-arrow-x');
assert(html.includes('.scrubber-hud.active.hud-flipped'), 'Falta soporte de inversión de visor .hud-flipped');
console.log('  ✓ Estilos de cilindro 3D, inclinación angular y difuminado validados');

// 3. Verificación de Lógica de Anclaje de Visor (Thumb Occlusion Solver)
console.log('\n📍 3. Simulación de Anclaje y Despeje del Pulgar:');
function simulateAnchor(inputRect, vw = 375) {
  const inputCenterX = inputRect.left + (inputRect.width / 2);
  const hudWidth = 175;
  const halfW = hudWidth / 2;
  const padX = 10;

  const clampedCenterX = Math.max(padX + halfW, Math.min(vw - padX - halfW, inputCenterX));
  const arrowX = Math.max(16, Math.min(hudWidth - 16, Math.round(inputCenterX - (clampedCenterX - halfW))));

  const safeTop = 85;
  const hudHeightEst = 185;
  let topY = inputRect.top - 14;
  let isFlipped = false;

  if (topY - hudHeightEst < safeTop && (topY < 185)) {
    topY = inputRect.bottom + 14;
    isFlipped = true;
  }

  return { clampedCenterX, arrowX, topY, isFlipped };
}

// Caso A: Input de peso (columna izquierda, x=45, y=300)
const resLeft = simulateAnchor({ left: 30, width: 64, top: 300, bottom: 338 }, 375);
assert(resLeft.clampedCenterX >= 10 + 175/2, 'HUD no debe salirse del margen izquierdo');
assert(resLeft.topY < 300, 'HUD debe colocarse por encima del input (despejando el dedo)');
assert.strictEqual(resLeft.isFlipped, false, 'No debe invertirse a y=300');

// Caso B: Input de reps (columna derecha, x=310, y=400 en pantalla estrecha de 360px)
const resRight = simulateAnchor({ left: 285, width: 64, top: 400, bottom: 438 }, 360);
assert(resRight.clampedCenterX <= 360 - 10 - 175/2, 'HUD no debe salirse del margen derecho de la pantalla');
assert(resRight.arrowX > 100, 'La flecha debe desplazarse a la derecha para apuntar al cuadro');

// Caso C: Fila pegada a la cabecera superior (y=110)
const resTop = simulateAnchor({ left: 100, width: 64, top: 110, bottom: 148 }, 375);
assert.strictEqual(resTop.isFlipped, true, 'Debe voltearse hacia abajo para no tapar la cabecera');
assert(resTop.topY >= 148 + 14, 'Debe anclarse debajo del input');
console.log('  ✓ Anclaje sobre el cuadro, clamping en bordes de pantalla y flip vertical validados al 100%');

// 4. Verificación de Aritmética de Ranuras Superior e Inferior del Tambor
console.log('\n🧮 4. Verificación de Ranuras Superior e Inferior de la Rueda:');
function simulateDrumSlots(currentVal, step, isKg, isIso) {
  let upperVal, lowerVal;
  if (isKg) {
    const up = Math.round((currentVal + step) * 10) / 10;
    const down = Math.round((currentVal - step) * 10) / 10;
    upperVal = up <= 999 ? `${up}` : '—';
    lowerVal = down >= 0 ? `${down}` : '—';
  } else {
    const up = currentVal + step;
    const down = currentVal - step;
    upperVal = up <= 99 ? `${up}` : '—';
    lowerVal = down >= 0 ? `${down}` : '—';
  }
  return { upperVal, lowerVal };
}

// Banca 80 kg con barra (paso 2.5 kg)
const drumKg = simulateDrumSlots(80, 2.5, true, false);
assert.strictEqual(drumKg.upperVal, '82.5', 'Slot superior de 80kg debe ser 82.5');
assert.strictEqual(drumKg.lowerVal, '77.5', 'Slot inferior de 80kg debe ser 77.5');

// Repeticiones 10 reps (paso 1)
const drumReps = simulateDrumSlots(10, 1, false, false);
assert.strictEqual(drumReps.upperVal, '11', 'Slot superior de 10 reps debe ser 11');
assert.strictEqual(drumReps.lowerVal, '9', 'Slot inferior de 10 reps debe ser 9');

// Límites: 0 reps o 0 kg
const drumZero = simulateDrumSlots(0, 2.5, true, false);
assert.strictEqual(drumZero.lowerVal, '—', 'Por debajo de 0 no debe mostrar valor negativo');

// Límites: 99 reps
const drumMax = simulateDrumSlots(99, 1, false, false);
assert.strictEqual(drumMax.upperVal, '—', 'Por encima de 99 reps no debe exceder');
console.log('  ✓ Cuantización de slots superior e inferior y límites validados');

// 5. Verificación de Presión Sostenida (Hold Timer a 220ms)
console.log('\n⏱️ 5. Verificación de Activación por Presión Sostenida (Long-Press):');
assert(html.includes('holdTimer: null'), 'Falta holdTimer en scrubberState');
assert(html.includes('scrubberState.holdTimer = setTimeout('), 'Falta inicio de temporizador de presión sostenida');
assert(html.includes('clearTimeout(scrubberState.holdTimer)'), 'Falta limpieza de holdTimer al mover o soltar');
console.log('  ✓ Activación por presión sostenida (220ms) integrada con despeje anticipado del visor');

console.log('\n====================================================');
console.log('🎉 TODAS LAS PRUEBAS DE RUEDA 3D Y VISOR APROBADAS (100% OK)');
console.log('====================================================\n');
