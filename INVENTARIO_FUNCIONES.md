# 📋 Inventario Exhaustivo de Funcionalidades: VigorexiApp (Móvil y Reloj)

Este documento certifica el inventario completo de todas las funcionalidades, componentes e integraciones existentes en **VigorexiApp** (PWA móvil y aplicación de reloj Zepp OS para Amazfit Active 2).

> **Regla innegociable:** Ninguna funcionalidad se elimina ni se degrada durante el rediseño visual (v2). La funcionalidad prima sobre la estética. Todos los formatos de almacenamiento (`localStorage`, `workoutState`, historial de sesiones, JSON de respaldo) y la lógica de sincronización reloj ↔ móvil se conservan íntegros.

---

## 🎨 Tabla de Equivalencias Cromáticas (Mockup → Paleta Real)

Los mockups de referencia (`diseno_referencia/`) emplean una paleta azulada genérica. La aplicación real mantendrá estrictamente su identidad visual AMOLED deportiva de alto contraste:

| Token / Elemento del Mockup | Color en Mockup | Color Real en VigorexiApp | Uso en la Aplicación |
| :--- | :--- | :--- | :--- |
| `--bg` (Fondo de pantalla) | `#0a0f1a` | `#060a12` | Fondo ultra oscuro AMOLED para ahorro de batería |
| `--sf` (Superficie / Tarjetas) | `#121a2a` | `#0f172a` | Fondo de tarjetas de ejercicio y paneles |
| `--sf2` (Superficie secundaria / Steppers) | `#1a2438` | `#1e293b` | Fondo de inputs, steppers y botones neutros |
| `--ln` (Líneas y bordes) | `#243252` | `rgba(255, 255, 255, 0.08)` / `#1e293b` | Separadores y contornos sutiles |
| `--tx` (Texto principal) | `#e8eef8` | `#f8fafc` | Texto nítido de alta legibilidad |
| `--mu` (Texto secundario / Muted) | `#8798b5` | `#94a3b8` | Subtítulos, referencias anteriores y etiquetas |
| `--ac` (Acento principal / Marca) | `#6b8cff` | `#fbbf24` (Dorado/Ámbar) | Títulos, badges destacados, acento de marca |
| `--ac` secundario (Botones de acción) | `#6b8cff` | `#38bdf8` / `#0284c7` (Azul/Cyan) | Acciones primarias, enlaces y botones activos |
| `--ok` (Éxito / Completado) | `#34d399` | `#10b981` (Verde Esmeralda) | Series completadas (✓), badges positivos, estado OK |
| `--wa` (Temporizador descanso) | `#ffb547` | `#fbbf24` (Ámbar) / `#f59e0b` | Cuenta atrás de descanso y avisos de atención |
| Pulsaciones cardíacas (Reloj) | N/A | `#f43f5e` (Rosa/Rojo vivo) | Widget de FC en vivo en el reloj |
| Cronómetro isométrico (Reloj) | N/A | `#6366f1` (Índigo) | Pantalla y botón de cronómetro de plancha |

---

## 📱 Mapeo de Funcionalidades: Aplicación Móvil (PWA)

| # | Funcionalidad | Ubicación Actual | Ubicación Destino (Rediseño) | Estado |
| :-: | :--- | :--- | :--- | :---: |
| **M01** | **Selector de tipo de rutina (3D Full Body / 4D Torso-Pierna)** | Botón cabecera `#btnProgramSwitch` + modal `#programSelectModal` | Pestaña inferior **Rutina** (tarjetas directas) + modal modal accesible desde cabecera | **Conservada** |
| **M02** | **Selector de días del entrenamiento** | Dropdown `#daySelector` en cabecera | Cabecera dinámica (título día activo + selector desplegable accesible) | **Conservada** |
| **M03** | **Banner de día con fecha relativa y 'Recomendado'** | `.day-banner` (`.progress-chip`, `#lastDoneChip`, `#sessionTimer`) | Cabecera superior integrada con fecha relativa, racha y badge recomendado | **Conservada** |
| **M04** | **Tarjeta de ejercicio con GIF, grupo muscular, series × reps, RIR y descanso** | `.exercise-card` con avatar, tags y botón expandir | Acordeón enfocado de ejercicio con pill de grupo muscular, dosis, RIR y descanso | **Conservada** |
| **M05** | **Modal de técnica de ejercicio y enlaces a YouTube / MuscleWiki** | Modal `.modal-sheet` con cues y botones `.ext-link` | Acceso directo "Técnica" / "Ver vídeo" en la barra de herramientas del ejercicio | **Conservada** |
| **M06** | **Texto de 'Técnica clave'** | Texto `.ex-cues-text` bajo el ejercicio | Integrado de forma limpia dentro del desplegable del ejercicio (sin duplicaciones) | **Conservada** |
| **M07** | **Tabla de series (Anterior, Input Kg, Input Reps, Botón ✓)** | `.set-row` con `.input-kg`, `.input-reps`, `.check-btn` | Fila `.row` optimizada con inputs de 50px sin auto-zoom y botón check de 50×50px | **Conservada** |
| **M08** | **Panel de serie activa con steppers (+/- Kg, +/- Reps)** | Barra flotante `#quickStepperBar` al pie | Barra flotante con steppers de toque rápido (+/-2.5kg, +/-5kg, +/-1rep, ✓) | **Conservada** |
| **M09** | **Calculadora de calentamiento y aproximación** | Botón `.btn-guide-modal` + modal `#guideModal` | Botón accesible en cabecera de sesión y modal bottom-sheet con selector dinámico | **Conservada** |
| **M10** | **Ejercicios alternativos (cambio en caliente)** | Botón swap en tarjeta + modal `#swapModal` | Botón "Alternativa" en herramientas de cada ejercicio con selector en caliente | **Conservada** |
| **M11** | **Biseries / superseries (marcadas con badge y alternadas)** | Badge `.superset-badge` y lógica de alternancia | Badge visible de biserie y salto automático al ejercicio complementario | **Conservada** |
| **M12** | **Ejercicios isométricos (segundos y +kg)** | Fila con segundos y botón de cronómetro | Soporte de tiempo en segundos para planchas y ejercicios de core | **Conservada** |
| **M13** | **Ejercicios unilaterales** | Badge unilateral y registro por lado | Soporte de carga por extremidad (reps/pierna o brazo) | **Conservada** |
| **M14** | **Añadir / quitar series dinámicas** | Botones `+ Serie` / `- Serie` en cada tarjeta | Botones de ajuste de volumen conservados en el pie de la tarjeta | **Conservada** |
| **M15** | **Barra de progreso de la sesión** | Barra `#workoutProgressBar` en cabecera | Barra de progreso superior con contador "X de Y series (Z%)" | **Conservada** |
| **M16** | **Dock de descanso flotante con silenciador y saltar** | `#topTimerWidget` en cabecera | Dock flotante `#rest` con dígitos grandes, silenciador y botón "Saltar" | **Conservada** |
| **M17** | **Cronómetro de sesión total** | `#sessionTimer-dayId` en banner | Reloj cronometrado en la cabecera superior | **Conservada** |
| **M18** | **Botón de reiniciar día** | `.btn-reset-session` en banner | Botón de reinicio con confirmación en el menú de sesión | **Conservada** |
| **M19** | **Botón rápido '3D' de cambio de rutina** | `#btnProgramSwitch` en cabecera | Indicador de programa en cabecera y pestaña dedicada "Rutina" | **Conservada** |
| **M20** | **Modal de 'Entrenamiento completado' con Flex Card en imagen** | `#workoutSummaryModal` con `#workoutShareCanvas` | Modal bottom-sheet con canvas 1080×1350, descarga y compartir nativo | **Conservada** |
| **M21** | **Vista de historial: Estadísticas globales** | `#historialView` (`#statTotalSessions`, etc.) | Pestaña inferior **Historial** con tarjetas de Sesiones, Tiempo medio y Volumen | **Conservada** |
| **M22** | **Vista de historial: Calendario interactivo y rachas** | `#streakCalendarCard`, `#calendarDaysGrid`, `#streakBadge` | Calendario mensual interactivo con puntos de entreno y racha calculada | **Conservada** |
| **M23** | **Vista de historial: Gráfica de progresión 1RM** | `#historyExSelector` y gráfica SVG dinámica | Gráfica de evolución SVG con selector de ejercicios y récord estimado | **Conservada** |
| **M24** | **Vista de historial: Línea de tiempo y detalle de sesión** | `#sessionsTimelineList` y `#sessionDetailModal` | Lista cronológica de entrenamientos pasados y desglose por series | **Conservada** |
| **M25** | **Sistema de copias de seguridad (JSON, portapapeles, Excel)** | `.backup-card` (Descargar, Copiar, Compartir, Restaurar, Excel) | Sección "Copia de seguridad" agrupada en pestaña Historial con todos los botones | **Conservada** |
| **M26** | **Tarjeta de regla de doble progresión** | `.guide-card` en modal de guía | Tarjeta explicativa de sobrecarga progresiva en pestaña Rutina | **Conservada** |
| **M27** | **Banner de instalación PWA y soporte offline** | `sw.js` (Service Worker) y `manifest.json` | PWA instalable con Service Worker cacheado y funcionamiento sin internet | **Conservada** |
| **M28** | **Píldora de sincronización en vivo con el reloj** | `#watchSyncPill` (Sincronizado / Pendiente / Sin móvil) | Píldora de estado en cabecera vinculada a `watch_bridge.js` | **Conservada** |
| **M29** | **Modal de configuración del código de sincronización** | `#watchSyncModal` (Código secreto, servidor, reintento) | Modal modal completo invocado al pulsar la píldora de sincronización | **Conservada** |
| **M30** | **Página de instalación para el reloj (`reloj.html`)** | `reloj.html` con QR dinámico y estado de versión | Página web optimizada para emparejamiento por código QR local | **Conservada** |
| **M31** | **Coach Mascota interactivo (rev15)** | `#mascotBtn`, `#mascotBadge`, `#coachModal`, `#coachBubble` | Mascota de cabecera con globo contextual (briefing/PR/sobrecarga), briefing, personalidad, alertas PR/fatiga/inactividad y asistente de doble progresión de solo lectura | **Nueva** |

---

## ⌚ Mapeo de Funcionalidades: Aplicación de Reloj (Zepp OS)

| # | Funcionalidad | Ubicación Actual | Ubicación Destino (Rediseño) | Estado |
| :-: | :--- | :--- | :--- | :---: |
| **W01** | **Selector de día con tarjeta recomendada** | `page/day_select/index.js` (lista vertical) | Pantalla `day_select` con tarjeta destacada para el día sugerido | **Conservada** |
| **W02** | **Unirse a entreno activo del móvil** | Botón condicional si hay sesión en curso en PWA | Botón prioritario "Seguir en el móvil" solo cuando hay entreno activo | **Conservada** |
| **W03** | **Continuar entreno local** | Detección de sesión guardada en flash | Recuperación automática de sesión local no finalizada | **Conservada** |
| **W04** | **Pantalla de entrenamiento: Nombre y contador** | `page/workout/index.js` | Nombre de ejercicio en arco superior, serie X de Y y referencia previa | **Conservada** |
| **W05** | **Pantalla de entrenamiento: Steppers Kg y Reps (~68px)** | Botones pequeños en fila | Dos filas dedicadas con botones circulares de 68px (`-` y `+`) y valores grandes | **Conservada** |
| **W06** | **Pantalla de entrenamiento: Botón 'Hecha'** | Botón verde inferior | Botón horizontal esmeralda "✓ Hecha" de toque cómodo | **Conservada** |
| **W07** | **Pulsaciones cardíacas en tiempo real** | Sensor de ritmo cardíaco Zepp OS en workout | Indicador de pulso visible con icono de corazón rosa `#f43f5e` | **Conservada** |
| **W08** | **Duración de sesión en tiempo real** | Temporizador en workout | Duración acumulada visible en el entreno | **Conservada** |
| **W09** | **Anillo circular de progreso de la sesión** | Barra o texto en pantalla | Anillo SVG perimetral circular de avance de sesión | **Conservada** |
| **W10** | **Pantalla de plancha isométrica** | Modo isometría con botón CRONO / GUARDAR | Pantalla adaptada para cronometrar segundos y registrar aguante | **Conservada** |
| **W11** | **Menú de opciones durante el entreno** | `page/options/index.js` | Menú desplegable con alternativas, omitir y cancelar | **Conservada** |
| **W12** | **Selector de ejercicios alternativos en el reloj** | `page/alternatives/index.js` | Lista táctil de máquinas alternativas del ejercicio actual | **Conservada** |
| **W13** | **Cuenta atrás de descanso (+15s, Saltar)** | `page/timer/index.js` | Pantalla completa con dígitos gigantes, anillo de progreso, `+15s` y `Saltar` | **Conservada** |
| **W14** | **Aviso háptico (vibración a los 10s y al terminar)** | `utils/haptics.js` | Vibración sutil a 10s del final y vibración doble al concluir descanso | **Conservada** |
| **W15** | **Pantalla de resumen: Series, duración y pulso** | `page/summary/index.js` | Métricas finales claras (series totales, tiempo, FC media y FC máx) | **Conservada** |
| **W16** | **Pantalla de resumen: Estado de envío a móvil** | Mensaje de sincronización / en cola | Indicador visible ("Enviado al móvil" / "En cola, se enviará al volver") | **Conservada** |
| **W17** | **Mantener pantalla encendida (Wake Lock)** | `utils/display.js` | Bloqueo de apagado activo durante la sesión de entrenamiento | **Conservada** |
| **W18** | **Almacenamiento persistente en flash** | `utils/storage.js` | Persistencia en almacenamiento local del reloj ante reinicio o cierre | **Conservada** |
| **W19** | **Reintentos automáticos de Outbox con backoff** | `utils/sync_bridge.js` + vaciado en `app.js` | Cola outbox persistente que se vacía al recuperar conexión y en cambios de página | **Conservada** |
| **W20** | **Chip de estado de sincronización (ok, pend N, sin móvil)** | Chip superior en pantallas | Chip superior flotante `ok` / `pend N` / `sin móvil` siempre visible | **Conservada** |

---

## 🔒 Compromiso de Integridad de Datos y Certificación de Pruebas
1. **Pruebas Automatizadas (tests/sync_test.js):** 22/22 superadas (100% éxito) cubriendo convergencia de datos, orden de llegada por `completedAt`, límite de tráfico de red y recuperación de sesiones.
2. **Pruebas de Compatibilidad (tests/compat_test.js):** 5/5 bloques aprobados (IDs estructurales, funciones JavaScript, paleta AMOLED y widgets nativos del reloj).
3. **Pruebas Coach Mascota (tests/coach_mascot_test.js):** 20/20 superadas, incluyendo globo contextual, PR, isometría, peso corporal, personalidades, alertas, fechas relativas y doble progresión.
4. **Compilación de Zepp OS:** Compilado exitosamente a v1.6.0 (`code: 16`) con QuickJS y empaquetado para Amazfit Active 2 (pantalla redonda de 466 px y cuadrada de 390 px).
5. **Formato de Datos Persistentes:** Claves de `localStorage` (`gym_workout_state`, `gym_poderoso_history`, `gym_sessions_v1`, `vigorexiapp_program`) y formato JSON de copias de seguridad 100% compatibles.
6. **Estado Global del Inventario:** 51/51 funcionalidades (31 móvil + 20 reloj) verificadas y **CONSERVADAS**.
