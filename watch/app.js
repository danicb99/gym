/**
 * VigorexiApp Watch - Aplicación Principal (Zepp OS 3.0)
 * Arquitectura híbrida: 100% Autónoma (Offline) + Sincronización en Directo con el Smartphone
 */

import { BaseApp } from '@zeppos/zml/base-app'
import { loadWorkoutData, saveActiveSession, clearActiveSession, recordCompletedSession } from './utils/storage'
import { ROUTINE_SLOTS, EXERCISE_CATALOG } from './utils/routine_data'
import { requestPhoneLiveWorkout, enqueueSetCompletedEvent, enqueueWorkoutFinishedEvent, flushOutbox, getPendingOutboxCount } from './utils/sync_bridge'
import { mergeSessionLoggedSets } from './utils/merge'

App(
  BaseApp({
    globalData: {
      activeDayId: null,
      sessionId: null,
      currentSlotIndex: 0,
      currentSetIndex: 0,
      sessionStartTime: null,
      sessionLoggedSets: {},  // slotId -> [ { kg: 80, reps: 8, completed: true } ]
      slotExOverrides: {},    // slotId -> exId (sustituciones en caliente)
      slotExtraSets: {},      // slotId -> delta de series añadidas/quitadas
      phoneLiveSession: null, // Datos del entreno activo en el móvil si existe
      isPhoneSynced: false,   // True si la sesión actual está enlazada al móvil
      bleFailed: false,       // True si el último intento de comunicación BLE falló
      lastPhoneQueryTime: 0,  // Marca temporal para throttle de 20s
      restTimer: {
        active: false,
        remainingSeconds: 90,
        totalSeconds: 90,
        nextExerciseName: '',
        nextSetNum: 1
      },
      previousSets: {},
      heartRate: 0
    },

    onCreate() {
      console.log('[VigorexiApp Watch] App iniciada')

      // 1. Restaurar sesión autónoma previa si existía en memoria flash
      const saved = loadWorkoutData()
      if (saved && saved.activeSession) {
        this.globalData.activeDayId = saved.activeSession.activeDayId
        this.globalData.sessionId = saved.activeSession.sessionId || `watch-${saved.activeSession.activeDayId}-${saved.activeSession.sessionStartTime}`
        this.globalData.currentSlotIndex = saved.activeSession.currentSlotIndex || 0
        this.globalData.currentSetIndex = saved.activeSession.currentSetIndex || 0
        this.globalData.sessionStartTime = saved.activeSession.sessionStartTime
        this.globalData.sessionLoggedSets = saved.activeSession.sessionLoggedSets || {}
        this.globalData.slotExOverrides = saved.activeSession.slotExOverrides || {}
        this.globalData.slotExtraSets = saved.activeSession.slotExtraSets || {}
      }

      // 1b. Cargar marcas anteriores (previousSets) desde el historial local si no hay sesión del móvil
      if (saved && saved.history && saved.history.length > 0) {
        const localPrev = {}
        for (let i = saved.history.length - 1; i >= 0; i--) {
          const s = saved.history[i]
          if (s && s.exercises) {
            s.exercises.forEach(ex => {
              if (ex.exId && Array.isArray(ex.sets)) {
                localPrev[ex.exId] = ex.sets.map(item => `${item.kg}kg × ${item.reps}`)
              }
            })
          }
        }
        this.globalData.previousSets = Object.assign({}, localPrev, this.globalData.previousSets)
      }

      // 1c. Reintentar eventos pendientes en la outbox desde arranques previos
      flushOutbox(this)

      // 2. Comprobar en segundo plano si el móvil tiene un entreno en curso
      this.checkPhoneLiveSession()
    },

    onDestroy() {
      console.log('[VigorexiApp Watch] App destruida')
      if (this.globalData.activeDayId) {
        saveActiveSession({
          activeDayId: this.globalData.activeDayId,
          currentSlotIndex: this.globalData.currentSlotIndex,
          currentSetIndex: this.globalData.currentSetIndex,
          sessionStartTime: this.globalData.sessionStartTime,
          sessionLoggedSets: this.globalData.sessionLoggedSets,
          slotExOverrides: this.globalData.slotExOverrides,
          slotExtraSets: this.globalData.slotExtraSets
        })
      }
    },

    async checkPhoneLiveSession(force = false) {
      const now = Date.now()
      // Throttle de mínimo 60s entre consultas automáticas de red para no sobrecargar ntfy
      const minInterval = force ? 30000 : 60000
      if (this.globalData.lastPhoneQueryTime && (now - this.globalData.lastPhoneQueryTime < minInterval)) {
        return this.globalData.phoneLiveSession
      }
      this.globalData.lastPhoneQueryTime = now
      try {
        const phoneSession = await requestPhoneLiveWorkout(this)
        if (phoneSession && phoneSession.activeDayId && phoneSession.workoutActive !== false) {
          this.globalData.phoneLiveSession = phoneSession
          console.log('[VigorexiApp Watch] Entreno activo detectado en el móvil:', phoneSession.activeDayId)
        } else {
          this.globalData.phoneLiveSession = null
        }
        return this.globalData.phoneLiveSession
      } catch (e) {
        console.log('[VigorexiApp Watch] No se pudo verificar sesión móvil:', e)
        return null
      }
    },

    adoptPhoneSession(phoneSession) {
      if (!phoneSession || !phoneSession.activeDayId) return
      this.globalData.activeDayId = phoneSession.activeDayId
      this.globalData.sessionId = phoneSession.sessionId || `watch-${phoneSession.activeDayId}-${Date.now()}`
      this.globalData.currentSlotIndex = phoneSession.currentSlotIndex || 0
      this.globalData.currentSetIndex = phoneSession.currentSetIndex || 0
      this.globalData.sessionStartTime = phoneSession.sessionStartTime || Date.now()
      this.globalData.sessionLoggedSets = phoneSession.sessionLoggedSets || {}
      this.globalData.slotExOverrides = phoneSession.slotExOverrides || {}
      if (phoneSession.slotExtraSets) {
        this.globalData.slotExtraSets = Object.assign({}, this.globalData.slotExtraSets, phoneSession.slotExtraSets)
      }
      if (phoneSession.previousSets) {
        this.globalData.previousSets = phoneSession.previousSets
      }
      this.globalData.isPhoneSynced = true

      // Adoptar descanso si está activo en el móvil
      if (phoneSession.restTimer && phoneSession.restTimer.active) {
        const rt = phoneSession.restTimer
        const now = Date.now()
        let remaining = 0
        if (rt.endTime && rt.endTime > now) {
          remaining = Math.max(0, Math.round((rt.endTime - now) / 1000))
        } else if (rt.remaining > 0) {
          remaining = rt.remaining
        }

        if (remaining > 0) {
          const ex = this.getActiveExercise()
          this.globalData.restTimer = {
            active: true,
            endTime: rt.endTime || (now + remaining * 1000),
            remainingSeconds: remaining,
            totalSeconds: rt.duration || 90,
            nextExerciseName: ex ? ex.name : '',
            nextSetNum: (this.globalData.currentSetIndex || 0) + 1
          }
        } else if (this.globalData.restTimer) {
          this.globalData.restTimer.active = false
        }
      }

      saveActiveSession({
        activeDayId: this.globalData.activeDayId,
        sessionId: this.globalData.sessionId,
        currentSlotIndex: this.globalData.currentSlotIndex,
        currentSetIndex: this.globalData.currentSetIndex,
        sessionStartTime: this.globalData.sessionStartTime,
        sessionLoggedSets: this.globalData.sessionLoggedSets,
        slotExOverrides: this.globalData.slotExOverrides
      })
    },

    mergePhoneSession(phoneSession) {
      if (!phoneSession || !phoneSession.activeDayId) return
      if (phoneSession.activeDayId !== this.globalData.activeDayId) return
      if (phoneSession.sessionId && !this.globalData.sessionId) {
        this.globalData.sessionId = phoneSession.sessionId
      }

      // Fusión no destructiva: unión de series completadas sin sobrescribir valores locales
      this.globalData.sessionLoggedSets = mergeSessionLoggedSets(
        this.globalData.sessionLoggedSets,
        phoneSession.sessionLoggedSets
      )

      if (phoneSession.slotExOverrides) {
        this.globalData.slotExOverrides = Object.assign({}, this.globalData.slotExOverrides, phoneSession.slotExOverrides)
      }
      if (phoneSession.slotExtraSets) {
        this.globalData.slotExtraSets = Object.assign({}, this.globalData.slotExtraSets, phoneSession.slotExtraSets)
      }
      if (phoneSession.previousSets) {
        this.globalData.previousSets = Object.assign({}, this.globalData.previousSets, phoneSession.previousSets)
      }
      this.globalData.isPhoneSynced = true

      // Adoptar descanso solo si no hay descanso activo en curso en el reloj
      if (phoneSession.restTimer && phoneSession.restTimer.active && (!this.globalData.restTimer || !this.globalData.restTimer.active)) {
        const rt = phoneSession.restTimer
        const now = Date.now()
        let remaining = 0
        if (rt.endTime && rt.endTime > now) {
          remaining = Math.max(0, Math.round((rt.endTime - now) / 1000))
        } else if (rt.remaining > 0) {
          remaining = rt.remaining
        }

        if (remaining > 0) {
          const ex = this.getActiveExercise()
          this.globalData.restTimer = {
            active: true,
            endTime: rt.endTime || (now + remaining * 1000),
            remainingSeconds: remaining,
            totalSeconds: rt.duration || 90,
            nextExerciseName: ex ? ex.name : '',
            nextSetNum: (this.globalData.currentSetIndex || 0) + 1
          }
        }
      }

      saveActiveSession({
        activeDayId: this.globalData.activeDayId,
        sessionId: this.globalData.sessionId,
        currentSlotIndex: this.globalData.currentSlotIndex,
        currentSetIndex: this.globalData.currentSetIndex,
        sessionStartTime: this.globalData.sessionStartTime,
        sessionLoggedSets: this.globalData.sessionLoggedSets,
        slotExOverrides: this.globalData.slotExOverrides
      })
    },

    startNewWorkout(dayId) {
      this.globalData.activeDayId = dayId
      this.globalData.sessionStartTime = Date.now()
      this.globalData.sessionId = `watch-${dayId}-${this.globalData.sessionStartTime}`
      this.globalData.currentSlotIndex = 0
      this.globalData.currentSetIndex = 0
      this.globalData.sessionLoggedSets = {}
      this.globalData.slotExOverrides = {}
      this.globalData.slotExtraSets = {}
      this.globalData.phoneLiveSession = null
      this.globalData.hrHistory = []
      this.globalData.hrMax = 0
      this.globalData.heartRate = 0
      this.globalData.isPhoneSynced = false
      this.globalData.restTimer = {
        active: false,
        remainingSeconds: 90,
        totalSeconds: 90,
        nextExerciseName: '',
        nextSetNum: 1
      }

      saveActiveSession({
        activeDayId: dayId,
        sessionId: this.globalData.sessionId,
        currentSlotIndex: 0,
        currentSetIndex: 0,
        sessionStartTime: this.globalData.sessionStartTime,
        sessionLoggedSets: {},
        slotExOverrides: {}
      })
    },

    getActiveSlot() {
      const day = ROUTINE_SLOTS[this.globalData.activeDayId]
      if (!day || !day.slots) return null
      return day.slots[this.globalData.currentSlotIndex] || null
    },

    getActiveExercise() {
      const slot = this.getActiveSlot()
      if (!slot) return null
      const effectiveExId = this.globalData.slotExOverrides[slot.slotId] || slot.defaultExId
      return EXERCISE_CATALOG[effectiveExId] || EXERCISE_CATALOG[slot.defaultExId]
    },

    getTotalSetsForSlot(slot) {
      if (!slot) return 4
      const base = (slot.sets && slot.sets.length) || 4
      const extra = (this.globalData.slotExtraSets && this.globalData.slotExtraSets[slot.slotId]) || 0
      return Math.max(1, base + extra)
    },

    addExtraSet(slotId) {
      if (!this.globalData.slotExtraSets) this.globalData.slotExtraSets = {}
      this.globalData.slotExtraSets[slotId] = (this.globalData.slotExtraSets[slotId] || 0) + 1
      saveActiveSession({
        activeDayId: this.globalData.activeDayId,
        currentSlotIndex: this.globalData.currentSlotIndex,
        currentSetIndex: this.globalData.currentSetIndex,
        sessionStartTime: this.globalData.sessionStartTime,
        sessionLoggedSets: this.globalData.sessionLoggedSets,
        slotExOverrides: this.globalData.slotExOverrides,
        slotExtraSets: this.globalData.slotExtraSets
      })
    },

    removeSet(slotId) {
      if (!this.globalData.slotExtraSets) this.globalData.slotExtraSets = {}
      this.globalData.slotExtraSets[slotId] = (this.globalData.slotExtraSets[slotId] || 0) - 1
      saveActiveSession({
        activeDayId: this.globalData.activeDayId,
        currentSlotIndex: this.globalData.currentSlotIndex,
        currentSetIndex: this.globalData.currentSetIndex,
        sessionStartTime: this.globalData.sessionStartTime,
        sessionLoggedSets: this.globalData.sessionLoggedSets,
        slotExOverrides: this.globalData.slotExOverrides,
        slotExtraSets: this.globalData.slotExtraSets
      })
    },

    recordSet(slotId, setIndex, kg, reps) {
      if (!this.globalData.sessionLoggedSets[slotId]) {
        this.globalData.sessionLoggedSets[slotId] = []
      }
      this.globalData.sessionLoggedSets[slotId][setIndex] = {
        kg: Number(kg),
        reps: Number(reps),
        completed: true,
        timestamp: Date.now()
      }

      if (!this.globalData.sessionId) {
        this.globalData.sessionId = `watch-${this.globalData.activeDayId}-${this.globalData.sessionStartTime || Date.now()}`
      }

      // Guardar en la flash local del reloj (persistencia offline)
      saveActiveSession({
        activeDayId: this.globalData.activeDayId,
        sessionId: this.globalData.sessionId,
        currentSlotIndex: this.globalData.currentSlotIndex,
        currentSetIndex: this.globalData.currentSetIndex,
        sessionStartTime: this.globalData.sessionStartTime,
        sessionLoggedSets: this.globalData.sessionLoggedSets,
        slotExOverrides: this.globalData.slotExOverrides,
        slotExtraSets: this.globalData.slotExtraSets
      })

      // Encolar evento en outbox persistente y vaciar con confirmación
      enqueueSetCompletedEvent(
        this,
        slotId,
        setIndex,
        kg,
        reps,
        this.globalData.sessionId,
        this.globalData.activeDayId
      )
    },

    finishWorkout() {
      const day = ROUTINE_SLOTS[this.globalData.activeDayId]
      const durationMinutes = Math.round((Date.now() - (this.globalData.sessionStartTime || Date.now())) / 60000)
      const finishedSessionId = this.globalData.sessionId || `watch-${this.globalData.activeDayId}-${Date.now()}`

      const sessionSummary = {
        sessionId: finishedSessionId,
        date: new Date().toISOString(),
        dayId: this.globalData.activeDayId,
        dayName: day ? day.title : 'Entrenamiento',
        durationMinutes: Math.max(1, durationMinutes),
        synced: false,
        exercises: []
      }

      if (day && day.slots) {
        day.slots.forEach(slot => {
          const exId = this.globalData.slotExOverrides[slot.slotId] || slot.defaultExId
          const ex = EXERCISE_CATALOG[exId]
          const sets = this.globalData.sessionLoggedSets[slot.slotId] || []
          const completedSets = sets
            .map((s, idx) => (s && s.completed) ? Object.assign({}, s, { set: idx + 1 }) : null)
            .filter(Boolean)
          if (completedSets.length > 0) {
            sessionSummary.exercises.push({
              exId: exId,
              name: ex ? ex.name : slot.defaultExId,
              sets: completedSets
            })
          }
        })
      }

      // Calcular promedio de FC si se registraron pulsaciones
      let hrAvg = 0
      if (this.globalData.hrHistory && this.globalData.hrHistory.length > 0) {
        const sum = this.globalData.hrHistory.reduce((a, b) => a + b, 0)
        hrAvg = Math.round(sum / this.globalData.hrHistory.length)
      }
      sessionSummary.hrAvg = hrAvg
      sessionSummary.hrMax = this.globalData.hrMax || 0

      // Guardar en el historial local del reloj (marcado como synced: false)
      recordCompletedSession(sessionSummary)
      this.globalData.activeDayId = null
      this.globalData.sessionId = null
      this.globalData.currentSlotIndex = 0
      this.globalData.currentSetIndex = 0
      this.globalData.sessionStartTime = null
      this.globalData.sessionLoggedSets = {}
      this.globalData.slotExOverrides = {}
      this.globalData.slotExtraSets = {}
      this.globalData.isPhoneSynced = false
      this.globalData.phoneLiveSession = null
      this.globalData.hrHistory = []
      this.globalData.hrMax = 0
      this.globalData.heartRate = 0
      this.globalData.restTimer = {
        active: false,
        remainingSeconds: 90,
        totalSeconds: 90,
        nextExerciseName: '',
        nextSetNum: 1
      }
      clearActiveSession()

      // Encolar fin de entreno en outbox persistente y vaciar con confirmación
      enqueueWorkoutFinishedEvent(this, sessionSummary, finishedSessionId)

      return sessionSummary
    },

    getSyncStatus() {
      const outboxCount = getPendingOutboxCount()
      if (this.globalData.bleFailed) {
        return { text: 'sin móvil', color: 0xf43f5e }
      }
      if (outboxCount > 0) {
        return { text: `pend ${outboxCount}`, color: 0xfbbf24 }
      }
      return { text: 'ok', color: 0x10b981 }
    },

    flushPendingOutbox() {
      flushOutbox(this)
    }
  })
)
