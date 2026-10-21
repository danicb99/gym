# Guía Fácil de Uso y Sincronización para VigorexiApp (v1.7.0)

Esta guía te explica de forma clara y sin tecnicismos cómo disfrutar de tu nueva **Rutina V2** (más volumen en pecho, cuádriceps y gemelos en 40-46 min), el **Modo Exprés** y cómo tener sincronizado tu móvil y tu reloj Amazfit Active 2.

---

## 🌟 Novedades de la Versión 1.7.0 (Rutina V2)

1. **⏱️ Sesiones de 40 a 46 minutos (Más músculo en menos tiempo):**
   * Gracias a las **superseries agonista-antagonista** (emparejar pecho con espalda, o hombro con gemelos) y a un **calentamiento más rápido de 2 fases**, ahora metes más series efectivas sin que el entrenamiento se alargue.

2. **⚡ Interruptor "Modo Exprés" en el móvil:**
   * En la cabecera de los Días A, B y C tienes el botón **«⚡ Exprés»**.
   * Si un día vas pillado de tiempo, actívalo: se ocultan automáticamente los accesorios prescindibles (la biserie de brazos, la plancha y el crunch).
   * Pasarás de 42-43 min a **33-38 min**. Las series que no hagas no ensucian tu historial: simplemente no se registran.

3. **⏱️ Duración estimada visible en cada día:**
   * Cada día te muestra su duración estimada calculada al milímetro (ej. `⏱️ ~42 min`, o `⏱️ ~33m (Exprés)`).

4. **💡 Avisos inteligentes según tu ritmo:**
   * **Aviso de 42 minutos:** Cuando el cronómetro de la sesión alcance 42 minutos, verás un aviso discreto: *"Vas por 42 min. Si te falta tiempo, salta crunch, plancha y brazos"*.
   * **Aviso si entrenaste ayer:** Te recuerda dejar 2-3 repeticiones en reserva en pierna y bisagra para no sobrecargar las lumbares ni las articulaciones.
   * **Aviso si llevas 3 días seguidos:** Te recuerda aflojar en pierna y tomarte mañana como día de descanso.
   * **Aviso si vuelves tras 5 o más días sin entrenar:** Te sugiere empezar con un 5-10% menos de peso para evitar agujetas incapacitantes.

5. **🔄 Rutina idéntica en el móvil y en el reloj:**
   * Ambos dispositivos comparten exactamente los mismos ejercicios, series, descansos y emparejamientos. Si cambias de ejercicio o usas una alternativa (por ejemplo, remo unilateral en vez de polea baja), tu historial y marcas previas ("Anterior") siguen apareciendo intactos.

---

## 1. Qué tienes que hacer tú (Paso a Paso)

### Paso 1: Actualizar la app en tu teléfono móvil (PWA)
1. Abre VigorexiApp en tu teléfono.
2. Desliza con el dedo hacia abajo en la pantalla para recargar (o cierra la app por completo y vuelve a abrirla).
3. Verás que en la cabecera ya aparece el botón **«⚡ Exprés»** y el chip de duración estimada. Tu teléfono ya tiene la versión **v1.7.0**.

### Paso 2: Si necesitas actualizar el código en el reloj (solo si lo reinstalas)
*(Si tu reloj ya tenía sincronización configurada con tu clave secreta en `config.js`, este paso NO hace falta repetirlo).*

1. Abre una ventana de terminal (PowerShell) en tu ordenador.
2. Entra en la carpeta del reloj escribiendo:
   ```powershell
   cd c:\_DESARROLLO\VIGOREXIAPP_DEV\watch
   ```
3. Ejecuta este comando para compilar y generar el código QR de instalación:
   ```powershell
   npx @zeppos/zeus-cli preview
   ```
4. Te saldrá un código QR en la pantalla de la terminal.
5. Abre la app **Zepp** en tu teléfono:
   * Ve a **Perfil** > **Amazfit Active 2** > **Modo Desarrollador**.
   * Toca el botón de **Escanear QR** (arriba a la derecha) y apunta a la pantalla del ordenador.
   * En tu reloj, sal un segundo a la esfera de la hora para que no esté abierta la app.
   * Confirma la instalación. ¡Listo! La versión **1.7.0** estará instalada en tu reloj.

---

## 2. Cómo funcionan las Superseries en el Gimnasio

1. **En el Móvil:**
   * Al completar la serie del primer ejercicio de la pareja (por ejemplo, Press de banca), la app te avisa: *"⚡ Superserie: Sin descanso, pasa directo a Jalón al pecho"*.
   * La pantalla se desliza automáticamente al Jalón al pecho.
   * Al completar la serie del Jalón, **arranca el descanso de la pareja (90-120 s)**.
2. **En el Reloj:**
   * Igual: marcas la serie de Banca, el reloj pasa a Jalón sin descanso; al marcar Jalón, arranca la cuenta atrás con vibración háptica.

---

## 3. Comprobaciones para hacer en el gimnasio

1. **Prueba de Superserie:** Haz la primera serie de Banca y confirma que pasas a Jalón sin descanso, y que el temporizador arranca tras Jalón.
2. **Prueba del Modo Exprés:** Toca «⚡ Exprés» en el móvil. Comprueba que desaparecen bíceps/tríceps (en Día A) y que la duración estimada baja a ~33 min.
3. **Sincronización:** Marca una serie en el reloj o en el móvil; verás que ambos aparatos se actualizan en menos de 2 segundos.
4. **Continuidad de historial:** Comprueba que en la sentadilla, el remo o los gemelos te sigue apareciendo tu marca previa en la etiqueta "Anterior".

---

## 4. ⚠️ Recordatorio de Seguridad
* **NUNCA subas a GitHub ni compartas `watch/app-side/config.js` ni ningún archivo `.zpk`**, ya que contienen tu clave privada de sincronización.
