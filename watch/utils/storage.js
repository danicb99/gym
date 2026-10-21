/**
 * VigorexiApp Watch - Módulo de Almacenamiento Flash Local (@zos/fs)
 * Permite funcionamiento 100% autónomo (offline-first)
 */

import { readFileSync, writeFileSync, statSync } from '@zos/fs'

const STORAGE_FILE = 'vigorexiapp_data.json'

const DEFAULT_STORAGE = {
  activeSession: null,
  history: [],          // Sesiones completadas
  previousWeights: {},  // exId -> último peso y reps registrados
  customSlots: {},      // slotId -> exId (máquinas alternas seleccionadas)
  outbox: []            // Cola de eventos pendientes de sincronizar con el móvil/web
}

export function loadWorkoutData() {
  try {
    const fileStat = statSync({ path: STORAGE_FILE })
    if (fileStat) {
      const content = readFileSync({
        path: STORAGE_FILE,
        options: { encoding: 'utf8' }
      })
      if (content && typeof content === 'string') {
        const parsed = JSON.parse(content)
        return Object.assign({}, DEFAULT_STORAGE, parsed)
      }
    }
  } catch (e) {
    console.log('[Storage] Error leyendo datos locales, usando por defecto:', e)
  }
  return Object.assign({}, DEFAULT_STORAGE)
}

export function saveWorkoutData(data) {
  try {
    const jsonStr = JSON.stringify(data)
    writeFileSync({
      path: STORAGE_FILE,
      data: jsonStr,
      options: { encoding: 'utf8' }
    })
    return true
  } catch (e) {
    console.log('[Storage] Error guardando datos locales:', e)
    return false
  }
}

export function getOutbox() {
  const current = loadWorkoutData()
  return Array.isArray(current.outbox) ? current.outbox : []
}

export function enqueueOutbox(event) {
  if (!event || !event.id) return false
  const current = loadWorkoutData()
  if (!Array.isArray(current.outbox)) current.outbox = []
  const index = current.outbox.findIndex(e => e.id === event.id)
  if (index === -1) {
    current.outbox.push(event)
  } else {
    // Mismo evento re-encolado: actualizar payload sin perder el backoff acumulado
    current.outbox[index] = Object.assign({}, event, {
      retries: current.outbox[index].retries || 0
    })
  }
  return saveWorkoutData(current)
}

export function removeFromOutbox(eventId) {
  if (!eventId) return false
  const current = loadWorkoutData()
  if (!Array.isArray(current.outbox)) return false
  const prevLen = current.outbox.length
  current.outbox = current.outbox.filter(e => e.id !== eventId)
  if (current.outbox.length !== prevLen) {
    return saveWorkoutData(current)
  }
  return true
}

export function updateOutboxRetries(eventId, retries) {
  if (!eventId) return false
  const current = loadWorkoutData()
  if (!Array.isArray(current.outbox)) return false
  const item = current.outbox.find(e => e.id === eventId)
  if (item) {
    item.retries = retries
    return saveWorkoutData(current)
  }
  return false
}

export function markSessionSynced(sessionId) {
  if (!sessionId) return false
  const current = loadWorkoutData()
  if (!Array.isArray(current.history)) return false
  let updated = false
  current.history.forEach(s => {
    if (s.sessionId === sessionId || s.id === sessionId) {
      s.synced = true
      updated = true
    }
  })
  if (updated) {
    return saveWorkoutData(current)
  }
  return false
}

export function saveActiveSession(sessionState) {
  const current = loadWorkoutData()
  current.activeSession = sessionState
  saveWorkoutData(current)
}

export function clearActiveSession() {
  const current = loadWorkoutData()
  current.activeSession = null
  saveWorkoutData(current)
}

export function recordCompletedSession(session) {
  const current = loadWorkoutData()
  current.activeSession = null
  if (!current.history) current.history = []
  current.history.unshift(session)
  if (current.history.length > 20) current.history = current.history.slice(0, 20)

  // Actualizar pesos previos
  if (session.exercises) {
    session.exercises.forEach(ex => {
      if (ex.sets && ex.sets.length > 0) {
        current.previousWeights[ex.exId] = ex.sets[ex.sets.length - 1]
      }
    })
  }

  saveWorkoutData(current)
}
