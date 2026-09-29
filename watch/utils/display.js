/**
 * VigorexiApp Watch - Control de Pantalla y Persistencia (@zos/display)
 * Evita el cierre prematuro y la suspensión agresiva durante el entrenamiento
 */

import {
  setWakeUpRelaunch,
  resetWakeUpRelaunch,
  pauseDropWristScreenOff,
  resetDropWristScreenOff,
  pausePalmScreenOff,
  resetPalmScreenOff,
  setPageBrightTime,
  resetPageBrightTime
} from '@zos/display'

/**
 * Mantiene la app activa y visible durante la serie o el descanso.
 * - Evita que el giro de muñeca hacia abajo suspenda/cierre la app.
 * - Evita que cubrir la pantalla con la palma cierre la app.
 * - Habilita relanzamiento automático al encender pantalla.
 * - Extiende el tiempo de pantalla encendida a 45s (o el tiempo indicado).
 */
export function keepScreenActive(brightTimeMs = 45000) {
  try {
    if (typeof setWakeUpRelaunch === 'function') {
      setWakeUpRelaunch({ relaunch: true })
    }
  } catch (e) {
    try {
      setWakeUpRelaunch(true)
    } catch (e2) {}
  }

  try {
    if (typeof pauseDropWristScreenOff === 'function') {
      pauseDropWristScreenOff({ time: 0 })
    }
  } catch (e) {}

  try {
    if (typeof pausePalmScreenOff === 'function') {
      pausePalmScreenOff({ duration: 0 })
    }
  } catch (e) {}

  try {
    if (typeof setPageBrightTime === 'function' && brightTimeMs > 0) {
      setPageBrightTime({ brightTime: brightTimeMs })
    }
  } catch (e) {}
}

/**
 * Restaura el comportamiento estándar del sistema operativo al salir de la pantalla
 */
export function restoreScreenBehavior() {
  try {
    if (typeof resetWakeUpRelaunch === 'function') {
      resetWakeUpRelaunch()
    } else if (typeof setWakeUpRelaunch === 'function') {
      setWakeUpRelaunch({ relaunch: false })
    }
  } catch (e) {}

  try {
    if (typeof resetDropWristScreenOff === 'function') {
      resetDropWristScreenOff()
    }
  } catch (e) {}

  try {
    if (typeof resetPalmScreenOff === 'function') {
      resetPalmScreenOff()
    }
  } catch (e) {}

  try {
    if (typeof resetPageBrightTime === 'function') {
      resetPageBrightTime()
    }
  } catch (e) {}
}
