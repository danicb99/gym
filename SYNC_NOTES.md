# VigorexiApp · Notas de Arquitectura y Protocolo de Sincronización

Este documento detalla la arquitectura de sincronización bidireccional entre la **PWA Web de VigorexiApp**, el servicio acompañante (**Zepp App Companion / app-side**) y la aplicación del reloj inteligente (**Amazfit Active 2 / Zepp OS 3.0**).

> [!WARNING]
> **Aviso Crítico de Seguridad (Rotación de Claves):**
> Los binarios `.zpk` y los nombres de topics antiguos fueron expuestos públicamente en versiones anteriores del repositorio. Por seguridad y privacidad estricta de tus entrenamientos, **NO utilices el código de sincronización antiguo**. Debes generar un nuevo código secreto privado (de al menos 24 caracteres alfanuméricos) desde la propia web y copiarlo a tu archivo local `watch/app-side/config.js`. Asimismo, los archivos `.zpk` y `config.js` han sido retirados del repositorio y agregados a `.gitignore` para no volver a exponerse.

---

## 1. Decisiones de Diseño y Justificación

### A. Coalescencia y Eliminación de Polling Periódico (Web y Reloj)
* **Problema anterior:** Tanto la web (`watch_bridge.js`) como el reloj (`watch/page/workout/index.js`) realizaban peticiones HTTP periódicas cada 5 segundos mediante `setInterval`. Esto generaba ~720 peticiones por hora por dispositivo, agotando la cuota diaria de ntfy.sh (~500 mensajes/día) en menos de 45 minutos y provocando bloqueos HTTP 429 permanentes.
* **Solución adoptada:**
  1. En reposo (sin entrenamiento activo), el hash de difusión es constante (`{"active":false}`) y el reloj genera 0 peticiones en segundo plano.
  2. Las actualizaciones desde la web se difunden únicamente tras cambios reales de estado con un **debounce de 1.5 s** y coalescencia mediante `rev` monótono.
  3. El reloj consulta el estado móvil solo bajo demanda: al abrir la pantalla de selección de día (con throttle de 20 s) y al terminar el temporizador de descanso.

### B. Outbox Persistente con Confirmación en el Reloj
* **Problema anterior:** El reloj utilizaba llamadas `call()` ("fire and forget") sin confirmación HTTP ni almacenamiento local. Si el teléfono estaba bloqueado o sin cobertura Bluetooth, las series y finalizaciones se perdían irremediablemente.
* **Solución adoptada:**
  1. Toda serie y finalización se almacena primero en una cola persistente `outbox` dentro de `vigorexiapp_data.json` en la memoria flash del reloj (`@zos/fs`).
  2. El reloj utiliza `context.request` hacia el companion, esperando un código 2xx antes de eliminar el evento de la cola.
  3. Si la llamada falla o recibe un 429, se implementa retroceso exponencial (`[2, 5, 15, 60, 300]` segundos) respetando la cabecera `Retry-After`.

### C. Desempaquetado y Deduplicación Idempotente en la Web
* **Problema anterior:** La web deduplicaba por marca de tiempo (`timestamp`), descartaba eventos con más de 10 minutos de antigüedad (pese a que ntfy retiene 12 horas) y descartaba series si el DOM no tenía la tarjeta abierta.
* **Solución adoptada:**
  1. Todos los mensajes viajan en un sobre `{ v: 1, id, type, ts, src: 'watch', payload }`.
  2. Los IDs de mensajes procesados se persisten en `localStorage` (últimos 500 IDs).
  3. Las series se aplican directamente al objeto en memoria `workoutState` (inputs y completed) y se persisten inmediatamente mediante `persistStateRaw()`, sincronizando el DOM de forma secundaria si el elemento está visible.
  4. Los eventos `WORKOUT_FINISHED` son idempotentes por `sessionId`, evitando duplicados en el historial.
  5. La ventana de recuperación (`catchUpFromWatch`) se amplió a 12 horas usando el cursor `since=<last_ntfy_id>` o `since=12h`.

### D. Fusión No Destructiva de Series (`mergeSessionLoggedSets`)
* **Problema anterior:** El reloj sobrescribía `sessionLoggedSets` al recibir datos móviles y recargaba la página completa con `replace()`, destruyendo las modificaciones de peso o repeticiones en curso.
* **Solución adoptada:**
  1. Módulo puro `watch/utils/merge.js` que une series sin duplicar ni destruir datos locales.
  2. En caso de conflicto de una misma serie, se prioriza la serie completada y el mayor peso o repetición.
  3. Se eliminó cualquier llamada a `replace()` durante el entreno activo.

### E. Privacidad y Aislamiento de Topics
* **Problema anterior:** Los nombres de los topics en ntfy.sh estaban fijos en el código público del repositorio, permitiendo que cualquiera pudiera leer o inyectar entrenamientos ajenos.
* **Solución adoptada:**
  1. Código de sincronización configurable (>=24 caracteres alfanuméricos) en `localStorage` y en `watch/app-side/config.js`.
  2. Derivación determinista mediante hash puro FNV-1a dual (16 hex):
     - `RELAY_PHONE_TO_WATCH = <server>/vigorexi_<hash>_p2w`
     - `RELAY_WATCH_TO_PHONE = <server>/vigorexi_<hash>_w2p`
  3. Soporte para servidor ntfy autoalojado y autenticación `Authorization: Bearer <token>`.
  4. `watch/app-side/config.js` está excluido en `.gitignore`, manteniendo las credenciales privadas fuera del repositorio.

---

## 2. Protocolo de Sincronización

### 2.1 Esquema de Mensajes (Sobre v1)

```json
{
  "v": 1,
  "id": "watch-session-fullbodyA-1710000000000-s-slot1_0",
  "type": "SET_COMPLETED",
  "ts": 1710000000000,
  "src": "watch",
  "payload": {
    "sessionId": "session-fullbodyA-1710000000000",
    "dayId": "fullbodyA",
    "slotId": "slot1",
    "setIndex": 0,
    "kg": 80,
    "reps": 8,
    "completedAt": 1710000000000
  }
}
```

#### Tipos de Mensajes Soportados:
1. `SET_COMPLETED`: Serie realizada (reloj ➔ web o web ➔ reloj).
2. `WORKOUT_FINISHED`: Sesión finalizada con resumen de ejercicios y duración.
3. `STATE_SNAPSHOT`: Instantánea completa del entrenamiento emitida por la web.

### 2.2 Formato de Topics Derivados

Para un código secreto `SYNC_CODE` (ejemplo: `danicb99_super_secret_code_12345678`):
* Hash calculado: `e8f49a37bc10d29e`
* Topic Web ➔ Reloj: `https://ntfy.sh/vigorexi_e8f49a37bc10d29e_p2w`
* Topic Reloj ➔ Web: `https://ntfy.sh/vigorexi_e8f49a37bc10d29e_w2p`

### 2.3 Flujo de Confirmación y Reintentos (Outbox Flow)

```
[Amazfit Active 2]                  [Zepp Companion (app-side)]           [ntfy.sh]
       |                                       |                              |
       |-- 1. enqueueOutbox(event)             |                              |
       |-- 2. context.request(SET_COMPLETED) ->|                              |
       |                                       |-- 3. fetch(POST, topic) ---->|
       |                                       |                              |
       |                                       |<-- 4. HTTP 200 OK -----------|
       |<-- 5. res(null, { ok: true, id }) ----|                              |
       |-- 6. removeFromOutbox(id)             |                              |
       |                                       |                              |
 (Si HTTP 429 / Error)                         |                              |
       |                                       |<-- 4b. HTTP 429 (Retry-After)|
       |<-- 5b. res(null, { ok: false, retry })|                              |
       |-- 6b. programar reintento (backoff)   |                              |
```

---

## 3. Matriz de Resolución de Problemas

| Código | Ubicación | Problema Original | Estado | Solución Implementada |
|---|---|---|---|---|
| **W1** | `watch_bridge.js` | `sessionStartTime` Date.now() en hash causaba POSTs cada 5 s en reposo (~720 req/h) | ✅ Resuelto | Hash constante en reposo (`{"active":false}`); 0 peticiones sin entreno activo. |
| **W2** | `watch_bridge.js` | Fetch no comprobaba `resp.ok` (429 fallaba en silencio) | ✅ Resuelto | Comprobación estricta de `resp.ok` y lectura de `Retry-After` para 429. |
| **W3** | `watch_bridge.js` | `lastBroadcastHash` se guardaba antes del POST y no reintentaba si fallaba | ✅ Resuelto | Hash se guarda únicamente tras confirmación 2xx del relay. Reintento con backoff. |
| **W4** | `watch_bridge.js` | Fallback falso a `torsoA`/`fullbodyA` cuando no había entreno activo | ✅ Resuelto | Detección limpia de entreno activo; `activeDayId: null` cuando no hay sesión. |
| **W5** | `watch_bridge.js` | Ventana de catch-up de 10 min descartaba finalizaciones archivadas en ntfy (12 h) | ✅ Resuelto | Ventana de 12 horas con cursor `since=<last_ntfy_id>` o `since=12h`. |
| **W6** | `watch_bridge.js` | Deduplicación por timestamp marcaba como visto antes de procesar y fallaba si la tarjeta no estaba en DOM | ✅ Resuelto | Deduplicación por ID de mensaje tras procesar; aplicación directa a `workoutState`. |
| **W7** | `watch_bridge.js` | Deduplicación de fin de entreno por día + ventana 60s en vez de sessionId | ✅ Resuelto | Deduplicación idempotente por `sessionId` dentro de `workoutState.sessions`. |
| **W8** | `watch_bridge.js` | Topics de ntfy públicos escritos en el código fuente | ✅ Resuelto | Derivación determinista basada en código privado (`SYNC_CODE >= 24 chars`). |
| **W9** | `watch_bridge.js` | Pill de estado solo reflejaba estado del SSE y no estado real de sincronización | ✅ Resuelto | Pill con 4 estados reales (`Sincronizado`, `Pendiente`, `Sin conexión`, `Límite alcanzado`) y modal interactivo. |
| **A1** | `app-side/index.js`| `SET_COMPLETED` dispara y olvida, sin comprobar HTTP y alterando timestamps | ✅ Resuelto | `onRequest` con verificación HTTP 2xx, respuesta estructurada y timestamps preservados. |
| **A2** | `app-side/index.js`| `WORKOUT_FINISHED` devolvía `{ status: 'OK' }` aunque ntfy fallara | ✅ Resuelto | Respuesta basada en el estado HTTP real (2xx ok / 429 backoff / 500 error). |
| **A3** | `app-side/index.js`| `GET_PHONE_SESSION` aceptaba sesiones viejas de hasta 480 min sin verificar HTTP | ✅ Resuelto | Verificación de código HTTP 2xx y descarte de snapshots con más de 180 min. |
| **A4** | `app-side/index.js`| Topics hardcodeados idéntico a W8 | ✅ Resuelto | Carga de `config.js` local (ignorado en git) y derivación determinista de topics. |
| **H1** | `workout/index.js` | Ticker de 5s invocaba `checkPhoneLiveSession()` saturando cuotas | ✅ Resuelto | Eliminado el ticker periódico; consulta exclusivamente bajo demanda. |
| **H2** | `watch/app.js` | Series y finalizaciones enviadas sin cola ni confirmación ni marca synced | ✅ Resuelto | Outbox persistente en flash con confirmación y marca `synced: true/false`. |
| **H3** | `workout/index.js` | `adoptPhoneSession` sobrescribía datos y hacía `replace()` en plena edición | ✅ Resuelto | Fusión no destructiva `mergeSessionLoggedSets` y eliminación total de `replace()`. |
| **H4** | `day_select/index.js`| "Unirse a ..." se mostraba con cualquier mensaje viejo y recomendaba con historial local | ✅ Resuelto | Verificación de `workoutActive === true` y edad <= 180 min antes de mostrar "Unirse". |

---

## 4. Guía para Configurar y Probar en Reloj Físico

### 4.1 Configuración del Código Privado

1. **En la PWA Web:**
   * Toca en la píldora de sincronización en la cabecera (arriba a la derecha).
   * Se abrirá el modal de **Sincronización Reloj**.
   * Pulsa el botón **🎲 Generar nuevo** para obtener una clave segura de 28 caracteres (o introduce tu propia clave).
   * Pulsa **💾 Guardar**.
   * Pulsa **📋 Copiar** para copiar el código al portapapeles.

2. **En el Código de la App Zepp (Companion):**
   * Abre o crea el archivo `watch/app-side/config.js` (puedes duplicar `config.example.js`).
   * Pega tu código en `SYNC_CODE`:
     ```javascript
     export const SYNC_CONFIG = {
       SYNC_CODE: 'pega_aqui_tu_codigo_secreto_de_28_caracteres',
       SERVER_URL: 'https://ntfy.sh',
       AUTH_TOKEN: ''
     }
     ```
   * Guarda el archivo. Este archivo está en `.gitignore`, por lo que nunca se subirá a GitHub.

### 4.2 Indicadores de Estado Visibles

#### En la PWA Web (Cabecera):
* 🟢 **Sincronizado**: Conexión activa, último evento emitido o recibido hace < 60 segundos.
* 🟡 **Pendiente (N)**: Cambios locales guardados en cola a la espera de ser emitidos.
* 🟠 **Límite alcanzado (Xs)**: Rate-limit de ntfy.sh alcanzado (429); cuenta atrás automática para el reintento.
* 🔴 **Sin conexión**: Canal SSE desconectado; la app reintenta reconectar en segundo plano.

#### En el Amazfit Active 2 (Barra Superior del Entrenamiento):
* `⏱️ 14m ok` (Verde o gris): Todo sincronizado, outbox vacía y conexión BLE activa.
* `⏱️ 14m pend 2` (Ámbar): 2 series completadas pendientes de confirmación por el móvil.
* `⏱️ 14m sin móvil` (Rojo): La app Zepp del móvil no responde o está fuera del alcance Bluetooth.

---

## 5. Ejecución de la Suite de Pruebas

Para validar toda la lógica de sincronización y los 8 escenarios de aceptación sin necesidad de hardware:

```bash
node tests/sync_test.js
```

Resultado esperado:
```
====================================================
🧪 VigorexiApp - Suite de Pruebas de Sincronización
====================================================

📦 Bloque 1: Pruebas de Funciones Puras
  ✓ mergeSessionLoggedSets: maneja entradas nulas o vacías
  ✓ mergeSessionLoggedSets: fusiona series sin duplicados y respeta mayor repetición/peso
  ✓ countCompletedSets: cuenta exactamente las series completadas
  ✓ unboxWatchMessage: desempaqueta sobres v1 estándar
  ✓ unboxWatchMessage: compatibilidad retroactiva con formato legacy y deriva id determinista
  ✓ computeBroadcastHash: hash constante en reposo y sensible a cambios de entreno

🚀 Bloque 2: Escenarios de Aceptación (a - h)
  ✓ Escenario a) Sesión iniciada en móvil, continuada en reloj
  ✓ Escenario b) Móvil apagado/sin cobertura: encolado en outbox y retransmisión con backoff
  ✓ Escenario c) Finalización en reloj con móvil cerrado: catch-up de 12 horas recupera sesión
  ✓ Escenario d) Respuesta 429 de ntfy.sh: pausa respetando Retry-After sin pérdida de series
  ✓ Escenario e) Dispositivos alternados: convergencia sin sobrescritura destructiva
  ✓ Escenario f) Topic privado: determinismo e igualdad entre web y reloj para un mismo código
  ✓ Escenario g) Sin entreno activo: 0 peticiones HTTP periódicas en segundo plano
  ✓ Escenario h) Sesión duplicada: dos eventos WORKOUT_FINISHED con el mismo sessionId solo generan 1 registro

====================================================
🎉 Todas las pruebas superadas exitosamente: 14/14
====================================================
```
