/**
 * VigorexiApp Watch - Lógica Pura de Fusión de Sesiones (Reloj ↔ Web)
 * Módulo independiente y determinista sin dependencias de UI
 */

/**
 * Cuenta el total de series completadas en un mapa de sets
 * @param {Object} loggedSets - slotId -> Array<{ completed: boolean }>
 * @returns {number}
 */
export function countCompletedSets(loggedSets) {
  if (!loggedSets || typeof loggedSets !== 'object') return 0
  let count = 0
  for (const slotId in loggedSets) {
    const list = loggedSets[slotId]
    if (Array.isArray(list)) {
      for (let i = 0; i < list.length; i++) {
        if (list[i] && list[i].completed) count++
      }
    }
  }
  return count
}

/**
 * Fusiona los registros de series de ambos dispositivos sin pérdida de datos.
 * Regla: Unión de sets completados. Un set completado nunca es sobrescrito por uno no completado.
 * Conflicto en el mismo set completado: gana el registro más reciente por timestamp/completedAt.
 *
 * @param {Object} localSets - slotId -> [ { kg, reps, completed, timestamp } ]
 * @param {Object} remoteSets - slotId -> [ { kg, reps, completed, timestamp } ]
 * @returns {Object} Mapa fusionado
 */
export function mergeSessionLoggedSets(localSets = {}, remoteSets = {}) {
  const merged = {}
  const allSlotIds = new Set([
    ...Object.keys(localSets || {}),
    ...Object.keys(remoteSets || {})
  ])

  allSlotIds.forEach(slotId => {
    const localList = Array.isArray(localSets?.[slotId]) ? localSets[slotId] : []
    const remoteList = Array.isArray(remoteSets?.[slotId]) ? remoteSets[slotId] : []
    const maxLen = Math.max(localList.length, remoteList.length)
    const combined = []

    for (let i = 0; i < maxLen; i++) {
      const lSet = localList[i]
      const rSet = remoteList[i]

      if (!lSet && !rSet) continue

      if (lSet && lSet.completed && (!rSet || !rSet.completed)) {
        combined[i] = { ...lSet }
      } else if (rSet && rSet.completed && (!lSet || !lSet.completed)) {
        combined[i] = { ...rSet }
      } else if (lSet && lSet.completed && rSet && rSet.completed) {
        // Ambos completaron la misma serie: desempatar por el timestamp más reciente
        const lTime = lSet.completedAt || lSet.timestamp || 0
        const rTime = rSet.completedAt || rSet.timestamp || 0
        if (rTime > lTime) {
          combined[i] = { ...rSet }
        } else {
          combined[i] = { ...lSet }
        }
      } else {
        // Ninguno está completado: mantener el que tenga valores definidos
        combined[i] = lSet ? { ...lSet } : { ...rSet }
      }
    }

    merged[slotId] = combined
  })

  return merged
}
