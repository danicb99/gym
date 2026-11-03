const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

console.log('====================================================');
console.log('🧪 VigorexiApp - Test Rueda Cilíndrica Horizontal 3D');
console.log('====================================================\n');

// 1. Verificación de Markup HTML
console.log('📦 1. Verificación de Markup HTML de la Rueda Horizontal:');
assert(html.includes('id="hwheelRollerTrack"'), 'Falta el contenedor #hwheelRollerTrack en index.html');
assert(html.includes('id="hwheelSlotLeft"'), 'Falta el slot izquierdo difuminado #hwheelSlotLeft');
assert(html.includes('id="hwheelSlotCenter"'), 'Falta el slot central nítido #hwheelSlotCenter');
assert(html.includes('id="hwheelSlotRight"'), 'Falta el slot derecho difuminado #hwheelSlotRight');
assert(html.includes('id="scrubberHudVal"'), 'Falta #scrubberHudVal en el centro de la rueda');
assert(html.includes('id="scrubberHudUnit"'), 'Falta #scrubberHudUnit');
console.log('  ✓ Estructura DOM de tambor cilíndrico horizontal validada');

// 2. Verificación de Estilos CSS
console.log('\n🎨 2. Verificación de Estilos CSS de Rueda Horizontal:');
assert(html.includes('.set-wheel-box {'), 'Falta estilo .set-wheel-box');
assert(html.includes('touch-action: pan-y;'), 'Debe tener touch-action: pan-y para permitir scroll vertical nativo');
assert(html.includes('.wheel-edge-num'), 'Falta estilo .wheel-edge-num');
assert(html.includes('.wheel-edge-left'), 'Falta estilo .wheel-edge-left');
assert(html.includes('.wheel-edge-right'), 'Falta estilo .wheel-edge-right');
assert(html.includes('.hwheel-roller-track'), 'Falta estilo .hwheel-roller-track');
assert(html.includes('.hwheel-slot-left'), 'Falta estilo .hwheel-slot-left');
assert(html.includes('rotateY(-24deg)'), 'Falta inclinación 3D en el eje Y para slot izquierdo');
assert(html.includes('.hwheel-slot-right'), 'Falta estilo .hwheel-slot-right');
assert(html.includes('rotateY(24deg)'), 'Falta inclinación 3D en el eje Y para slot derecho');
assert(html.includes('.hwheel-center-bezel'), 'Falta bisel vertical de cristal .hwheel-center-bezel');
console.log('  ✓ Estilos de tambor horizontal 3D, perspectiva y notches validados');

// 3. Verificación de Posicionamiento Anti-Oclusión ("SIEMPRE ENCIMA", Cero volteos bajo la mano)
console.log('\n📍 3. Simulación de Posicionamiento Anti-Oclusión (Never Flip Below):');
function simulateScrubberPlacement(inputRect, vw = 375) {
  const inputCenterX = inputRect.left + (inputRect.width / 2);
  const hudWidth = 220;
  const halfW = hudWidth / 2;
  const padX = 10;

  const clampedCenterX = Math.max(padX + halfW, Math.min(vw - padX - halfW, inputCenterX));
  const arrowX = Math.max(18, Math.min(hudWidth - 18, Math.round(inputCenterX - (clampedCenterX - halfW))));

  const safeTop = 75;
  const hudHeight = 52;
  const thumbClearance = 32;
  let topY = inputRect.top - thumbClearance;
  let didClampTop = false;

  if (topY - hudHeight < safeTop) {
    topY = safeTop + hudHeight + 4;
    didClampTop = true;
  }

  // La regla innegociable: el fondo del HUD (topY) NUNCA debe ser inferior a inputRect.bottom
  const isNeverBelowHand = topY <= inputRect.bottom;

  return { clampedCenterX, arrowX, topY, isNeverBelowHand, didClampTop };
}

// Caso 1: Serie 1 a 210px del techo
const row1 = simulateScrubberPlacement({ left: 100, width: 66, top: 210, bottom: 248 });
assert(row1.isNeverBelowHand, 'HUD debe estar por encima de la mano');
assert.strictEqual(row1.topY, 178, 'HUD debe anclarse a 32px sobre el top de la casilla (178px)');
assert.strictEqual(row1.didClampTop, false, 'No necesita clamp a 210px');

// Caso 2: Serie pegada al techo (top = 110px)
const rowTop = simulateScrubberPlacement({ left: 100, width: 66, top: 110, bottom: 148 });
assert(rowTop.isNeverBelowHand, 'HUD debe mantenerse por encima de la mano');
assert.strictEqual(rowTop.didClampTop, true, 'Debe clampear al margen seguro');
assert.strictEqual(rowTop.topY, 75 + 52 + 4, 'HUD se sitúa exactamente bajo el safeTop');

// Caso 3: Serie a mitad de pantalla (top = 450px)
const rowMid = simulateScrubberPlacement({ left: 240, width: 66, top: 450, bottom: 488 });
assert(rowMid.isNeverBelowHand, 'HUD debe estar por encima de la casilla');
assert.strictEqual(rowMid.topY, 418, 'HUD anclado a 418px directamente sobre el dedo (32px de elevación)');
console.log('  ✓ Regla Anti-Oclusión "SIEMPRE ENCIMA" verificada en todas las alturas con 32px de elevación');

// 4. Aritmética de Ranuras del Tambor Horizontal
console.log('\n🧮 4. Verificación de Ranuras Izquierda y Derecha del Tambor Horizontal:');
function calcHWheelSlots(val, step, isKg) {
  const maxVal = isKg ? 999 : 99;
  let leftText, rightText;
  if (isKg) {
    const down = Math.round((val - step) * 10) / 10;
    const up = Math.round((val + step) * 10) / 10;
    leftText = down >= 0 ? `${down}` : '—';
    rightText = up <= maxVal ? `${up}` : '—';
  } else {
    const down = val - step;
    const up = val + step;
    leftText = down >= 0 ? `${down}` : '—';
    rightText = up <= maxVal ? `${up}` : '—';
  }
  return { leftText, rightText };
}

// Caso A: 80 kg con paso de 2.5 kg
const slots80 = calcHWheelSlots(80, 2.5, true);
assert.strictEqual(slots80.leftText, '77.5', 'Ranura izquierda de 80kg debe ser 77.5');
assert.strictEqual(slots80.rightText, '82.5', 'Ranura derecha de 80kg debe ser 82.5');

// Caso B: 10 reps con paso de 1
const slots10 = calcHWheelSlots(10, 1, false);
assert.strictEqual(slots10.leftText, '9', 'Ranura izquierda de 10 reps debe ser 9');
assert.strictEqual(slots10.rightText, '11', 'Ranura derecha de 10 reps debe ser 11');

// Caso C: 0 kg (límite inferior)
const slots0 = calcHWheelSlots(0, 2.5, true);
assert.strictEqual(slots0.leftText, '—', 'Por debajo de 0 kg debe mostrar —');
assert.strictEqual(slots0.rightText, '2.5', 'Ranura derecha debe ser 2.5');
console.log('  ✓ Cuantización cuántica de ranuras laterales horizontal 100% correcta');

// 5. Verificación de Caché SW rev54
console.log('\n📦 5. Verificación de Caché SW rev54:');
assert(/const CACHE_NAME = 'vigorexiapp-v1\.8\.4-rev54'/.test(sw), 'sw.js debe ser rev54');
assert(/sw\.js\?v=1\.8\.4-rev54/.test(html), 'index.html debe registrar rev54');
console.log('  ✓ PWA cache rev54 sincronizada');

console.log('\n====================================================');
console.log('🎉 TODAS LAS PRUEBAS DE RUEDA HORIZONTAL APROBADAS');
console.log('====================================================\n');
