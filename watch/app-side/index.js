/**
 * VigorexiApp Watch - Side Service (Móvil - Zepp App Companion)
 * Puente de comunicación entre el Amazfit Active 2 y el smartphone
 */

import { BaseSideService } from '@zeppos/zml/base-side'

AppSideService(
  BaseSideService({
    onInit() {
      console.log('[VigorexiApp Side] Servicio iniciado en la app móvil')
    },

    onRun() {
      console.log('[VigorexiApp Side] Ejecutándose')
    },

    onDestroy() {
      console.log('[VigorexiApp Side] Servicio detenido')
    },

    onRequest(req, res) {
      console.log('[VigorexiApp Side] Solicitud recibida del reloj:', req.method)
      if (req.method === 'SYNC_COMPLETED_SESSION') {
        // Recibir entreno terminado desde el reloj
        const sessionData = req.params
        console.log('[VigorexiApp Side] Sesión recibida para sincronizar:', sessionData)
        res(null, { status: 'OK', syncedAt: Date.now() })
      } else {
        res(null, { status: 'UNKNOWN_METHOD' })
      }
    }
  })
)
