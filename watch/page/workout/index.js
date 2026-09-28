/**
 * VigorexiApp Watch - Pantalla Principal de Serie Activa (Round 466x466)
 * "Glance & Tap" optimizado para entrenamiento de fuerza
 */

import * as hmUI from '@zos/ui'
import { push, replace } from '@zos/router'
import { HeartRate } from '@zos/sensor'
import { pauseDropWristScreenOff, resetDropWristScreenOff, pausePalmScreenOff, resetPalmScreenOff, setPageBrightTime, resetPageBrightTime } from '@zos/display'
import { BasePage } from '@zeppos/zml/base-page'
import { ROUTINE_SLOTS } from '../../utils/routine_data'
import { vibrateShort } from '../../utils/haptics'

Page(BasePage({
  state: {
    app: null,
    heartRateSensor: null,
    hrWidget: null,
    timerWidget: null,
    kgWidget: null,
    repsWidget: null,
    currentKg: 80,
    currentReps: 8,
    stepKg: 2.5,
    tickerTimer: null
  },

  onInit() {
    this.state.app = getApp()
    this.keepScreenAwake()
    this.initCurrentValues()
  },

  initCurrentValues() {
    const app = this.state.app
    const slot = app.getActiveSlot()
    const ex = app.getActiveExercise()

    this.state.stepKg = (ex && ex.stepKg) ? ex.stepKg : 2.5

    // Si ya hay series guardadas en esta sesión para este slot, cargar la actual
    const logged = app.globalData.sessionLoggedSets[slot.slotId]
    if (logged && logged[app.globalData.currentSetIndex]) {
      this.state.currentKg = logged[app.globalData.currentSetIndex].kg
      this.state.currentReps = logged[app.globalData.currentSetIndex].reps
    } else {
      // Cargar peso del último set realizado en este slot si existe
      let lastLoggedSet = null
      if (logged && logged.length > 0) {
        for (let i = logged.length - 1; i >= 0; i--) {
          if (logged[i] && logged[i].completed) {
            lastLoggedSet = logged[i]
            break
          }
        }
      }

      if (lastLoggedSet) {
        this.state.currentKg = lastLoggedSet.kg
        this.state.currentReps = lastLoggedSet.reps
      } else {
        // Cargar peso y reps por defecto de la rutina
        const defaultSet = (slot.sets && slot.sets[app.globalData.currentSetIndex]) || ["60", "10"]
        this.state.currentKg = parseFloat(defaultSet[0]) || 60
        this.state.currentReps = parseInt(defaultSet[1], 10) || 10
      }
    }
  },

  build() {
    const app = this.state.app
    const day = ROUTINE_SLOTS[app.globalData.activeDayId]
    const slot = app.getActiveSlot()
    const ex = app.getActiveExercise()

    if (!slot || !day) {
      push({ url: 'page/day_select/index' })
      return
    }

    const currentSlotNum = app.globalData.currentSlotIndex + 1
    const totalSlots = day.slots.length
    const currentSetNum = app.globalData.currentSetIndex + 1
    const totalSets = (slot.sets && slot.sets.length) || 4

    // 1. BARRA SUPERIOR (Pulsaciones, Duración, Slot #)
    this.state.hrWidget = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 45,
      y: 35,
      w: 110,
      h: 24,
      color: 0xf43f5e, // Rose red
      text_size: 16,
      align_h: hmUI.align.LEFT,
      align_v: hmUI.align.CENTER_V,
      text: '❤️ --'
    })

    // Ticker duración entreno / descanso activo
    const elapsedMinutes = Math.floor((Date.now() - (app.globalData.sessionStartTime || Date.now())) / 60000)
    const isResting = app.globalData.restTimer && app.globalData.restTimer.active
    this.state.timerWidget = hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 148,
      y: 28,
      w: 170,
      h: 36,
      radius: 18,
      normal_color: isResting ? 0x1e293b : 0x0f172a,
      press_color: 0x334155,
      color: isResting ? 0xfbbf24 : 0x94a3b8,
      text_size: 15,
      text: isResting ? '⏳ Descanso' : `⏱️ ${elapsedMinutes}m`,
      click_func: () => {
        vibrateShort()
        const rt = app.globalData.restTimer
        if (rt && rt.active) {
          push({ url: 'page/timer/index' })
        }
      }
    })

    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 310,
      y: 35,
      w: 110,
      h: 24,
      color: 0x38bdf8, // Cyan
      text_size: 16,
      align_h: hmUI.align.RIGHT,
      align_v: hmUI.align.CENTER_V,
      text: `Ej ${currentSlotNum}/${totalSlots}`
    })

    // 2. NOMBRE DEL EJERCICIO Y SERIE
    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 40,
      y: 65,
      w: 386,
      h: 36,
      color: 0xfbbf24, // Gold / Amber
      text_size: 22,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: ex ? ex.name : 'Ejercicio'
    })

    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 40,
      y: 98,
      w: 386,
      h: 26,
      color: 0x38bdf8, // Cyan
      text_size: 16,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: `SERIE ${currentSetNum} DE ${totalSets}`
    })

    // 3. CONTROL DE KILOS ( [-]  80.0 kg  [+] )
    const rowKgY = 132
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 75,
      y: rowKgY,
      w: 52,
      h: 52,
      radius: 26,
      normal_color: 0x1e293b,
      press_color: 0x334155,
      color: 0xffffff,
      text_size: 26,
      text: '-',
      click_func: () => {
        vibrateShort()
        this.adjustKg(-this.state.stepKg)
      }
    })

    this.state.kgWidget = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 135,
      y: rowKgY,
      w: 196,
      h: 52,
      color: 0xffffff,
      text_size: 28,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: `${this.state.currentKg.toFixed(1)} kg`
    })

    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 339,
      y: rowKgY,
      w: 52,
      h: 52,
      radius: 26,
      normal_color: 0x1e293b,
      press_color: 0x334155,
      color: 0xffffff,
      text_size: 26,
      text: '+',
      click_func: () => {
        vibrateShort()
        this.adjustKg(this.state.stepKg)
      }
    })

    // 4. CONTROL DE REPETICIONES ( [-]  8 reps  [+] )
    const rowRepsY = 196
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 75,
      y: rowRepsY,
      w: 52,
      h: 52,
      radius: 26,
      normal_color: 0x1e293b,
      press_color: 0x334155,
      color: 0xffffff,
      text_size: 26,
      text: '-',
      click_func: () => {
        vibrateShort()
        this.adjustReps(-1)
      }
    })

    this.state.repsWidget = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 135,
      y: rowRepsY,
      w: 196,
      h: 52,
      color: 0xffffff,
      text_size: 28,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: `${this.state.currentReps} reps`
    })

    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 339,
      y: rowRepsY,
      w: 52,
      h: 52,
      radius: 26,
      normal_color: 0x1e293b,
      press_color: 0x334155,
      color: 0xffffff,
      text_size: 26,
      text: '+',
      click_func: () => {
        vibrateShort()
        this.adjustReps(1)
      }
    })

    // 5. BOTÓN PRINCIPAL: COMPLETAR SERIE (Grande y accesible)
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 65,
      y: 262,
      w: 336,
      h: 56,
      radius: 28,
      normal_color: 0x10b981, // Emerald green
      press_color: 0x059669,
      color: 0xffffff,
      text_size: 19,
      text: '✓ COMPLETAR SERIE',
      click_func: () => {
        this.completeCurrentSet()
      }
    })

    // 6. ACCIONES SECUNDARIAS INFERIORES: ALTERNATIVAS & SIGUIENTE / FIN
    const bottomY = 330
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 65,
      y: bottomY,
      w: 160,
      h: 46,
      radius: 23,
      normal_color: 0x1e293b,
      press_color: 0x334155,
      color: 0xfbbf24,
      text_size: 15,
      text: '⇄ Alternativas',
      click_func: () => {
        vibrateShort()
        push({ url: 'page/alternatives/index' })
      }
    })

    const isLastExercise = currentSlotNum >= totalSlots && currentSetNum >= totalSets
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 241,
      y: bottomY,
      w: 160,
      h: 46,
      radius: 23,
      normal_color: isLastExercise ? 0xef4444 : 0x1e293b,
      press_color: 0x334155,
      color: 0xf8fafc,
      text_size: 15,
      text: isLastExercise ? '🏁 Fin Entreno' : 'Saltar Ej. ➔',
      click_func: () => {
        vibrateShort()
        if (isLastExercise) {
          app.finishWorkout()
          replace({ url: 'page/summary/index' })
        } else {
          this.advanceToNextExercise()
        }
      }
    })

    // Iniciar sensor de frecuencia cardíaca y ticker de descanso/entreno
    this.startHeartRateMonitor()
    this.startWorkoutTicker()
  },

  adjustKg(delta) {
    this.state.currentKg = Math.max(0, Math.round((this.state.currentKg + delta) * 10) / 10)
    if (this.state.kgWidget) {
      this.state.kgWidget.setProperty(hmUI.prop.TEXT, `${this.state.currentKg.toFixed(1)} kg`)
    }
  },

  adjustReps(delta) {
    this.state.currentReps = Math.max(1, this.state.currentReps + delta)
    if (this.state.repsWidget) {
      this.state.repsWidget.setProperty(hmUI.prop.TEXT, `${this.state.currentReps} reps`)
    }
  },

  startWorkoutTicker() {
    this.stopWorkoutTicker()
    this.updateTimerDisplay()
    let tickCount = 0
    this.state.tickerTimer = setInterval(() => {
      this.updateTimerDisplay()
      tickCount++
      if (tickCount % 5 === 0) {
        this.syncWithPhoneInBackground()
      }
    }, 1000)
  },

  stopWorkoutTicker() {
    if (this.state.tickerTimer) {
      clearInterval(this.state.tickerTimer)
      this.state.tickerTimer = null
    }
  },

  updateTimerDisplay() {
    if (!this.state.timerWidget) return
    const app = this.state.app
    const rt = app.globalData.restTimer

    if (rt && rt.active) {
      const now = Date.now()
      let rem = 0
      if (rt.endTime) {
        rem = Math.max(0, Math.round((rt.endTime - now) / 1000))
      } else if (rt.remainingSeconds > 0) {
        rt.remainingSeconds -= 1
        rem = rt.remainingSeconds
      }

      if (rem > 0) {
        const m = Math.floor(rem / 60)
        const s = rem % 60
        const str = `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`
        this.state.timerWidget.setProperty(hmUI.prop.TEXT, `⏳ ${str}`)
        this.state.timerWidget.setProperty(hmUI.prop.COLOR, 0xfbbf24) // Gold / Amber
        this.state.timerWidget.setProperty(hmUI.prop.NORMAL_COLOR, 0x1e293b)
        return
      } else {
        rt.active = false
        vibrateRestFinished()
      }
    }

    const elapsedMinutes = Math.floor((Date.now() - (app.globalData.sessionStartTime || Date.now())) / 60000)
    const syncDot = app.globalData.isPhoneSynced ? ' 🟢' : ''
    this.state.timerWidget.setProperty(hmUI.prop.TEXT, `⏱️ ${elapsedMinutes}m${syncDot}`)
    this.state.timerWidget.setProperty(hmUI.prop.COLOR, 0x94a3b8)
    this.state.timerWidget.setProperty(hmUI.prop.NORMAL_COLOR, 0x0f172a)
  },

  async syncWithPhoneInBackground() {
    const app = this.state.app
    try {
      await app.checkPhoneLiveSession()
      const phoneSession = app.globalData.phoneLiveSession
      if (!phoneSession || !phoneSession.activeDayId) return

      if (phoneSession.activeDayId === app.globalData.activeDayId) {
        const phoneSlot = phoneSession.currentSlotIndex || 0
        const phoneSet = phoneSession.currentSetIndex || 0
        if (phoneSlot !== app.globalData.currentSlotIndex || phoneSet !== app.globalData.currentSetIndex) {
          app.adoptPhoneSession(phoneSession)
          replace({ url: 'page/workout/index' })
          return
        }

        if (phoneSession.restTimer && phoneSession.restTimer.active) {
          const rt = phoneSession.restTimer
          const now = Date.now()
          if (rt.endTime && rt.endTime > now) {
            const rem = Math.max(0, Math.round((rt.endTime - now) / 1000))
            const ex = app.getActiveExercise()
            app.globalData.restTimer = {
              active: true,
              endTime: rt.endTime,
              remainingSeconds: rem,
              totalSeconds: rt.duration || 90,
              nextExerciseName: ex ? ex.name : '',
              nextSetNum: (app.globalData.currentSetIndex || 0) + 1
            }
          }
        }
      }
    } catch (e) {}
  },

  completeCurrentSet() {
    vibrateShort()
    const app = this.state.app
    const slot = app.getActiveSlot()
    const ex = app.getActiveExercise()
    const day = ROUTINE_SLOTS[app.globalData.activeDayId]

    // Registrar serie en la memoria de la sesión
    app.recordSet(slot.slotId, app.globalData.currentSetIndex, this.state.currentKg, this.state.currentReps)

    const totalSetsInSlot = (slot.sets && slot.sets.length) || 4
    const restDuration = (ex && ex.rest) ? ex.rest : 90

    // Avanzar contador de series
    if (app.globalData.currentSetIndex + 1 < totalSetsInSlot) {
      app.globalData.currentSetIndex += 1
      app.globalData.restTimer = {
        active: true,
        endTime: Date.now() + restDuration * 1000,
        remainingSeconds: restDuration,
        totalSeconds: restDuration,
        nextExerciseName: ex ? ex.name : '',
        nextSetNum: app.globalData.currentSetIndex + 1
      }
    } else {
      // Pasamos al siguiente ejercicio
      if (app.globalData.currentSlotIndex + 1 < day.slots.length) {
        app.globalData.currentSlotIndex += 1
        app.globalData.currentSetIndex = 0
        const nextSlot = app.getActiveSlot()
        const nextEx = app.getActiveExercise()
        app.globalData.restTimer = {
          active: true,
          endTime: Date.now() + restDuration * 1000,
          remainingSeconds: restDuration,
          totalSeconds: restDuration,
          nextExerciseName: nextEx ? nextEx.name : '',
          nextSetNum: 1
        }
      } else {
        // Fin del entrenamiento
        app.finishWorkout()
        replace({ url: 'page/summary/index' })
        return
      }
    }

    // Saltar automáticamente a la pantalla del temporizador de descanso
    replace({ url: 'page/timer/index' })
  },

  advanceToNextExercise() {
    const app = this.state.app
    const day = ROUTINE_SLOTS[app.globalData.activeDayId]
    if (app.globalData.currentSlotIndex + 1 < day.slots.length) {
      app.globalData.currentSlotIndex += 1
      app.globalData.currentSetIndex = 0
      replace({ url: 'page/workout/index' })
    } else {
      app.finishWorkout()
      replace({ url: 'page/summary/index' })
    }
  },

  startHeartRateMonitor() {
    try {
      this.state.heartRateSensor = new HeartRate()
      const current = this.state.heartRateSensor.getLast()
      if (current && this.state.hrWidget) {
        this.state.hrWidget.setProperty(hmUI.prop.TEXT, `❤️ ${current}`)
      }
      this.state.heartRateSensor.onCurrentChange(() => {
        const bpm = this.state.heartRateSensor.getCurrent()
        if (this.state.hrWidget && bpm > 0) {
          this.state.hrWidget.setProperty(hmUI.prop.TEXT, `❤️ ${bpm}`)
        }
      })
    } catch (e) {
      console.log('[Workout] Sensor de pulso no disponible:', e)
    }
  },

  keepScreenAwake() {
    try {
      pauseDropWristScreenOff({ duration: 0 })
      pausePalmScreenOff({ duration: 0 })
      setPageBrightTime({ brightTime: 1800000 })
    } catch (e) {
      console.log('[Workout] Display keep screen awake no disponible:', e)
    }
  },

  releaseScreenAwake() {
    try {
      resetDropWristScreenOff()
      resetPalmScreenOff()
      resetPageBrightTime()
    } catch (e) {}
  },

  onDestroy() {
    this.stopWorkoutTicker()
    this.releaseScreenAwake()
    if (this.state.heartRateSensor) {
      try {
        this.state.heartRateSensor.offCurrentChange()
      } catch (e) {}
    }
  }
}))
