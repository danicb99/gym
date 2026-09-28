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
          const fetchFn = (typeof this.fetch === 'function') ? this.fetch.bind(this) : (typeof fetch === 'function' ? fetch : null)
          if (!fetchFn) {
            console.log('[VigorexiApp Side] Fetch no disponible en entorno')
            res(null, { session: null })
            return
          }

          const response = await fetchFn({
            url: `${RELAY_PHONE_TO_WATCH}/json?poll=1`,
            method: 'GET',
            timeout: 6000
          })

          if (!response || !response.body) {
            res(null, { session: null })
            return
          }

          let lines = []
          if (typeof response.body === 'string') {
            lines = response.body.trim().split('\n')
          } else if (Array.isArray(response.body)) {
            lines = response.body
          } else if (typeof response.body === 'object') {
            lines = [response.body]
          }

          let latestSession = null

          for (let i = lines.length - 1; i >= 0; i--) {
            try {
              let item = lines[i]
              if (typeof item === 'string') {
                item = JSON.parse(item)
              }
              if (item && item.event === 'message' && item.message) {
                let sessionPayload = item.message
                if (typeof sessionPayload === 'string') {
                  sessionPayload = JSON.parse(sessionPayload)
                }
                if (sessionPayload && sessionPayload.activeDayId) {
                  // Verificar que no sea un entreno de hace más de 8 horas
                  const ageMinutes = (Date.now() - (sessionPayload.timestamp || 0)) / 60000
                  if (ageMinutes < 480) {
                    latestSession = sessionPayload
                    break
                  }
                }
              }
            } catch (e) {
              // Ignorar línea no parseable
            }
          }

          console.log('[VigorexiApp Side] Sesión activa para el reloj:', latestSession ? `${latestSession.activeDayId} slot ${latestSession.currentSlotIndex} set ${latestSession.currentSetIndex}` : 'ninguna')
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
