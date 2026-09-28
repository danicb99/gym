/**
 * VigorexiApp Watch - Aplicación Principal (Zepp OS)
 */

import { loadWorkoutData, saveActiveSession, clearActiveSession, recordCompletedSession } from './utils/storage'
import { ROUTINE_SLOTS, EXERCISE_CATALOG } from './utils/routine_data'

App({
  globalData: {
    activeDayId: null,
    currentSlotIndex: 0,
    currentSetIndex: 0,
    sessionStartTime: null,
    sessionLoggedSets: {},  // slotId -> [ { kg: 80, reps: 8, completed: true } ]
    slotExOverrides: {},    // slotId -> exId (sustituciones en caliente)
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
    // Restaurar sesión si existía una previa sin terminar
    const saved = loadWorkoutData()
    if (saved && saved.activeSession) {
      this.globalData.activeDayId = saved.activeSession.activeDayId
      this.globalData.currentSlotIndex = saved.activeSession.currentSlotIndex || 0
      this.globalData.currentSetIndex = saved.activeSession.currentSetIndex || 0
      this.globalData.sessionStartTime = saved.activeSession.sessionStartTime
      this.globalData.sessionLoggedSets = saved.activeSession.sessionLoggedSets || {}
      this.globalData.slotExOverrides = saved.activeSession.slotExOverrides || {}
    }
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

  startNewWorkout(dayId) {
    this.globalData.activeDayId = dayId
    this.globalData.currentSlotIndex = 0
    this.globalData.currentSetIndex = 0
    this.globalData.sessionStartTime = Date.now()
    this.globalData.sessionLoggedSets = {}
    this.globalData.slotExOverrides = {}
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

    saveActiveSession({
      activeDayId: this.globalData.activeDayId,
      currentSlotIndex: this.globalData.currentSlotIndex,
      currentSetIndex: this.globalData.currentSetIndex,
      sessionStartTime: this.globalData.sessionStartTime,
      sessionLoggedSets: this.globalData.sessionLoggedSets,
      slotExOverrides: this.globalData.slotExOverrides
    })
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

    recordCompletedSession(sessionSummary)
    this.globalData.activeDayId = null
    clearActiveSession()
    return sessionSummary
  }
})
