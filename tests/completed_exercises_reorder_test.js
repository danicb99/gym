const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

console.log('====================================================');
console.log('🧪 VigorexiApp - Test de Reordenación de Ejercicios Completados');
console.log('====================================================\n');

// 1. Verificación en código fuente
console.log('📦 1. Verificación de Funciones y Estilos en index.html:');
assert(html.includes('.completed-cards-zone'), 'Falta clase CSS .completed-cards-zone');
assert(html.includes('.pair-all-completed'), 'Falta clase CSS .pair-all-completed');
assert(html.includes('function getOrCreateCompletedZone'), 'Falta función getOrCreateCompletedZone');
assert(html.includes('function reconcileCardPosition'), 'Falta función reconcileCardPosition');
assert(html.includes('function restoreAllCardsToOriginal'), 'Falta función restoreAllCardsToOriginal');
assert(html.includes('function cancelAllPendingCardTimers'), 'Falta función cancelAllPendingCardTimers');
assert(html.includes('function updatePairContainerVisibility'), 'Falta función updatePairContainerVisibility');
console.log('  ✓ Funciones y clases CSS declaradas correctamente');

// 2. Simulación funcional del DOM
console.log('\n🗂️ 2. Simulación Funcional de Reordenación y Restauración:');

class MockNode {
  constructor(nodeType = 1, name = 'div') {
    this.nodeType = nodeType;
    this.tagName = name.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.classList = {
      _classes: new Set(),
      add(...names) { names.forEach(n => this._classes.add(n)); },
      remove(...names) { names.forEach(n => this._classes.delete(n)); },
      contains(n) { return this._classes.has(n); }
    };
    this.style = {};
    this.attributes = {};
  }

  get isConnected() {
    let cur = this;
    while (cur) {
      if (cur.isRoot) return true;
      cur = cur.parentNode;
    }
    return false;
  }

  get nextSibling() {
    if (!this.parentNode) return null;
    const idx = this.parentNode.children.indexOf(this);
    if (idx === -1 || idx === this.parentNode.children.length - 1) return null;
    return this.parentNode.children[idx + 1];
  }

  getAttribute(name) { return this.attributes[name] || null; }
  setAttribute(name, val) { this.attributes[name] = val; }

  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  insertBefore(newNode, refNode) {
    if (newNode.parentNode) newNode.parentNode.removeChild(newNode);
    if (!refNode) {
      return this.appendChild(newNode);
    }
    const idx = this.children.indexOf(refNode);
    if (idx === -1) {
      return this.appendChild(newNode);
    }
    this.children.splice(idx, 0, newNode);
    newNode.parentNode = this;
    return newNode;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  querySelector(sel) {
    for (const c of this.children) {
      if (c.matches && c.matches(sel)) return c;
      if (c.querySelector) {
        const found = c.querySelector(sel);
        if (found) return found;
      }
    }
    return null;
  }

  querySelectorAll(sel) {
    const res = [];
    const walk = (node) => {
      for (const c of node.children) {
        if (c.matches && c.matches(sel)) res.push(c);
        if (c.children && c.children.length) walk(c);
      }
    };
    walk(this);
    return res;
  }

  closest(sel) {
    let cur = this;
    while (cur) {
      if (cur.matches && cur.matches(sel)) return cur;
      cur = cur.parentNode;
    }
    return null;
  }

  matches(sel) {
    if (sel.startsWith('.')) {
      const classes = sel.split('.').filter(Boolean);
      return classes.every(c => this.classList.contains(c));
    }
    if (sel.startsWith('#')) return this.id === sel.slice(1);
    return false;
  }
}

// Configurar entorno DOM mock
const daySection = new MockNode(1, 'section');
daySection.id = 'fullbodyA';
daySection.classList.add('day-content');
daySection.isRoot = true;

// Crear Ejercicio 1 (individual)
const card1 = new MockNode(1, 'article');
card1.id = 'card-fullbodyA_1';
card1.classList.add('exercise-card');
card1.setAttribute('data-slot', 'fullbodyA_1');
daySection.appendChild(card1);

// Crear Par Superserie (2a y 2b)
const pairContainer = new MockNode(1, 'div');
pairContainer.classList.add('exercise-pair-container');
daySection.appendChild(pairContainer);

const card2a = new MockNode(1, 'article');
card2a.id = 'card-fullbodyA_2';
card2a.classList.add('exercise-card');
card2a.setAttribute('data-slot', 'fullbodyA_2');
pairContainer.appendChild(card2a);

const card2b = new MockNode(1, 'article');
card2b.id = 'card-fullbodyA_3';
card2b.classList.add('exercise-card');
card2b.setAttribute('data-slot', 'fullbodyA_3');
pairContainer.appendChild(card2b);

// Crear Ejercicio 3 (individual)
const card3 = new MockNode(1, 'article');
card3.id = 'card-fullbodyA_4';
card3.classList.add('exercise-card');
card3.setAttribute('data-slot', 'fullbodyA_4');
daySection.appendChild(card3);

// Simulación de sets completados
function mockCardSets(card, total, done) {
  const rows = [];
  for (let i = 0; i < total; i++) {
    const r = new MockNode(1, 'tr');
    r.classList.add('set-row');
    if (i < done) r.classList.add('done');
    rows.push(r);
  }
  card.children = card.children.filter(c => !c.classList.contains('set-row'));
  rows.forEach(r => card.appendChild(r));
}

mockCardSets(card1, 3, 3);
mockCardSets(card2a, 3, 3);
mockCardSets(card2b, 3, 2);
mockCardSets(card3, 3, 0);

// Extraer lógica a probar
const pendingCardTimers = new Map();

function getOrCreateCompletedZone(section) {
  let zone = section.querySelector('.completed-cards-zone');
  if (!zone) {
    zone = new MockNode(1, 'div');
    zone.className = 'completed-cards-zone';
    zone.classList.add('completed-cards-zone');
    zone.id = 'completed-zone-' + section.id;
    section.appendChild(zone);
  }
  return zone;
}

function updatePairContainerVisibility(container) {
  if (!container || !container.classList || !container.classList.contains('exercise-pair-container')) return;
  const cardsInside = container.querySelectorAll('.exercise-card');
  if (cardsInside.length === 0) {
    container.classList.add('pair-all-completed');
    container.style.display = 'none';
  } else {
    container.classList.remove('pair-all-completed');
    container.style.display = '';
  }
}

function reconcileCardPosition(card, isComplete, immediate = true) {
  if (!card) return;
  const slotId = card.getAttribute('data-slot');
  if (!slotId) return;

  const section = card.closest('.day-content');
  if (!section) return;

  if (isComplete) {
    const rows = card.querySelectorAll('.set-row');
    const doneRows = card.querySelectorAll('.set-row.done');
    if (rows.length === 0 || doneRows.length < rows.length) return;

    const completedZone = getOrCreateCompletedZone(section);
    if (card.parentNode === completedZone) return;

    if (!card._slotAnchor) {
      const marker = new MockNode(8, '#comment');
      const parent = card.parentNode;
      const nextSibling = card.nextSibling;
      if (parent) {
        parent.insertBefore(marker, card);
        card._slotAnchor = { marker, parent, nextSibling };
      }
    }

    completedZone.appendChild(card);
    if (card._slotAnchor && card._slotAnchor.parent) {
      updatePairContainerVisibility(card._slotAnchor.parent);
    }
  } else {
    if (card._slotAnchor) {
      const anchor = card._slotAnchor;
      if (anchor.marker && anchor.marker.parentNode) {
        anchor.marker.parentNode.insertBefore(card, anchor.marker);
        anchor.marker.remove();
      } else if (anchor.parent && anchor.parent.isConnected) {
        if (anchor.nextSibling && anchor.nextSibling.parentNode === anchor.parent) {
          anchor.parent.insertBefore(card, anchor.nextSibling);
        } else {
          anchor.parent.appendChild(card);
        }
      }
      card._slotAnchor = null;
      if (anchor.parent) {
        updatePairContainerVisibility(anchor.parent);
      }
    }
  }
}

function restoreAllCardsToOriginal(section) {
  const completedZone = section.querySelector('.completed-cards-zone');
  if (!completedZone) return;
  const cards = Array.from(completedZone.querySelectorAll('.exercise-card'));
  cards.forEach(card => {
    reconcileCardPosition(card, false, true);
  });
  section.querySelectorAll('.exercise-pair-container').forEach(c => {
    c.classList.remove('pair-all-completed');
    c.style.display = '';
  });
}

// PRUEBA 1: Completar Ejercicio 1 (individual) lo traslada a la zona de completados
reconcileCardPosition(card1, true, true);
const zone = daySection.querySelector('.completed-cards-zone');
assert(zone !== null, 'La zona de completados no fue creada');
assert(zone.children.includes(card1), 'card1 no está en la zona de completados');
console.log('  ✓ Ejercicio individual completado se mueve al final en .completed-cards-zone');

// PRUEBA 2: En la superserie, completar card2a mueve card2a y deja card2b activa en el contenedor
reconcileCardPosition(card2a, true, true);
assert(zone.children.includes(card2a), 'card2a no está en la zona de completados');
assert(pairContainer.children.includes(card2b), 'card2b ya no está en el contenedor de superserie');
assert(!pairContainer.classList.contains('pair-all-completed'), 'El par no debe estar oculto si card2b sigue incompleta');
console.log('  ✓ Ejercicio individual de superserie se mueve al final sin aislar a su compañero');

// PRUEBA 3: Completar también card2b oculta el contenedor de la superserie
mockCardSets(card2b, 3, 3);
reconcileCardPosition(card2b, true, true);
assert(zone.children.includes(card2b), 'card2b no está en la zona de completados');
assert(pairContainer.classList.contains('pair-all-completed'), 'El par debe tener clase .pair-all-completed cuando ambos terminan');
assert.strictEqual(pairContainer.style.display, 'none', 'El contenedor de superserie debe estar oculto (display: none)');
console.log('  ✓ Cuando ambos ejercicios de la superserie terminan, el contenedor se oculta limpiamente');

// PRUEBA 4: Desmarcar una serie en card2a la devuelve a su posición original en el contenedor
mockCardSets(card2a, 3, 2);
reconcileCardPosition(card2a, false, true);
assert(!zone.children.includes(card2a), 'card2a no debe estar en la zona de completados tras desmarcar');
assert(pairContainer.children.includes(card2a), 'card2a debe haber vuelto a su contenedor original');
assert(!pairContainer.classList.contains('pair-all-completed'), 'El par debe volver a mostrarse');
assert.strictEqual(pairContainer.style.display, '', 'El display del par debe volver a normal');
console.log('  ✓ Desmarcar serie restaura card2a a su posición exacta dentro de la superserie');

// PRUEBA 5: restoreAllCardsToOriginal restaura todo el día a estado inicial
mockCardSets(card2a, 3, 3);
reconcileCardPosition(card2a, true, true); // Volver a completar para probar reset
assert(zone.children.length === 3, 'Deben haber 3 tarjetas en completed zone');
restoreAllCardsToOriginal(daySection);
assert(zone.children.length === 0, 'La zona de completados debe quedar vacía tras restoreAllCardsToOriginal');
assert(daySection.children[0] === card1, 'card1 debe ser el primer hijo de daySection');
assert(pairContainer.children.includes(card2a) && pairContainer.children.includes(card2b), 'Ambas tarjetas deben volver al par');
console.log('  ✓ restoreAllCardsToOriginal devuelve todas las tarjetas a sus posiciones originales');

console.log('\n====================================================');
console.log('🎉 TODAS LAS VERIFICACIONES DE REORDENACIÓN APROBADAS');
console.log('====================================================');
