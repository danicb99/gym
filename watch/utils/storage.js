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
  customSlots: {}       // slotId -> exId (máquinas alternas seleccionadas)
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
