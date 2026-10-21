# Guía Fácil de Uso y Sincronización para VigorexiApp (v1.8.1)

Esta guía te explica de forma clara y sin tecnicismos cómo disfrutar de tu nueva interfaz **v1.8.1** (cabecera compacta fija, agrupación visual de superseries, series de calentamiento visibles, notas en hojas inferiores y navegación mejorada), además de los pasos para actualizar tu móvil y tu reloj Amazfit Active 2.

---

## ⚠️ PASO PREVIO OBLIGATORIO: HAZ UNA COPIA DE SEGURIDAD

Antes de actualizar nada, abre la app en tu móvil y haz una copia de seguridad de tus marcas:
1. Ve a la pestaña **Historial** (abajo en el menú).
2. Toca el botón **Exportar copia de seguridad** (o descargar copia).
3. Guarda el archivo en tu teléfono. Así, pase lo que pase, tu historial de meses de entreno estará 100% a salvo.

---

## 🌟 Novedades de la Versión 1.8.1 (Rediseño de Interfaz y Contenido)

1. **📌 Cabecera Fija Compacta (<100 px):**
   * Ya no ocupa media pantalla: al hacer scroll, se queda fijada discretamente arriba sin tapar ningún ejercicio.
   * **Selector de día en chip arriba a la derecha:** Toca `[ Día A ▾ ]` para desplegar el selector de días o acceder directamente a la rutina.
   * **Fila de estado completa:** Ves de un vistazo el tiempo transcurrido (`⏱️ 12:45`), las series completadas (`12/23 series · 52%`), el botón de información `[ⓘ]`, el botón `[⚡ Exprés]` y el reinicio `[↺]`.
   * **Barra de progreso horizontal:** Una línea fina que se llena suavemente de izquierda a derecha según completas series.

2. **⚡ Superseries y Biseries Agrupadas:**
   * Ambas tarjetas de la pareja están unificadas dentro de un contenedor violeta con una única etiqueta compacta (`⚡ SUPERSERIE · Sin descanso entre A y B · Descanso 90-120 s tras B`). Se eliminaron todas las etiquetas repetitivas.
   * **Numeración automática y dinámica:** Los ejercicios se numeran como `1`, `2a`, `2b`, `3a`, `3b`, `4a`, `4b`. Si activas el modo Exprés, los ejercicios visibles se renumeran automáticamente sin dejar números saltados.

3. **🔥 Serie 0 de Calentamiento y Aproximación Visible:**
   * En la tabla de cada ejercicio verás una fila previa **"0"** (o **"0a"** y **"0b"** en el primer ejercicio básico) con fondo tenue.
   * Te indica el peso y repeticiones sugeridas (ej: `~50%` o `~75%`).
   * **Toca sobre el número "0"** para abrir la calculadora de calentamiento con los discos exactos pre-cargados.
   * Tienen su casilla para marcar si quieres, pero **NO suman al total de series efectivas** ni ensucian tu historial de récords.

4. **🛠️ Botones de Herramientas y Hojas Inferiores:**
   * Las notas y la técnica ya no roban espacio vertical dentro de la tarjeta: ahora tienes 4 botones limpios:
     `[ Historial ]  [ Alternativas ]  [ Notas ]  [ Técnica ]`
   * **Al pulsar [Notas]:** Se abre una hoja desde abajo con texto amplio y **guardado automático instantáneo**. Si ya tienes una nota guardada para ese ejercicio, el botón muestra un **punto naranja indicador** para que lo sepas sin tener que abrirlo.
   * **Al pulsar [Técnica]:** Se abre una hoja con los puntos biomecánicos clave y acceso a la animación 3D.
   * **Tarjetas compactas (plegadas):** Toda la franja es pulsable y sustituye el texto "Abrir" por una flecha / chevron (`▾`) estilizada que gira al abrirse.

5. **📱 Nueva Barra Inferior y Botón de Temporizador en Vivo:**
   * Abajo tienes 3 accesos rápidos: `[ Entrenar ]  [ Historial ]  [ Temporizador ]`.
   * Mientras un descanso está corriendo, el botón de temporizador te muestra la cuenta atrás en tiempo real con un sutil pulso verde (ej: `⏱️ 0:42`).
   * En la pestaña **Rutina**, tienes arriba un botón directo **‹ Volver a Entrenar** para regresar a la sesión con un solo toque.

---

## 1. Actualizar tu Teléfono Móvil (PWA)

1. Abre la web/app de VigorexiApp en tu móvil (https://danicb99.github.io/gym/).
2. Desliza con el dedo hacia abajo en la pantalla para recargar (o cierra la aplicación por completo y vuelve a abrirla).
3. Entra en la pestaña **Rutina** (desde el chip superior `[ Día ▾ ]` o menú): comprueba que pone la etiqueta verde **v1.8.1** arriba. ¡Tu móvil ya está actualizado!

---

## 2. Reinstalar la App en tu Reloj Amazfit (OBLIGATORIO)

> [!IMPORTANT]
> **Reinstalar el reloj es OBLIGATORIO tras este cambio.**
> La rutina y el emparejamiento están sincronizados con la versión 1.8.1.

Sigue estos sencillos pasos desde tu ordenador:

### Paso 1: Abrir la terminal
En Windows, pulsa la tecla `Windows`, escribe **PowerShell** y pulsa `Enter`.

### Paso 2: Ir a la carpeta del reloj
Copia y pega este comando en PowerShell y pulsa `Enter`:
```powershell
cd c:\_DESARROLLO\VIGOREXIAPP_DEV\watch
```

### Paso 3: Generar el código de instalación
Copia y pega este comando y pulsa `Enter`:
```powershell
npx @zeppos/zeus-cli preview
```
*(Espera unos segundos hasta que aparezca el código QR en la pantalla).*

### Paso 4: Escanear con tu móvil
1. En tu teléfono, abre la aplicación **Zepp** (la app oficial de Amazfit).
2. Ve abajo a **Perfil** y toca en tu reloj **Amazfit Active 2**.
3. Baja hasta **Modo Desarrollador**.
4. Toca el botón de **Escanear QR** (arriba a la derecha) y enfoca la cámara a la pantalla del ordenador.
5. **En tu reloj:** sal a la pantalla principal de la hora para que la app no esté abierta.
6. Pulsa **Instalar** en la pantalla del móvil.
7. ¡Listo! La versión **1.8.1** estará instalada en tu reloj.

---

## 3. Cómo funcionan las Superseries en el Gimnasio

1. **En el Móvil:**
   * Al completar la serie del primer ejercicio de la pareja (por ejemplo, Press de banca), la app te avisa: *"⚡ Superserie: Sin descanso, pasa directo a Jalón al pecho"*.
   * La pantalla se desliza automáticamente al Jalón al pecho.
   * Al completar la serie del Jalón, **arranca el descanso tras la pareja (90-120 s)**.
2. **En el Reloj:**
   * Igual: marcas la serie de Banca, el reloj pasa a Jalón sin descanso; al marcar Jalón, arranca la cuenta atrás con vibración háptica.
