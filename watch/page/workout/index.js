/**
 * VigorexiApp Watch - Pantalla Principal de Serie Activa (Round 466x466)
 * "Glance & Tap" optimizado para entrenamiento de fuerza
 */

import * as hmUI from '@zos/ui'
import { push, replace } from '@zos/router'
import { HeartRate } from '@zos/sensor'
import { setWakeUpRelaunch, resetWakeUpRelaunch } from '@zos/display'
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
    clockWidget: null,
    currentKg: 80,
    currentReps: 8,
    stepKg: 2.5,
    tickerTimer: null
  },

  onInit() {
    this.state.app = getApp()
    this.enableWakeUpRelaunch()
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
    const totalSets = app.getTotalSetsForSlot ? app.getTotalSetsForSlot(slot) : ((slot.sets && slot.sets.length) || 4)

    // 1. BARRA SUPERIOR (Pulsaciones, Duración, Botón Menú Ajustes ⚙️)
    this.state.hrWidget = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 48,
      y: 28,
      w: 96,
      h: 34,
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
      y: 24,
      w: 168,
      h: 38,
      radius: 19,
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

    // Botón de Menú / Ajustes (Opción A: arriba a la derecha)
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 324,
      y: 24,
      w: 50,
      h: 38,
      radius: 19,
      normal_color: 0x1e293b,
      press_color: 0x334155,
      color: 0xfbbf24,
      text_size: 20,
      text: '⚙️',
      click_func: () => {
        vibrateShort()
        push({ url: 'page/options/index' })
      }
    })

    // 2. NOMBRE DEL EJERCICIO Y SERIE (Texto grande y claro)
    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 38,
      y: 66,
      w: 390,
      h: 34,
      color: 0xfbbf24, // Gold / Amber
      text_size: 23,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: ex ? ex.name : 'Ejercicio'
    })

    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 38,
      y: 100,
      w: 390,
      h: 26,
      color: 0x38bdf8, // Cyan
      text_size: 16,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: `SERIE ${currentSetNum} DE ${totalSets} • Ej ${currentSlotNum}/${totalSlots}`
    })

    // 3. CONTROL DE KILOS ( [-]  80.0 kg  [+] ) - TAMAÑO XL
    const rowKgY = 136
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 60,
      y: rowKgY,
      w: 60,
      h: 58,
      radius: 29,
      normal_color: 0x1e293b,
      press_color: 0x334155,
      color: 0xffffff,
      text_size: 32,
      text: '-',
      click_func: () => {
        vibrateShort()
        this.adjustKg(-this.state.stepKg)
      }
    })

    this.state.kgWidget = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 125,
      y: rowKgY,
      w: 216,
      h: 58,
      color: 0xffffff,
      text_size: 36,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: `${this.state.currentKg.toFixed(1)} kg`
    })

    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 346,
      y: rowKgY,
      w: 60,
      h: 58,
      radius: 29,
      normal_color: 0x1e293b,
      press_color: 0x334155,
      color: 0xffffff,
      text_size: 32,
      text: '+',
      click_func: () => {
        vibrateShort()
        this.adjustKg(this.state.stepKg)
      }
    })

    // 4. CONTROL DE REPETICIONES ( [-]  8 reps  [+] ) - TAMAÑO XL
    const rowRepsY = 206
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 60,
      y: rowRepsY,
      w: 60,
      h: 58,
      radius: 29,
      normal_color: 0x1e293b,
      press_color: 0x334155,
      color: 0xffffff,
      text_size: 32,
      text: '-',
      click_func: () => {
        vibrateShort()
        this.adjustReps(-1)
      }
    })

    this.state.repsWidget = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 125,
      y: rowRepsY,
      w: 216,
      h: 58,
      color: 0xffffff,
      text_size: 36,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: `${this.state.currentReps} reps`
    })

    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 346,
      y: rowRepsY,
      w: 60,
      h: 58,
      radius: 29,
      normal_color: 0x1e293b,
      press_color: 0x334155,
      color: 0xffffff,
      text_size: 32,
      text: '+',
      click_func: () => {
        vibrateShort()
        this.adjustReps(1)
      }
    })

    // 5. BOTÓN PRINCIPAL: COMPLETAR SERIE (Grande y prominente)
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 60,
      y: 280,
      w: 346,
      h: 64,
      radius: 32,
      normal_color: 0x10b981, // Emerald green
      press_color: 0x059669,
      color: 0xffffff,
      text_size: 22,
      text: '✓ COMPLETAR SERIE',
      click_func: () => {
        this.completeCurrentSet()
      }
    })

    // 6. HORA ACTUAL INFERIOR (Grande, nítida, sin emoji)
    this.state.clockWidget = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 108,
      y: 368,
      w: 250,
      h: 46,
      color: 0xf1f5f9, // Blanco suave de alto contraste
      text_size: 30,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: this.getClockStr()
    })

    // Iniciar sensor de frecuencia cardíaca y ticker de descanso/entreno
    this.startHeartRateMonitor()
    this.startWorkoutTicker()
  },

  getClockStr() {
    const now = new Date()
    const h = now.getHours()
    const m = now.getMinutes()
    const hStr = h < 10 ? '0' + h : '' + h
    const mStr = m < 10 ? '0' + m : '' + m
    return `${hStr}:${mStr}`
  },

  updateClockDisplay() {
    if (this.state.clockWidget) {
      this.state.clockWidget.setProperty(hmUI.prop.TEXT, this.getClockStr())
    }
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
    this.updateClockDisplay()
    let tickCount = 0
    this.state.tickerTimer = setInterval(() => {
      this.updateTimerDisplay()
      this.updateClockDisplay()
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

    const totalSetsInSlot = app.getTotalSetsForSlot ? app.getTotalSetsForSlot(slot) : ((slot.sets && slot.sets.length) || 4)
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

  onResume() {
    this.updateClockDisplay()
    this.updateTimerDisplay()
  },

  enableWakeUpRelaunch() {
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
      if (typeof hmApp !== 'undefined' && hmApp.setScreenKeep) {
        hmApp.setScreenKeep(true)
      }
    } catch (e3) {}
  },

  disableWakeUpRelaunch() {
    try {
      if (typeof resetWakeUpRelaunch === 'function') {
        resetWakeUpRelaunch()
      } else if (typeof setWakeUpRelaunch === 'function') {
        setWakeUpRelaunch({ relaunch: false })
      }
    } catch (e) {}
    try {
      if (typeof hmApp !== 'undefined' && hmApp.setScreenKeep) {
        hmApp.setScreenKeep(false)
      }
    } catch (e2) {}
  },

  onDestroy() {
    this.stopWorkoutTicker()
    this.disableWakeUpRelaunch()
    if (this.state.heartRateSensor) {
      try {
        this.state.heartRateSensor.offCurrentChange()
      } catch (e) {}
    }
  }
}))
