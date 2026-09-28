/**
 * VigorexiApp Watch - Motor Háptico (@zos/sensor Vibrator)
 * Alertas táctiles silenciosas para descanso completado y feedback de botones
 */

import { Vibrator } from '@zos/sensor'

let vibratorInstance = null

function getVibrator() {
  if (!vibratorInstance) {
    try {
      vibratorInstance = new Vibrator()
    } catch (e) {
      console.log('[Haptics] Error inicializando vibrador:', e)
    }
  }
  return vibratorInstance
}

/**
 * Vibración corta y sutil de confirmación al pulsar un botón
 */
export function vibrateShort() {
  const vib = getVibrator()
  if (vib) {
    try {
      vib.start()
      setTimeout(() => {
        try { vib.stop() } catch (err) {}
      }, 50)
    } catch (e) {
      console.log('[Haptics] Error vibrateShort:', e)
    }
  }
}

/**
 * Alarma de fin de descanso: Patrón potente e inconfundible en la muñeca
 * (Bip-Bip largo)
 */
export function vibrateRestFinished() {
  const vib = getVibrator()
  if (vib) {
    try {
      // Ráfaga 1
      vib.start()
      setTimeout(() => {
        try { vib.stop() } catch (err) {}

        // Pausa y Ráfaga 2
        setTimeout(() => {
          try {
            vib.start()
            setTimeout(() => {
              try { vib.stop() } catch (err) {}

              // Ráfaga 3 final
              setTimeout(() => {
                try {
                  vib.start()
                  setTimeout(() => {
                    try { vib.stop() } catch (err) {}
                  }, 400)
                } catch (err) {}
              }, 120)
            }, 300)
          } catch (err) {}
        }, 120)
      }, 300)
    } catch (e) {
      console.log('[Haptics] Error vibrateRestFinished:', e)
    }
  }
}
