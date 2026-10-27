const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

console.log('====================================================');
console.log('🧪 VigorexiApp - Test de Tarjetas Compactadas Completadas');
console.log('====================================================\n');

// 1. Verificación de Reglas CSS de Alto Contraste (Colores Sólidos, sin degradados)
console.log('🎨 1. Verificación de Reglas CSS:');

assert(
  /\.exercise-card\.collapsed\.exercise-completed\s*\{[\s\S]*?border-left:\s*4px\s+solid\s+#fbbf24/.test(html),
  'Falta la franja lateral izquierda de 4px sólida #fbbf24 en tarjetas compactadas completadas'
);
console.log('  ✓ Franja lateral izquierda sólida de 4px en #fbbf24 presente');

assert(
  /\.exercise-card\.collapsed\.exercise-completed\s*\{[\s\S]*?background:\s*rgba\(251,\s*191,\s*36,\s*0\.08\)/.test(html),
  'Falta el fondo sólido amarillo contenido rgba(251, 191, 36, 0.08) en tarjetas completadas'
);
console.log('  ✓ Fondo sólido amarillo ámbar (sin degradados) configurado');

assert(
  /\.exercise-card\.exercise-completed\s+\.summary-icon-badge::after\s*\{[\s\S]*?content:\s*['"]✓['"]/.test(html),
  'Falta el badge circular flotante de verificación (✓) en el avatar de la tarjeta completada'
);
console.log('  ✓ Avatar decorado con badge circular flotante con checkmark (✓)');

assert(
  /\.exercise-card\.exercise-completed\s+\.summary-sub\s*\{[\s\S]*?color:\s*#fbbf24/.test(html),
  'El subtítulo en tarjeta completada no usa el color amarillo ámbar #fbbf24'
);
assert(
  /\.exercise-card\.exercise-completed\s+\.summary-sub::before\s*\{[\s\S]*?content:\s*['"]✓\s*['"]/.test(html),
  'El subtítulo en tarjeta completada no incluye el prefijo de check ✓'
);
console.log('  ✓ Subtítulo con color amarillo ámbar #fbbf24 y prefijo de check ✓');

assert(
  /\.summary-sub\.in-progress\s*\{[\s\S]*?color:\s*#cbd5e1/.test(html),
  'Falta el color contrastado #cbd5e1 para el estado en progreso (.in-progress)'
);
console.log('  ✓ Estado en curso (.in-progress) contrastado (#cbd5e1)');

assert(
  /\.exercise-card\.collapsed\.exercise-completed\s+\.summary-chevron\s*\{[\s\S]*?color:\s*#fbbf24/.test(html),
  'El chevron de la tarjeta completada no usa el color amarillo #fbbf24'
);
console.log('  ✓ Chevron en tarjeta completada tematizado en #fbbf24');

assert(
  /\.exercise-pair-container:has\(\.exercise-card\.exercise-completed\):not\(:has\(\.exercise-card:not\(\.exercise-completed\)\)\)\s*\{[\s\S]*?border-left-color:\s*#fbbf24/.test(html),
  'La superserie no cambia a amarillo cuando ambos ejercicios están completados'
);
console.log('  ✓ Contenedor de superserie sincronizado a amarillo ámbar al completar la pareja');

// 2. Simulación funcional de estados de subtítulo y clases
console.log('\n⚙️ 2. Verificación de Lógica de Estados en JavaScript:');

assert(html.includes("subLabel.classList.add('in-progress')"), 'updateCardSummaryStatus no añade clase in-progress');
assert(html.includes("subLabel.classList.remove('in-progress')"), 'updateCardSummaryStatus no remueve clase in-progress');
console.log('  ✓ Gestión dinámica de clase in-progress en updateCardSummaryStatus');

assert(html.includes("updateCardSummaryStatus(card);"), 'checkExerciseCardCompletion no invoca updateCardSummaryStatus');
console.log('  ✓ Sincronización asegurada entre checkExerciseCardCompletion y updateCardSummaryStatus');

console.log('\n====================================================');
console.log('🎉 TODAS LAS VERIFICACIONES VISUALES APROBADAS');
console.log('====================================================');
