/**
 * VigorexiApp Watch - Side Service (Móvil - Zepp App Companion)
 * Puente de comunicación bidireccional entre el Amazfit Active 2 y VigorexiApp Web (PWA)
 */

import { BaseSideService } from '@zeppos/zml/base-side'

const RELAY_WATCH_TO_PHONE = 'https://ntfy.sh/vigorexiapp_sync_danicb99'
const RELAY_PHONE_TO_WATCH = 'https://ntfy.sh/vigorexiapp_watch_danicb99'

AppSideService(
  BaseSideService({
    onInit() {
      console.log('[VigorexiApp Side] Servicio iniciado en Zepp App Companion')
    },

    onRun() {
      console.log('[VigorexiApp Side] Ejecutándose en segundo plano')
    },

    onDestroy() {
      console.log('[VigorexiApp Side] Servicio detenido')
    },

    async onRequest(req, res) {
      console.log('[VigorexiApp Side] Solicitud onRequest recibida:', req.method)

      if (req.method === 'GET_PHONE_SESSION') {
        // Consultar el último estado del entrenamiento que el móvil haya publicado
        try {
          const response = await fetch({
            url: `${RELAY_PHONE_TO_WATCH}/json?poll=1`,
            method: 'GET'
          })

          const bodyText = typeof response.body === 'string' ? response.body : JSON.stringify(response.body)
          if (!bodyText || bodyText.trim() === '') {
            res(null, { session: null })
            return
          }

          // ntfy devuelve líneas ndjson; tomamos la última línea con evento 'message'
          const lines = bodyText.trim().split('\n')
          let latestSession = null

          for (let i = lines.length - 1; i >= 0; i--) {
            try {
              const parsed = JSON.parse(lines[i])
              if (parsed.event === 'message' && parsed.message) {
                const sessionPayload = typeof parsed.message === 'string' ? JSON.parse(parsed.message) : parsed.message
                if (sessionPayload && sessionPayload.activeDayId) {
                  // Verificar que no sea un entreno de hace más de 6 horas
                  const ageMinutes = (Date.now() - (sessionPayload.timestamp || 0)) / 60000
                  if (ageMinutes < 360) {
                    latestSession = sessionPayload
                    break
                  }
                }
              }
            } catch (e) {
              // Ignorar línea no parseable
            }
          }

          console.log('[VigorexiApp Side] Sesión activa encontrada para el reloj:', latestSession ? latestSession.activeDayId : 'ninguna')
          res(null, { session: latestSession })
        } catch (err) {
          console.log('[VigorexiApp Side] Error consultando sesión móvil:', err)
          res(null, { session: null })
        }
      } else if (req.method === 'WORKOUT_FINISHED') {
        // Enviar resumen de sesión completada desde el reloj a la PWA móvil
        try {
          const payload = {
            type: 'WORKOUT_FINISHED',
            summary: req.params,
            timestamp: Date.now()
          }
          await fetch({
            url: RELAY_WATCH_TO_PHONE,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
          console.log('[VigorexiApp Side] Fin de entreno retransmitido a la PWA')
          res(null, { status: 'OK' })
        } catch (err) {
          console.log('[VigorexiApp Side] Error retransmitiendo fin de entreno:', err)
          res(null, { status: 'ERROR', error: String(err) })
        }
      } else {
        res(null, { status: 'UNKNOWN_METHOD' })
      }
    },

    async onCall(req) {
      console.log('[VigorexiApp Side] Evento onCall recibido:', req.method)

      if (req.method === 'SET_COMPLETED') {
        // Retransmitir la serie marcada en el reloj a la web móvil
        try {
          const payload = {
            type: 'SET_COMPLETED',
            ...req.params,
            timestamp: Date.now()
          }
          await fetch({
            url: RELAY_WATCH_TO_PHONE,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
          console.log('[VigorexiApp Side] Serie retransmitida a la PWA:', req.params)
        } catch (err) {
          console.log('[VigorexiApp Side] Error retransmitiendo serie:', err)
        }
      }
    }
  })
)
