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

      const lComp = !!(lSet && lSet.completed)
      const rComp = !!(rSet && rSet.completed)

      // Regla 1: Una serie completada NUNCA es sobrescrita por una no completada
      if (lComp && !rComp) {
        combined[i] = { ...lSet }
      } else if (rComp && !lComp) {
        combined[i] = { ...rSet }
      } else {
        // Ambas están completadas (o ninguna lo está): gana la más reciente según completedAt / timestamp
        const lTime = Number(lSet?.completedAt || lSet?.timestamp || 0)
        const rTime = Number(rSet?.completedAt || rSet?.timestamp || 0)

        if (rTime > lTime) {
          // Gana el cambio más reciente incluso si corrigió a la baja (menos peso o menos reps)
          combined[i] = { ...rSet }
        } else if (lTime > rTime) {
          combined[i] = { ...lSet }
        } else {
          // Empate exacto de tiempo: mantener el que tenga valores válidos
          combined[i] = rSet ? { ...rSet } : { ...lSet }
        }
      }
    }

    merged[slotId] = combined
  })

  return merged
}
