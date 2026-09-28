/**
 * VigorexiApp Watch - Aplicación Principal (Zepp OS 3.0)
 * Arquitectura híbrida: 100% Autónoma (Offline) + Sincronización en Directo con el Smartphone
 */

import { BaseApp } from '@zeppos/zml/base-app'
import { loadWorkoutData, saveActiveSession, clearActiveSession, recordCompletedSession } from './utils/storage'
import { ROUTINE_SLOTS, EXERCISE_CATALOG } from './utils/routine_data'
import { notifySetCompleted, notifyWorkoutFinished, requestPhoneLiveWorkout } from './utils/sync_bridge'

App(
  BaseApp({
    globalData: {
      activeDayId: null,
      currentSlotIndex: 0,
      currentSetIndex: 0,
      sessionStartTime: null,
      sessionLoggedSets: {},  // slotId -> [ { kg: 80, reps: 8, completed: true } ]
      slotExOverrides: {},    // slotId -> exId (sustituciones en caliente)
      phoneLiveSession: null, // Datos del entreno activo en el móvil si existe
      isPhoneSynced: false,   // True si la sesión actual está enlazada al móvil
      restTimer: {
        active: false,
        remainingSeconds: 90,
        totalSeconds: 90,
        nextExerciseName: '',
        nextSetNum: 1
      },
      heartRate: 0
    },

    onCreate() {
      console.log('[VigorexiApp Watch] App iniciada')

      // 1. Restaurar sesión autónoma previa si existía en memoria flash
      const saved = loadWorkoutData()
      if (saved && saved.activeSession) {
        this.globalData.activeDayId = saved.activeSession.activeDayId
        this.globalData.currentSlotIndex = saved.activeSession.currentSlotIndex || 0
        this.globalData.currentSetIndex = saved.activeSession.currentSetIndex || 0
        this.globalData.sessionStartTime = saved.activeSession.sessionStartTime
        this.globalData.sessionLoggedSets = saved.activeSession.sessionLoggedSets || {}
        this.globalData.slotExOverrides = saved.activeSession.slotExOverrides || {}
      }

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
          slotExOverrides: this.globalData.slotExOverrides
        })
      }
    },

    async checkPhoneLiveSession() {
      try {
        const phoneSession = await requestPhoneLiveWorkout(this)
        if (phoneSession && phoneSession.activeDayId) {
          this.globalData.phoneLiveSession = phoneSession
          console.log('[VigorexiApp Watch] Entreno activo detectado en el móvil:', phoneSession.activeDayId)
        }
      } catch (e) {
        console.log('[VigorexiApp Watch] No se pudo verificar sesión móvil:', e)
      }
    },

    adoptPhoneSession(phoneSession) {
      if (!phoneSession || !phoneSession.activeDayId) return
      this.globalData.activeDayId = phoneSession.activeDayId
      this.globalData.currentSlotIndex = phoneSession.currentSlotIndex || 0
      this.globalData.currentSetIndex = phoneSession.currentSetIndex || 0
      this.globalData.sessionStartTime = phoneSession.sessionStartTime || Date.now()
      this.globalData.sessionLoggedSets = phoneSession.sessionLoggedSets || {}
      this.globalData.slotExOverrides = phoneSession.slotExOverrides || {}
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
        currentSlotIndex: this.globalData.currentSlotIndex,
        currentSetIndex: this.globalData.currentSetIndex,
        sessionStartTime: this.globalData.sessionStartTime,
        sessionLoggedSets: this.globalData.sessionLoggedSets,
        slotExOverrides: this.globalData.slotExOverrides
      })
    },

    startNewWorkout(dayId) {
      this.globalData.activeDayId = dayId
      this.globalData.currentSlotIndex = 0
      this.globalData.currentSetIndex = 0
      this.globalData.sessionStartTime = Date.now()
      this.globalData.sessionLoggedSets = {}
      this.globalData.slotExOverrides = {}
      this.globalData.isPhoneSynced = false

      saveActiveSession({
        activeDayId: dayId,
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

      // Guardar en la flash local del reloj (persistencia offline)
      saveActiveSession({
        activeDayId: this.globalData.activeDayId,
        currentSlotIndex: this.globalData.currentSlotIndex,
        currentSetIndex: this.globalData.currentSetIndex,
        sessionStartTime: this.globalData.sessionStartTime,
        sessionLoggedSets: this.globalData.sessionLoggedSets,
        slotExOverrides: this.globalData.slotExOverrides
      })

      // Notificar al smartphone por BLE -> Side Service -> WebApp
      notifySetCompleted(this, slotId, setIndex, kg, reps)
    },

    finishWorkout() {
      const day = ROUTINE_SLOTS[this.globalData.activeDayId]
      const durationMinutes = Math.round((Date.now() - (this.globalData.sessionStartTime || Date.now())) / 60000)

      const sessionSummary = {
        date: new Date().toISOString(),
        dayId: this.globalData.activeDayId,
        dayName: day ? day.title : 'Entrenamiento',
        durationMinutes: Math.max(1, durationMinutes),
        exercises: []
      }

      if (day && day.slots) {
        day.slots.forEach(slot => {
          const exId = this.globalData.slotExOverrides[slot.slotId] || slot.defaultExId
          const ex = EXERCISE_CATALOG[exId]
          const sets = this.globalData.sessionLoggedSets[slot.slotId] || []
          if (sets.length > 0) {
            sessionSummary.exercises.push({
              exId: exId,
              name: ex ? ex.name : slot.defaultExId,
              sets: sets.filter(s => s && s.completed)
            })
          }
        })
      }

      // Guardar en el historial local del reloj
      recordCompletedSession(sessionSummary)
      this.globalData.activeDayId = null
      clearActiveSession()

      // Notificar fin de entreno al smartphone
      notifyWorkoutFinished(this, sessionSummary)

      return sessionSummary
    }
  })
)
