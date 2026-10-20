/**
 * VigorexiApp Watch - Sync Bridge
 * Comunicación bidireccional fiable con Outbox persistente y confirmación de entrega
 */

import { getOutbox, enqueueOutbox, removeFromOutbox, updateOutboxRetries, markSessionSynced } from './storage'

export const SYNC_EVENTS = {
  GET_PHONE_SESSION: 'GET_PHONE_SESSION',
  SET_COMPLETED: 'SET_COMPLETED',
  WORKOUT_FINISHED: 'WORKOUT_FINISHED',
  SYNC_STATUS: 'SYNC_STATUS'
}

let isFlushingOutbox = false
let outboxRetryTimer = null
const BACKOFF_STEPS = [2, 5, 15, 60, 300] // segundos

export function getPendingOutboxCount() {
  const outbox = getOutbox()
  return Array.isArray(outbox) ? outbox.length : 0
}

/**
 * Solicita a la app móvil el entrenamiento que está en curso en el teléfono
 * @param {Object} context - Instancia con método .request (BaseApp o BasePage)
 * @returns {Promise<Object|null>} Sesión activa o null si no hay o hay error
 */
export async function requestPhoneLiveWorkout(context) {
  if (!context || typeof context.request !== 'function') {
    return null
  }
  try {
    const result = await context.request({
      method: SYNC_EVENTS.GET_PHONE_SESSION,
      params: { timestamp: Date.now() }
    }, { timeout: 10000 })
    if (context && context.globalData) context.globalData.bleFailed = false
    return result && result.session ? result.session : null
  } catch (err) {
    console.log('[SyncBridge] No se pudo conectar con el móvil:', err)
    if (context && context.globalData) context.globalData.bleFailed = true
    return null
  }
}

/**
 * Encola una serie completada en el outbox persistente y lanza el vaciado
 */
export function enqueueSetCompletedEvent(context, slotId, setIndex, kg, reps, sessionId, dayId) {
  const sId = sessionId || `watch-${dayId || 'live'}-${Date.now()}`
  const eventId = `watch-${sId}-s-${slotId}_${setIndex}`
  const event = {
    v: 1,
    id: eventId,
    type: 'SET_COMPLETED',
    ts: Date.now(),
    src: 'watch',
    payload: {
      sessionId: sId,
      dayId: dayId,
      slotId: slotId,
      setIndex: setIndex,
      kg: Number(kg),
      reps: Number(reps),
      completedAt: Date.now()
    }
  }

  // Guardar en cola persistente
  enqueueOutbox(event)
  // Intentar envío inmediato
  flushOutbox(context)
}

/**
 * Encola el fin de entreno en el outbox persistente y lanza el vaciado
 */
export function enqueueWorkoutFinishedEvent(context, sessionSummary, sessionId) {
  const sId = sessionId || sessionSummary.sessionId || `watch-${sessionSummary.dayId || 'fin'}-${Date.now()}`
  const eventId = `watch-${sId}-fin`
  const event = {
    v: 1,
    id: eventId,
    type: 'WORKOUT_FINISHED',
    ts: Date.now(),
    src: 'watch',
    payload: {
      sessionId: sId,
      summary: {
        ...sessionSummary,
        sessionId: sId
      }
    }
  }

  // Guardar en cola persistente
  enqueueOutbox(event)
  // Intentar envío inmediato
  flushOutbox(context)
}

/**
 * Procesa secuencialmente los eventos de la cola de salida mediante request con confirmación
 */
export async function flushOutbox(context) {
  if (isFlushingOutbox) return
  if (!context || typeof context.request !== 'function') return

  const outbox = getOutbox()
  if (!Array.isArray(outbox) || outbox.length === 0) {
    if (outboxRetryTimer) {
      clearTimeout(outboxRetryTimer)
      outboxRetryTimer = null
    }
    return
  }

  isFlushingOutbox = true

  try {
    for (const item of outbox) {
      console.log('[SyncBridge] Enviando evento de outbox con confirmación:', item.id, item.type)
      try {
        const response = await context.request({
          method: item.type === 'WORKOUT_FINISHED' ? SYNC_EVENTS.WORKOUT_FINISHED : SYNC_EVENTS.SET_COMPLETED,
          params: item
        }, { timeout: 10000 })

        if (context && context.globalData) context.globalData.bleFailed = false

        if (response && response.ok === true) {
          console.log('[SyncBridge] Evento confirmado por el servidor:', item.id)
          removeFromOutbox(item.id)
          if (item.type === 'WORKOUT_FINISHED') {
            const sId = (item.payload && item.payload.sessionId) || (item.payload && item.payload.summary && item.payload.summary.sessionId)
            if (sId) markSessionSynced(sId)
          }
          // Éxito: continuar enviando el siguiente elemento en la cola
        } else {
          // Servidor o app-side devolvió error (ej. 429 rate limit o HTTP error)
          const retries = (item.retries || 0) + 1
          updateOutboxRetries(item.id, retries)
          const delaySec = (response && response.retryAfter)
            ? response.retryAfter
            : (BACKOFF_STEPS[Math.min(retries - 1, BACKOFF_STEPS.length - 1)] || 300)
          console.log(`[SyncBridge] Reintento programado en ${delaySec}s para evento ${item.id}`)
          scheduleOutboxRetry(context, delaySec * 1000)
          break
        }
      } catch (reqErr) {
        // Error de comunicación BLE o timeout con el móvil
        console.log('[SyncBridge] Error/timeout de comunicación con móvil:', reqErr)
        if (context && context.globalData) context.globalData.bleFailed = true
        const retries = (item.retries || 0) + 1
        updateOutboxRetries(item.id, retries)
        const delaySec = BACKOFF_STEPS[Math.min(retries - 1, BACKOFF_STEPS.length - 1)] || 300
        scheduleOutboxRetry(context, delaySec * 1000)
        break
      }
    }
  } finally {
    isFlushingOutbox = false
  }
}

function scheduleOutboxRetry(context, delayMs) {
  if (outboxRetryTimer) clearTimeout(outboxRetryTimer)
  outboxRetryTimer = setTimeout(() => {
    outboxRetryTimer = null
    flushOutbox(context)
  }, delayMs)
}
