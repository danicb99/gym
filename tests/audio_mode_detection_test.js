const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

console.log('====================================================');
console.log('🧪 VigorexiApp - Test de Detección de Auriculares y Fail-Safe');
console.log('====================================================');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

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
  const re = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(');
  const match = html.match(re);
  assert(match, 'No se encontró ' + name);
  const start = match.index;
  const brace = html.indexOf('{', start);
  const body = extractBalanced(html, brace);
  return html.slice(start, brace + body.length);
}

function extractConst(name) {
  const marker = 'const ' + name + ' = ';
  const start = html.indexOf(marker);
  assert(start !== -1, 'No se encontró const ' + name);
  const end = html.indexOf(';', start);
  return html.slice(start, end + 1);
}

// Configurar sandbox para ejecutar las funciones puras
let storage = {};
let toastMessages = [];
let uiUpdates = 0;

function createAudioSandbox(initialMode = 'silent', mockDevices = []) {
  storage = { vigorexiapp_audio_mode: initialMode };
  toastMessages = [];
  uiUpdates = 0;

  const sandbox = {
    audioMode: initialMode,
    localStorage: {
      getItem: k => storage[k] || null,
      setItem: (k, v) => { storage[k] = String(v); }
    },
    updateAudioModeUI: () => { uiUpdates++; },
    showToast: msg => { toastMessages.push(msg); },
    navigator: {
      mediaDevices: {
        enumerateDevices: async () => mockDevices
      }
    },
    console: console,
    Array: Array,
    String: String
  };

  vm.createContext(sandbox);
  vm.runInContext(extractConst('HEADPHONE_KEYWORDS'), sandbox);
  vm.runInContext(extractFunction('detectHeadphonesFromDevices'), sandbox);
  vm.runInContext(extractFunction('scanAudioDevices'), sandbox);
  return sandbox;
}

// 1. Pruebas de extracción y detección de palabras clave
console.log('\n🎧 1. Pruebas de Detección de Dispositivos por Nombre:');

const ctx1 = createAudioSandbox('silent', []);

const airpods = [{ kind: 'audiooutput', label: 'AirPods Pro de Dani' }];
const res1 = ctx1.detectHeadphonesFromDevices(airpods);
assert.strictEqual(res1.hasHeadphones, true, 'Debe detectar AirPods Pro');
assert.strictEqual(res1.labelsHidden, false, 'Las etiquetas no están ocultas');
console.log('  ✓ Detecta AirPods Pro correctamente');

const sony = [{ kind: 'audiooutput', label: 'Sony WH-1000XM4 Stereo' }];
const resSony = ctx1.detectHeadphonesFromDevices(sony);
assert.strictEqual(resSony.hasHeadphones, true, 'Debe detectar Sony WH-1000XM4');
console.log('  ✓ Detecta Sony WH-1000XM4 (prefijo wh-)');

const buds = [{ kind: 'audioinput', label: 'Galaxy Buds2 Pro Hands-Free AG' }];
const resBuds = ctx1.detectHeadphonesFromDevices(buds);
assert.strictEqual(resBuds.hasHeadphones, true, 'Debe detectar Galaxy Buds2');
console.log('  ✓ Detecta auriculares tipo Buds en entrada/salida');

const spanish = [{ kind: 'audiooutput', label: 'Auriculares Bluetooth estéreo' }];
const resEs = ctx1.detectHeadphonesFromDevices(spanish);
assert.strictEqual(resEs.hasHeadphones, true, 'Debe detectar Auriculares Bluetooth en español');
console.log('  ✓ Detecta "Auriculares Bluetooth" en castellano');

const speakers = [
  { kind: 'audiooutput', label: 'Altavoces (Realtek High Definition Audio)' },
  { kind: 'audioinput', label: 'Micrófono interno' }
];
const resSpk = ctx1.detectHeadphonesFromDevices(speakers);
assert.strictEqual(resSpk.hasHeadphones, false, 'No debe detectar auriculares en altavoces de PC');
assert.strictEqual(resSpk.labelsHidden, false, 'Etiquetas de altavoces visibles');
console.log('  ✓ Descarta altavoces estándar de PC/móvil');

const hidden = [
  { kind: 'audiooutput', label: '' },
  { kind: 'audioinput', label: '' }
];
const resHidden = ctx1.detectHeadphonesFromDevices(hidden);
assert.strictEqual(resHidden.hasHeadphones, false, 'No debe asumir cascos si los labels están vacíos');
assert.strictEqual(resHidden.labelsHidden, true, 'Debe marcar labelsHidden como true');
console.log('  ✓ Respeta sandbox de privacidad cuando las etiquetas están vacías');

// 2. Auto-activación al detectar auriculares
console.log('\n🚀 2. Pruebas de Auto-Activación al Conectar Cascos:');

(async () => {
  const ctxAuto = createAudioSandbox('silent', airpods);
  await ctxAuto.scanAudioDevices('check');
  assert.strictEqual(ctxAuto.audioMode, 'headphones', 'Debe cambiar audioMode a headphones');
  assert.strictEqual(storage.vigorexiapp_audio_mode, 'headphones', 'Debe persistir en localStorage');
  assert.strictEqual(uiUpdates, 1, 'Debe actualizar la UI');
  assert(toastMessages.some(m => m.includes('Auriculares conectados')), 'Debe mostrar toast de conexión');
  console.log('  ✓ Conmuta automáticamente de silencio a modo auriculares con toast y persistencia');

  // 3. Fail-Safe ante desconexión física de hardware
  console.log('\n🔕 3. Pruebas de Fail-Safe de Desconexión (Regla de Oro en Gimnasio):');

  // Usuario estaba en modo auriculares y se apagan los cascos (devicechange sin cascos)
  const ctxDisconnect = createAudioSandbox('headphones', speakers);
  await ctxDisconnect.scanAudioDevices('devicechange');
  assert.strictEqual(ctxDisconnect.audioMode, 'silent', 'Debe conmutar inmediatamente a silent ante devicechange');
  assert.strictEqual(storage.vigorexiapp_audio_mode, 'silent', 'Debe persistir silent en localStorage');
  assert(toastMessages.some(m => m.includes('Auriculares desconectados')), 'Debe avisar de la desconexión');
  console.log('  ✓ Fail-Safe activado: al desconectar cascos vuelve a silencio de inmediato');

  // Si no hay cascos y etiquetas son visibles (altavoces) en escaneo pasivo
  const ctxPass = createAudioSandbox('headphones', speakers);
  await ctxPass.scanAudioDevices('init');
  assert.strictEqual(ctxPass.audioMode, 'silent', 'Reanudar app con solo altavoces visibles regresa a silencio');
  console.log('  ✓ Si solo hay altavoces de PC/móvil visibles, fuerza modo silencioso preventivo');

  // Si labels están ocultos (móvil sin permiso mic) en inicio pasivo
  const ctxMobile = createAudioSandbox('headphones', hidden);
  await ctxMobile.scanAudioDevices('init');
  assert.strictEqual(ctxMobile.audioMode, 'headphones', 'No sobreescribe modo si las etiquetas están ocultas');
  console.log('  ✓ No sobreescribe arbitrariamente en móvil con etiquetas vacías en escaneo pasivo');

  console.log('\n====================================================');
  console.log('🎉 TODAS LAS PRUEBAS DE DETECCIÓN Y FAIL-SAFE APROBADAS');
  console.log('====================================================');
})();
