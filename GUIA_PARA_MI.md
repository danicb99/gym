# Guía Fácil de Sincronización para VigorexiApp

Esta guía está pensada para que puedas poner en marcha y probar la sincronización entre tu móvil y tu reloj Amazfit Active 2 de forma sencilla, paso a paso y sin tecnicismos.

---

## 1. Qué tienes que hacer tú (Paso a Paso)

### Paso 1: Generar tu código secreto en la web
1. Abre VigorexiApp en el navegador de tu móvil o PC.
2. En la parte superior derecha de la cabecera, toca la pequeña **píldora de estado** (donde pone *«Sincronizado»*, *«Sin conexión»* o *«Pendiente»*).
3. Se abrirá la ventana **«Sincronización Reloj»**.
4. Pulsa el botón **🎲 Generar nuevo**. Aparecerá una clave secreta larga de 28 letras y números.
5. Pulsa el botón verde **💾 Guardar** para que tu móvil empiece a usar esta clave.
6. Pulsa el botón gris **📄 Copiar texto listo para config.js**. Este botón te copia al portapapeles todo el texto que necesita tu reloj, listo para pegar.

### Paso 2: Pegar el código en tu reloj
1. En tu ordenador, abre la carpeta del proyecto y ve al archivo:
   `watch/app-side/config.js`
2. Abre ese archivo con cualquier editor de texto (como el Bloc de notas o VS Code).
3. Borra todo lo que tenga dentro y pega lo que acabas de copiar de la web. Te quedará exactamente así (con tu código propio):
   ```javascript
   export const SYNC_CONFIG = {
     SYNC_CODE: 'tu_codigo_secreto_aqui',
     SERVER_URL: 'https://ntfy.sh',
     AUTH_TOKEN: ''
   };
   ```
4. Guarda el archivo (`Ctrl + S`).

### Paso 3: Compilar e instalar en tu reloj
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
5. Abre la app **Zepp** en tu teléfono móvil:
   - Ve a **Perfil** > **Amazfit Active 2** > **Modo Desarrollador**.
   - Toca el botón de **Escanear QR** (arriba a la derecha) y apunta a la pantalla del ordenador.
   - En tu reloj, sal un segundo a la esfera de la hora para que no esté abierta la app.
   - Confirma la instalación en el móvil. ¡Listo! La versión 1.5.0 ya está en tu reloj.

---

## 2. Cómo actualizar la web en tu teléfono móvil

1. Abre la web/PWA de VigorexiApp en tu teléfono.
2. Desliza el dedo hacia abajo en la pantalla para recargar (o cierra la aplicación/pestaña del todo y vuelve a abrirla).
3. Para asegurarte de que ya tienes la versión nueva, toca la píldora de arriba a la derecha: en el título de la ventana debe poner **«VigorexiApp v1.5.0»**.

---

## 3. Las 6 comprobaciones para hacer en el gimnasio

Haz estas pruebas cuando estés entrenando; te confirmarán que todo funciona a la perfección:

1. **Abrir sin entrenar (Tranquilidad total):**
   - *Qué hago:* Abre la app en el móvil y en el reloj sin iniciar entreno.
   - *Qué debería ver:* En el reloj pone la hora o `⏱️ 0m ok`. Ningún aparato gasta datos ni hace peticiones a internet mientras estás descansando.

2. **Completar serie en el reloj:**
   - *Qué hago:* Termina una serie y pulsa el botón verde de completar en el reloj.
   - *Qué debería ver:* En 1 o 2 segundos, la casilla de esa serie se marca en verde automáticamente en la pantalla de tu móvil.

3. **Completar serie en el móvil:**
   - *Qué hago:* Marca una serie como completada tocando la casilla en el móvil.
   - *Qué debería ver:* El reloj recibe la actualización sin parpadear, sin recargar la pantalla y sin borrar los kilos que tengas en pantalla.

4. **Prueba de Modo Avión (sin cobertura Bluetooth ni móvil):**
   - *Qué hago:* Pon el móvil en Modo Avión. Completa 3 series seguidas en el reloj.
   - *Qué debería ver:* El reloj guardará las 3 series en su memoria interna y arriba pondrá `⏱️ Xm pend 3`. Ahora quita el Modo Avión en el móvil: en pocos segundos las 3 series llegarán al móvil y el reloj volverá a poner `⏱️ Xm ok`.

5. **Terminar entreno con móvil bloqueado o en la taquilla:**
   - *Qué hago:* Deja el teléfono bloqueado con la pantalla apagada. En el reloj pulsa "Finalizar Entrenamiento".
   - *Qué debería ver:* Cuando enciendas el móvil (aunque sea horas después al llegar a casa), la sesión se cargará en tu historial sin perderse nada.

6. **Ajuste de peso sin parpadeos:**
   - *Qué hago:* En el reloj, pulsa los botones `+` o `-` para cambiar los kilos o repeticiones de un ejercicio.
   - *Qué debería ver:* Los números cambian al instante, la pantalla no vibra ni se reinicia sola y nunca se borran los kilos que estés escribiendo. Si corriges un peso a la baja (por ejemplo de 82,5 kg a 80 kg), se queda guardado en 80 kg y no se revierte.

---

## 4. Qué mirar si algo falla (Significado de las luces y textos)

### En la barra superior de tu Reloj:
* `ok` (Verde o gris): Todo perfecto y sincronizado con el móvil.
* `pend N` (Ámbar): Tienes N series guardadas en la memoria del reloj esperando a que haya cobertura Bluetooth o internet para enviarse. No te preocupes, están a salvo y no se perderán.
* `sin móvil` (Rojo): El reloj no tiene conexión Bluetooth con la app Zepp del teléfono. Comprueba que el Bluetooth del móvil esté encendido y la app Zepp abierta en segundo plano.

### En la píldora de tu Móvil (arriba a la derecha):
* 🟢 **Sincronizado**: Conexión activa con el servidor y con el reloj.
* 🟡 **Pendiente (N)**: Hay cambios del móvil pendientes de subirse.
* 🟠 **Límite alcanzado**: Se hicieron muchas operaciones seguidas; el sistema espera unos segundos automáticamente y reintenta solo sin perder nada.
* 🔴 **Sin conexión**: El móvil no tiene cobertura o internet. Al volver la cobertura se reconecta solo; también puedes tocar la píldora y pulsar *«Forzar Sync»*.

---

## 5. ⚠️ ADVERTENCIA DE SEGURIDAD MUY IMPORTANTE

* **NUNCA subas a GitHub, ni envíes a nadie, ni publiques los archivos `.zpk` ni `watch/app-side/config.js`**.
* Esos archivos llevan dentro tu clave privada personal. Si alguien los tuviera, podría ver o modificar tus entrenamientos. Por eso ahora están bloqueados en el proyecto y nunca se subirán al repositorio.
