# Guía Fácil de Uso y Sincronización para VigorexiApp (v1.7.1)

Esta guía te explica de forma clara y sin tecnicismos cómo disfrutar de tu nueva **Rutina V2** (más volumen en pecho, cuádriceps y gemelos en 40-46 min), el **Modo Exprés** y cómo actualizar tanto tu móvil como tu reloj Amazfit Active 2.

---

## ⚠️ PASO PREVIO OBLIGATORIO: HAZ UNA COPIA DE SEGURIDAD

Antes de actualizar nada, abre la app en tu móvil y haz una copia de seguridad de tus marcas:
1. Ve a la pestaña **Historial** (abajo en el menú).
2. Toca el botón **Exportar copia de seguridad** (o descargar copia).
3. Guarda el archivo en tu teléfono. Así, pase lo que pase, tu historial de meses de entreno estará 100% a salvo.

---

## 🌟 Novedades de la Versión 1.7.1 (Rutina V2)

1. **⏱️ Sesiones de ~41 minutos (Más músculo en menos tiempo):**
   * Gracias a las **superseries agonista-antagonista** (emparejar pecho con espalda, o hombro con gemelos) y a un **calentamiento más rápido de 2 fases**, ahora metes más series efectivas sin que el entrenamiento se alargue.
   * En el Día A, antes de la banca, tienes **1 serie de aproximación previa** (~60% × 5 reps con 45-60 s de descanso) para aclimatar el pectoral tras la sentadilla.

2. **⚡ Interruptor "Modo Exprés" en el móvil:**
   * En la cabecera de los Días A, B y C tienes el botón **«⚡ Exprés»**.
   * Si un día vas con prisa, actívalo: se ocultan automáticamente los accesorios prescindibles (la biserie de brazos, la plancha y el crunch).
   * Pasarás de ~41 min a **~32-36 min**. Las series que no hagas no alteran tu historial: simplemente no se registran.

3. **⏱️ Duración estimada visible en cada día:**
   * Cada día te muestra una **estimación aproximada** de su duración (ej. `⏱️ ~41 min`, o `⏱️ ~32m (Exprés)`), incluyendo los descansos y ~1 minuto de cambio de máquina entre ejercicios.

4. **💡 Avisos inteligentes según tu ritmo:**
   * **Aviso de 42 minutos:** Cuando el cronómetro de la sesión alcance 42 minutos, verás un aviso discreto: *"Vas por 42 min. Si te falta tiempo, salta crunch, plancha y brazos"*.
   * **Aviso si entrenaste ayer:** Te recuerda dejar 2-3 repeticiones en reserva en pierna y bisagra para no sobrecargar articulaciones ni lumbares.
   * **Aviso si llevas 3 días seguidos:** Te recuerda aflojar en pierna y tomarte mañana como día de descanso.
   * **Aviso si vuelves tras 5 o más días sin entrenar:** Te sugiere empezar con un 5-10% menos de peso para readaptar tendones y evitar agujetas incapacitantes.

5. **🔍 Comprobación de versión en el móvil:**
   * Para asegurarte de que tu móvil cargó la versión nueva, ve a la pestaña **Rutina** (abajo): verás la etiqueta verde **v1.7.1** arriba.

---

## 1. Actualizar tu Teléfono Móvil (PWA)

1. Abre la web/app de VigorexiApp en tu móvil (https://danicb99.github.io/gym/).
2. Desliza con el dedo hacia abajo en la pantalla para recargar (o cierra la aplicación por completo y vuelve a abrirla).
3. Entra en la pestaña **Rutina**: debe poner **v1.7.1**. ¡Tu móvil ya está al día!

---

## 2. Reinstalar la App en tu Reloj Amazfit (OBLIGATORIO)

> [!IMPORTANT]
> **Reinstalar el reloj es OBLIGATORIO tras este cambio.**
> La rutina completa (ejercicios, descansos, superseries y series) está grabada dentro del reloj. Si no lo reinstalas, el reloj seguirá usando la rutina antigua y la sincronización con el móvil no coincidirá.

Sigue estos sencillos pasos desde tu ordenador:

### Paso 1: Abrir la terminal
1. En Windows, pulsa la tecla `Windows`, escribe **PowerShell** y pulsa `Enter`.

### Paso 2: Ir a la carpeta del reloj
Copia y pega este comando en la ventana azul de PowerShell y pulsa `Enter`:
```powershell
cd c:\_DESARROLLO\VIGOREXIAPP_DEV\watch
```

### Paso 3: Generar el código de instalación
Copia y pega este comando y pulsa `Enter`:
```powershell
npx @zeppos/zeus-cli preview
```
*(Espera unos segundos: en la propia ventana de la terminal se dibujará un código QR grande).*

### Paso 4: Escanear con tu móvil
1. En tu teléfono, abre la aplicación **Zepp** (la app oficial de Amazfit).
2. Ve abajo a **Perfil** y toca en tu reloj **Amazfit Active 2**.
3. Baja hasta **Modo Desarrollador**.
4. Toca el botón de **Escanear QR** (arriba a la derecha) y enfoca la cámara a la pantalla del ordenador donde está el QR.
5. **En tu reloj:** sal un segundo a la esfera de la hora (donde se ven las agujas/números del reloj) para que la app no esté abierta.
6. Pulsa **Instalar** en la pantalla del móvil.
7. ¡Listo! En unos segundos la versión **1.7.1** estará instalada en tu muñeca con la nueva rutina idéntica al móvil.

---

## 3. Cómo funcionan las Superseries en el Gimnasio

1. **En el Móvil:**
   * Al completar la serie del primer ejercicio de la pareja (por ejemplo, Press de banca), la app te avisa: *"⚡ Superserie: Sin descanso, pasa directo a Jalón al pecho"*.
   * La pantalla se desliza automáticamente al Jalón al pecho.
   * Al completar la serie del Jalón, **arranca el descanso tras la pareja (90-120 s)**.
2. **En el Reloj:**
   * Igual: marcas la serie de Banca, el reloj pasa a Jalón sin descanso; al marcar Jalón, arranca la cuenta atrás con vibración háptica.
   * En la Serie 1 de Banca, el reloj te recuerda en pantalla: `S1 de 4 • Aprox: ~60% x 5 (45-60s)`.

---

## 4. ¿Qué pasa con el Modo Exprés en el Reloj?

* El botón **«⚡ Exprés»** está en el móvil y oculta visualmente los accesorios para ir directo al grano.
* En el reloj tienes la rutina completa. Si estás haciendo una sesión exprés, en cuanto termines los ejercicios principales simplemente pulsa **"Finalizar entrenamiento"** en el reloj (o terminalo en el móvil, que avisará al reloj de que has terminado).
* Las series no realizadas de los accesorios prescindibles no se guardan ni ensucian nada: tu historial solo registra lo que efectivamente hayas entrenado.

---

## 5. ⚠️ Recordatorio de Seguridad
* **NUNCA subas a GitHub ni compartas `watch/app-side/config.js` ni ningún archivo `.zpk`**, ya que contienen tu clave privada de sincronización.
