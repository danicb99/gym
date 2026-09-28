/**
 * VigorexiApp Watch - Sync Bridge
 * Comunicación bidireccional entre el reloj y el smartphone (app-side)
 */

export const SYNC_EVENTS = {
  GET_PHONE_SESSION: 'GET_PHONE_SESSION',
  SET_COMPLETED: 'SET_COMPLETED',
  WORKOUT_FINISHED: 'WORKOUT_FINISHED',
  SYNC_STATUS: 'SYNC_STATUS'
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
    }, { timeout: 4000 })
    return result && result.session ? result.session : null
  } catch (err) {
    console.log('[SyncBridge] No se pudo conectar con el móvil:', err)
    return null
  }
}

/**
 * Notifica al móvil que se ha completado una serie en el reloj
 * @param {Object} context - Instancia con método .call
 * @param {string} slotId - ID del slot (ej. "torsoA_1")
 * @param {number} setIndex - Índice de la serie (0, 1, 2...)
 * @param {number} kg - Peso utilizado
 * @param {number} reps - Repeticiones realizadas
 */
export function notifySetCompleted(context, slotId, setIndex, kg, reps) {
  if (!context || typeof context.call !== 'function') return
  try {
    context.call({
      method: SYNC_EVENTS.SET_COMPLETED,
      params: {
        slotId: slotId,
        setIndex: setIndex,
        kg: Number(kg),
        reps: Number(reps),
        timestamp: Date.now()
      }
    })
    console.log('[SyncBridge] Serie enviada al móvil:', slotId, setIndex, kg, reps)
  } catch (err) {
    console.log('[SyncBridge] Error enviando serie:', err)
  }
}

/**
 * Notifica al móvil que el entrenamiento ha finalizado en el reloj
 * @param {Object} context - Instancia con método .request o .call
 * @param {Object} summary - Resumen de la sesión completada
 */
export function notifyWorkoutFinished(context, summary) {
  if (!context) return
  try {
    if (typeof context.request === 'function') {
      context.request({
        method: SYNC_EVENTS.WORKOUT_FINISHED,
        params: summary
      }, { timeout: 5000 }).catch(e => console.log('[SyncBridge] Error notificando fin:', e))
    } else if (typeof context.call === 'function') {
      context.call({
        method: SYNC_EVENTS.WORKOUT_FINISHED,
        params: summary
      })
    }
  } catch (err) {
    console.log('[SyncBridge] Error en notifyWorkoutFinished:', err)
  }
}
