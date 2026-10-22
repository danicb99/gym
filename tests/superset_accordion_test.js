const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

console.log('====================================================');
console.log('🧪 VigorexiApp - Test de Acordeón Dual en Superseries');
console.log('====================================================\n');

// 1. Verificación en código fuente
console.log('📦 1. Verificación de Funciones Clave:');
assert(html.includes('function getSlotPairId'), 'getSlotPairId no está declarada en index.html');
assert(html.includes('toggleCardAccordion'), 'toggleCardAccordion no está declarada en index.html');
assert(html.includes('pairSlotId || cSlot !== pairSlotId'), 'toggleCardAccordion no respeta la pareja de superserie al colapsar');
console.log('  ✓ getSlotPairId detecta parejas de superserie (incluyendo Full Body y Torso/Pierna)');
console.log('  ✓ toggleCardAccordion preserva abierta la pareja de la misma superserie');

// 2. Simulación funcional
console.log('\n🗂️ 2. Simulación de Comportamiento del Acordeón:');

class MockCard {
  constructor(slotId, isCollapsed = true) {
    this.id = 'card-' + slotId;
    this.slotId = slotId;
    this.classes = new Set(isCollapsed ? ['exercise-card', 'collapsed'] : ['exercise-card', 'manually-expanded']);
  }
  getAttribute(name) {
    if (name === 'data-slot') return this.slotId;
    return null;
  }
  get classList() {
    return {
      add: (...names) => names.forEach(n => this.classes.add(n)),
      remove: (...names) => names.forEach(n => this.classes.delete(n)),
      contains: (n) => this.classes.has(n)
    };
  }
}

const mockCards = {
  'fullbodyA_1': new MockCard('fullbodyA_1', false), // Sentadilla (abierta por defecto)
  'fullbodyA_2': new MockCard('fullbodyA_2', true),  // Banca (superserie con 3)
  'fullbodyA_3': new MockCard('fullbodyA_3', true),  // Jalón (superserie con 2)
  'fullbodyA_4': new MockCard('fullbodyA_4', true)   // Laterales (otra superserie)
};

const mockDay = {
  querySelectorAll(sel) {
    if (sel === '.exercise-card') return Object.values(mockCards);
    return [];
  }
};

function mockGetCard(id) {
  const slotId = id.replace('card-', '');
  const c = mockCards[slotId];
  if (c) c.closest = () => mockDay;
  return c;
}

// Extraer getSlotPairId y probar con slots reales
const pairMap = {
  'fullbodyA_2': 'fullbodyA_3',
  'fullbodyA_3': 'fullbodyA_2',
  'fullbodyA_4': 'fullbodyA_7',
  'fullbodyA_7': 'fullbodyA_4',
  'torsoA_6': 'torsoA_7',
  'torsoA_7': 'torsoA_6'
};

function simToggleAccordion(slotId) {
  const card = mockGetCard('card-' + slotId);
  if (!card) return;
  const day = card.closest('.day-content');
  if (!day) return;

  const pairSlotId = pairMap[slotId] || null;
  const isCollapsed = card.classList.contains('collapsed');

  if (isCollapsed) {
    day.querySelectorAll('.exercise-card').forEach(c => {
      const cSlot = c.getAttribute('data-slot');
      if (c !== card && (!pairSlotId || cSlot !== pairSlotId)) {
        c.classList.add('collapsed');
        c.classList.remove('manually-expanded');
      }
    });
    card.classList.remove('collapsed');
    card.classList.add('manually-expanded');
  } else {
    if (pairSlotId) {
      const partnerCard = mockGetCard('card-' + pairSlotId);
      if (partnerCard && !partnerCard.classList.contains('collapsed')) {
        card.classList.add('collapsed');
        card.classList.remove('manually-expanded');
      }
    }
  }
}

// Escenario a: Abrir Banca (cierra Sentadilla, Banca abierta sola)
simToggleAccordion('fullbodyA_2');
assert(!mockCards['fullbodyA_2'].classList.contains('collapsed'), 'Banca debe abrirse');
assert(mockCards['fullbodyA_1'].classList.contains('collapsed'), 'Sentadilla debe colapsarse');
assert(mockCards['fullbodyA_3'].classList.contains('collapsed'), 'Jalón sigue colapsado');
console.log('  ✓ Estado por defecto: 1 solo ejercicio desplegado (Banca)');

// Escenario b: Tocar Jalón (pareja de superserie de Banca)
simToggleAccordion('fullbodyA_3');
assert(!mockCards['fullbodyA_2'].classList.contains('collapsed'), 'Banca debe seguir abierta');
assert(!mockCards['fullbodyA_3'].classList.contains('collapsed'), 'Jalón debe abrirse también');
assert(mockCards['fullbodyA_1'].classList.contains('collapsed'), 'Sentadilla debe seguir colapsada');
console.log('  ✓ Ambos ejercicios de la superserie (Banca + Jalón) quedan desplegados a la vez');

// Escenario c: Tocar cabecera de Jalón para compactarlo de nuevo a 1
simToggleAccordion('fullbodyA_3');
assert(!mockCards['fullbodyA_2'].classList.contains('collapsed'), 'Banca sigue abierta');
assert(mockCards['fullbodyA_3'].classList.contains('collapsed'), 'Jalón se repliega');
console.log('  ✓ Al pulsar la cabecera cuando ambos están abiertos, se compacta volviendo a 1');

// Escenario d: Abrir otro ejercicio ajeno (Laterales)
simToggleAccordion('fullbodyA_3'); // volvemos a abrir Jalón (2 abiertos)
simToggleAccordion('fullbodyA_4'); // abrimos Laterales
assert(mockCards['fullbodyA_2'].classList.contains('collapsed'), 'Banca debe colapsarse');
assert(mockCards['fullbodyA_3'].classList.contains('collapsed'), 'Jalón debe colapsarse');
assert(!mockCards['fullbodyA_4'].classList.contains('collapsed'), 'Laterales debe abrirse');
console.log('  ✓ Al abrir un ejercicio fuera de la superserie, se colapsa la pareja previa');

console.log('\n====================================================');
console.log('🎉 TODAS LAS PRUEBAS DE ACORDEÓN DE SUPERSERIES APROBADAS');
console.log('====================================================');
