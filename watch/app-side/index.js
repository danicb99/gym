/**
 * VigorexiApp Watch - Side Service (Móvil - Zepp App Companion)
 * Puente de comunicación bidireccional entre el Amazfit Active 2 y VigorexiApp Web (PWA)
 */

import { BaseSideService } from '@zeppos/zml/base-side'
import { SYNC_CONFIG } from './config'

function deriveTopicHash(code) {
  const str = String(code || '').trim() || 'vigorexi_danicb99_7f3a91c4e2b8'
  let h1 = 0x811c9dc5
  let h2 = 0x9e3779b9
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 ^= ch
    h1 = Math.imul(h1, 0x01000193)
    h2 ^= ch
    h2 = Math.imul(h2, 0x5bd1e995)
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0')
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0')
  return (hex1 + hex2).toLowerCase()
}

function getSyncEndpoints(config) {
  const server = ((config && config.SERVER_URL) || 'https://ntfy.sh').replace(/\/+$/, '')
  const code = (config && config.SYNC_CODE) || 'vigorexi_danicb99_7f3a91c4e2b8'
  const hash = deriveTopicHash(code)
  return {
    phoneToWatch: `${server}/vigorexi_${hash}_p2w`,
    watchToPhone: `${server}/vigorexi_${hash}_w2p`
  }
}

const ENDPOINTS = getSyncEndpoints(SYNC_CONFIG)
const RELAY_WATCH_TO_PHONE = ENDPOINTS.watchToPhone
const RELAY_PHONE_TO_WATCH = ENDPOINTS.phoneToWatch

function getAuthHeaders(config) {
  const headers = {}
  if (config && config.AUTH_TOKEN && String(config.AUTH_TOKEN).trim()) {
    headers['Authorization'] = `Bearer ${String(config.AUTH_TOKEN).trim()}`
  }
  return headers
}

async function safeFetch(ctx, options) {
  const fn = (ctx && typeof ctx.fetch === 'function')
    ? ctx.fetch.bind(ctx)
    : (typeof fetch === 'function' ? fetch : null)
  if (!fn) {
    throw new Error('No fetch implementation available in AppSideService')
  }
  return await fn(options)
}

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
        // Consultar el último estado del entrenamiento que el móvil haya publicado (since=latest para evitar sobrecarga)
        try {
          const response = await safeFetch(this, {
            url: `${RELAY_PHONE_TO_WATCH}/json?poll=1&since=latest`,
            method: 'GET',
            headers: {
              ...getAuthHeaders(SYNC_CONFIG)
            },
            timeout: 10000
          })

          const status = response ? (response.status || 200) : 0
          if (!response || status < 200 || status >= 300 || !response.body) {
            console.log('[VigorexiApp Side] Respuesta HTTP no exitosa al consultar sesión:', status)
            res(null, { ok: false, session: null, status: status })
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
                const data = (sessionPayload && sessionPayload.payload) ? sessionPayload.payload : sessionPayload
                if (!data) continue

                // Si la web notificó explícitamente que no hay entreno activo, no hay sesión a adoptar
                if (data.workoutActive === false) {
                  latestSession = null
                  break
                }

                if (data.activeDayId) {
                  // Descartar snapshots con más de 3 horas (180 minutos)
                  const ageMinutes = (Date.now() - (data.timestamp || 0)) / 60000
                  if (ageMinutes <= 180) {
                    latestSession = data
                    break
                  }
                }
              }
            } catch (e) {
              // Ignorar línea no parseable
            }
          }

          console.log('[VigorexiApp Side] Sesión activa para el reloj:', latestSession ? `${latestSession.activeDayId} slot ${latestSession.currentSlotIndex} set ${latestSession.currentSetIndex}` : 'ninguna')
          res(null, { ok: true, session: latestSession, status: status })
        } catch (err) {
          console.log('[VigorexiApp Side] Error consultando sesión móvil:', err)
          res(null, { ok: false, session: null, status: 500, error: String(err) })
        }
      } else if (req.method === 'SET_COMPLETED') {
        // Retransmitir serie completada a la PWA con comprobación de estado HTTP
        try {
          const event = req.params
          const envelope = (event && event.v) ? event : {
            v: 1,
            id: (event && event.id) || `watch-set-${Date.now()}`,
            type: 'SET_COMPLETED',
            ts: (event && (event.ts || event.timestamp)) || Date.now(),
            src: 'watch',
            ...event,
            payload: event
          }

          const response = await safeFetch(this, {
            url: RELAY_WATCH_TO_PHONE,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(SYNC_CONFIG)
            },
            body: JSON.stringify(envelope),
            timeout: 10000
          })

          const status = response ? (response.status || 200) : 0
          if (response && status >= 200 && status < 300) {
            console.log('[VigorexiApp Side] Serie retransmitida con éxito:', envelope.id)
            res(null, { ok: true, id: envelope.id, status: status })
          } else {
            const retryAfter = (response && response.headers && parseInt(response.headers['retry-after'], 10)) || 60
            console.log('[VigorexiApp Side] Error HTTP retransmitiendo serie:', status)
            res(null, { ok: false, id: envelope.id, status: status, retryAfter: retryAfter })
          }
        } catch (err) {
          console.log('[VigorexiApp Side] Excepción retransmitiendo serie:', err)
          res(null, { ok: false, status: 500, error: String(err) })
        }
      } else if (req.method === 'WORKOUT_FINISHED') {
        // Enviar resumen de sesión completada desde el reloj con comprobación de estado HTTP
        try {
          const event = req.params
          const envelope = (event && event.v) ? event : {
            v: 1,
            id: (event && event.id) || `watch-fin-${Date.now()}`,
            type: 'WORKOUT_FINISHED',
            ts: (event && (event.ts || event.timestamp)) || Date.now(),
            src: 'watch',
            ...event,
            payload: event.summary ? event : { summary: event }
          }

          const response = await safeFetch(this, {
            url: RELAY_WATCH_TO_PHONE,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(SYNC_CONFIG)
            },
            body: JSON.stringify(envelope),
            timeout: 10000
          })

          const status = response ? (response.status || 200) : 0
          if (response && status >= 200 && status < 300) {
            console.log('[VigorexiApp Side] Fin de entreno retransmitido a la PWA con éxito:', envelope.id)
            res(null, { ok: true, id: envelope.id, status: status })
          } else {
            const retryAfter = (response && response.headers && parseInt(response.headers['retry-after'], 10)) || 60
            console.log('[VigorexiApp Side] Error HTTP retransmitiendo fin de entreno:', status)
            res(null, { ok: false, id: envelope.id, status: status, retryAfter: retryAfter })
          }
        } catch (err) {
          console.log('[VigorexiApp Side] Error retransmitiendo fin de entreno:', err)
          res(null, { ok: false, status: 500, error: String(err) })
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
          await safeFetch(this, {
            url: RELAY_WATCH_TO_PHONE,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(SYNC_CONFIG)
            },
            body: JSON.stringify(payload),
            timeout: 10000
          })
          console.log('[VigorexiApp Side] Serie retransmitida a la PWA:', req.params)
        } catch (err) {
          console.log('[VigorexiApp Side] Error retransmitiendo serie:', err)
        }
      }
    }
  })
)
