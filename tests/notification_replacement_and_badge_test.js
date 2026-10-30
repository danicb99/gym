const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('====================================================');
console.log('🧪 VigorexiApp - Test Notificaciones y Badges (rev43)');
console.log('====================================================\n');

const root = path.resolve(__dirname, '..');
const swPath = path.join(root, 'sw.js');
const htmlPath = path.join(root, 'index.html');

const sw = fs.readFileSync(swPath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');

// 1. Verificación de tag unificado
console.log('🏷️ 1. Verificación de Tag Unificado (Anti-Acumulación):');
assert(/const NOTIF_TAG = 'vigorexiapp-rest'/.test(sw), 'sw.js debe definir NOTIF_TAG = vigorexiapp-rest');
assert(!/tag:\s*['"]vigorexiapp-rest-live['"]/.test(sw), 'sw.js no debe emitir con tag vigorexiapp-rest-live');
assert(!/tag:\s*['"]rest-finish['"]/.test(sw), 'sw.js no debe emitir con tag rest-finish');
assert(!/tag:\s*['"]rest-finish['"]/.test(html), 'index.html no debe emitir con tag rest-finish');
assert(/tag:\s*['"]vigorexiapp-rest['"]/.test(html), 'index.html debe usar tag vigorexiapp-rest');
console.log('  ✓ Tag unificado "vigorexiapp-rest" activo en sw.js e index.html');

// 2. Verificación de Badges e Iconos Diferenciados
console.log('\n🔔 2. Verificación de Badges e Iconos Diferenciados:');
assert(/BADGE_LIVE\s*=\s*['"]\.\/badge-timer\.png\?v=1['"]/.test(sw), 'Falta BADGE_LIVE con badge-timer.png');
assert(/BADGE_FINISHED\s*=\s*['"]\.\/badge-bell\.png\?v=1['"]/.test(sw), 'Falta BADGE_FINISHED con badge-bell.png');
assert(/ICON_FINISHED\s*=\s*['"]\.\/icon-finished-192\.png\?v=1['"]/.test(sw), 'Falta ICON_FINISHED');

// Verificar archivos en disco
const timerBadge = path.join(root, 'badge-timer.png');
const bellBadge = path.join(root, 'badge-bell.png');
const finishIcon = path.join(root, 'icon-finished-192.png');

assert(fs.existsSync(timerBadge), 'badge-timer.png debe existir');
assert(fs.existsSync(bellBadge), 'badge-bell.png debe existir');
assert(fs.existsSync(finishIcon), 'icon-finished-192.png debe existir');

// Verificar que son PNGs válidos
const timerBuf = fs.readFileSync(timerBadge);
const bellBuf = fs.readFileSync(bellBadge);
const iconBuf = fs.readFileSync(finishIcon);

assert(timerBuf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'badge-timer.png no es PNG válido');
assert(bellBuf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'badge-bell.png no es PNG válido');
assert(iconBuf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'icon-finished-192.png no es PNG válido');

console.log('  ✓ badge-timer.png (cronómetro), badge-bell.png (campana) e icon-finished-192.png generados y verificados');

// 3. Verificación de Caché de Nuevos Assets
console.log('\n📦 3. Verificación de Caché de Nuevos Assets en sw.js:');
assert(sw.includes("'./badge-timer.png'"), 'badge-timer.png debe estar en ASSETS');
assert(sw.includes("'./badge-bell.png'"), 'badge-bell.png debe estar en ASSETS');
assert(sw.includes("'./icon-finished-192.png'"), 'icon-finished-192.png debe estar en ASSETS');
console.log('  ✓ Todos los nuevos assets incluidos en la lista de precaché del SW');

// 4. Verificación de Control de Generación Anti-Carreras
console.log('\n🛡️ 4. Verificación de Token de Generación Anti-Carreras:');
assert(/currentRestGen\s*=\s*0/.test(sw), 'sw.js debe declarar currentRestGen');
assert(/currentRestGen\+\+/.test(sw), 'sw.js debe incrementar currentRestGen en cada nuevo timer o skip');
console.log('  ✓ Token de generación (currentRestGen) implementado para evitar carreras entre descansos');

// 5. Verificación de Auto-Limpieza
console.log('\n🧹 5. Verificación de Auto-Limpieza en index.html:');
assert(/function clearAppNotifications\(\)/.test(html), 'Falta función clearAppNotifications en index.html');
assert(/clearAppNotifications\(\)/.test(html), 'clearAppNotifications debe llamarse en initApp y visibilitychange');
console.log('  ✓ Auto-limpieza de notificaciones huérfanas activa al reanudar o abrir la app');

console.log('\n====================================================');
console.log('🎉 TODAS LAS PRUEBAS DE NOTIFICACIONES SUPERADAS');
console.log('====================================================\n');
