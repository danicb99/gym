/**
 * VigorexiApp Watch - Pantalla Principal de Serie Activa (Round 466x466)
 * "Glance & Tap" optimizado para entrenamiento de fuerza
 */

import * as hmUI from '@zos/ui'
import { push, replace } from '@zos/router'
import { HeartRate } from '@zos/sensor'
import { keepScreenActive, restoreScreenBehavior } from '../../utils/display'
import { BasePage } from '@zeppos/zml/base-page'
import { ROUTINE_SLOTS } from '../../utils/routine_data'
import { THEME_COLORS } from '../../utils/theme'
import { vibrateShort, vibrateRestFinished, vibratePreWarning } from '../../utils/haptics'

function countCompletedSets(sessionLoggedSets) {
  if (!sessionLoggedSets) return 0
  let count = 0
  for (const slotId in sessionLoggedSets) {
    const list = sessionLoggedSets[slotId]
    if (Array.isArray(list)) {
      for (let i = 0; i < list.length; i++) {
        if (list[i] && list[i].completed) count++
      }
    }
  }
  return count
}

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
    tickerTimer: null,
    plankTimer: null,
    isPlankRunning: false,
    cronoBtnWidget: null,
    restPreWarned: false
  },

  onInit() {
    this.state.app = getApp()
    if (this.state.app && typeof this.state.app.flushPendingOutbox === 'function') {
      this.state.app.flushPendingOutbox()
    }
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
      // Prioridad: Cargar peso y reps de la marca anterior (previousSets) para esta serie específica
      let loadedKg = null
      let loadedReps = null
      if (app.globalData.previousSets && ex) {
        const exPrev = app.globalData.previousSets[ex.id]
        if (exPrev) {
          let prevStr = exPrev[app.globalData.currentSetIndex]
          if (!prevStr && app.globalData.currentSetIndex > 0) {
            for (let s = app.globalData.currentSetIndex - 1; s >= 0; s--) {
              if (exPrev[s]) {
                prevStr = exPrev[s]
                break
              }
            }
          }
          if (prevStr) {
            const str = String(prevStr).trim()
            const mSec = str.match(/^(\d+)\s*(?:s|seg)$/i)
            if (mSec) {
              loadedKg = 0
              loadedReps = parseInt(mSec[1], 10)
            } else {
              const m = str.match(/^(?:\+?([\d\.]+)\s*(?:kg)?\s*[×xX]\s*)?(\d+)\s*(?:s|seg|reps?)?$/i)
              if (m) {
                if (m[1] !== undefined) loadedKg = parseFloat(m[1])
                if (m[2] !== undefined) loadedReps = parseInt(m[2], 10)
              }
            }
          }
        }
      }

      if (loadedKg !== null && loadedReps !== null) {
        this.state.currentKg = loadedKg
        this.state.currentReps = loadedReps
      } else {
        // Si no hay marca de la sesión anterior, recurrir al último set realizado en este slot
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
          // Si no hay set previo ni marca anterior, cargar por defecto de la rutina
          const isBodyweightOrIso = ex && (ex.metricType === 'peso_corporal' || ex.metricType === 'isometria')
          const defaultSet = (slot.sets && slot.sets[app.globalData.currentSetIndex]) || ["60", "10"]
          const fallbackKg = isBodyweightOrIso ? 0 : (parseFloat(defaultSet[0]) || 60)
          this.state.currentKg = loadedKg !== null ? loadedKg : fallbackKg
          this.state.currentReps = loadedReps !== null ? loadedReps : (parseInt(defaultSet[1], 10) || 10)
        }
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

    // 0. ANILLO PERIMETRAL DE PROGRESO DE LA SESIÓN
    let totalDaySets = 0
    if (day && day.slots) {
      day.slots.forEach(s => {
        totalDaySets += (s.sets ? s.sets.length : 3)
      })
    }
    const completedSets = countCompletedSets(app.globalData.sessionLoggedSets)
    const progressRatio = totalDaySets > 0 ? Math.min(1, completedSets / totalDaySets) : 0
    const sweepAngle = Math.round(progressRatio * 360)

    // Pista base del anillo
    hmUI.createWidget(hmUI.widget.ARC, {
      x: 8,
      y: 8,
      w: 450,
      h: 450,
      start_angle: -90,
      end_angle: 270,
      color: THEME_COLORS.ringTrack,
      line_width: 8
    })

    // Arco de avance
    if (sweepAngle > 0) {
      hmUI.createWidget(hmUI.widget.ARC, {
        x: 8,
        y: 8,
        w: 450,
        h: 450,
        start_angle: -90,
        end_angle: -90 + sweepAngle,
        color: progressRatio >= 1 ? THEME_COLORS.emerald : THEME_COLORS.accentBlue,
        line_width: 8
      })
    }

    // 1. CHIP SUPERIOR DE ESTADO Y SINCRONIZACIÓN
    const elapsedMinutes = Math.floor((Date.now() - (app.globalData.sessionStartTime || Date.now())) / 60000)
    const isResting = app.globalData.restTimer && app.globalData.restTimer.active
    const initialSync = app.getSyncStatus ? app.getSyncStatus() : { text: 'ok', color: THEME_COLORS.emerald }
    const syncText = initialSync.text ? ` • ${initialSync.text}` : ''

    this.state.timerWidget = hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 133,
      y: 18,
      w: 200,
      h: 34,
      radius: 17,
      normal_color: THEME_COLORS.surfaceSubtle,
      press_color: THEME_COLORS.stepperBg,
      color: isResting ? THEME_COLORS.timerAmber : (initialSync.color || THEME_COLORS.textMuted),
      text_size: 13,
      text: isResting ? `Descanso${syncText}` : `${elapsedMinutes}m${syncText}`,
      click_func: () => {
        const rt = app.globalData.restTimer
        if (rt && rt.active) {
          push({ url: 'page/timer/index' })
        }
      }
    })

    this.state.hrWidget = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 48,
      y: 18,
      w: 80,
      h: 34,
      color: THEME_COLORS.roseHeart,
      text_size: 15,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: '❤️ --'
    })

    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 338,
      y: 18,
      w: 80,
      h: 34,
      color: THEME_COLORS.cyan,
      text_size: 15,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: `Ej ${currentSlotNum}/${totalSlots}`
    })

    // 2. NOMBRE DEL EJERCICIO Y SERIE
    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 50,
      y: 60,
      w: 366,
      h: 34,
      color: THEME_COLORS.gold,
      text_size: 24,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: ex ? ex.name : 'Ejercicio'
    })

    let prevText = ''
    if (app.globalData.previousSets && ex) {
      const exPrev = app.globalData.previousSets[ex.id]
      if (exPrev) {
        let prevVal = exPrev[app.globalData.currentSetIndex]
        if (!prevVal && app.globalData.currentSetIndex > 0) {
          for (let s = app.globalData.currentSetIndex - 1; s >= 0; s--) {
            if (exPrev[s]) {
              prevVal = exPrev[s]
              break
            }
          }
        }
        if (prevVal) {
          prevText = ` • Ant. ${prevVal}`
        }
      }
    }

    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 50,
      y: 94,
      w: 366,
      h: 26,
      color: THEME_COLORS.cyan,
      text_size: 16,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: `Serie ${currentSetNum} de ${totalSets}${prevText}`
    })

    // 3. FILA 1: KILOS ( [-]  80.0 kg  [+] ) CON STEPPERS GRANDES DE 68px
    const rowKgY = 130
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 52,
      y: rowKgY,
      w: 68,
      h: 68,
      radius: 34,
      normal_color: THEME_COLORS.stepperBg,
      press_color: THEME_COLORS.stepperPress,
      color: THEME_COLORS.textMain,
      text_size: 34,
      text: '-',
      click_func: () => {
        this.adjustKg(-this.state.stepKg)
      }
    })

    this.state.kgWidget = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 126,
      y: rowKgY,
      w: 214,
      h: 68,
      color: THEME_COLORS.textMain,
      text_size: 38,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: this.getKgDisplayStr()
    })

    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 346,
      y: rowKgY,
      w: 68,
      h: 68,
      radius: 34,
      normal_color: THEME_COLORS.stepperBg,
      press_color: THEME_COLORS.stepperPress,
      color: THEME_COLORS.textMain,
      text_size: 34,
      text: '+',
      click_func: () => {
        this.adjustKg(this.state.stepKg)
      }
    })

    // 4. FILA 2: REPETICIONES / SEGUNDOS ( [-]  8 reps  [+] ) CON STEPPERS GRANDES DE 68px
    const rowRepsY = 212
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 52,
      y: rowRepsY,
      w: 68,
      h: 68,
      radius: 34,
      normal_color: THEME_COLORS.stepperBg,
      press_color: THEME_COLORS.stepperPress,
      color: THEME_COLORS.textMain,
      text_size: 34,
      text: '-',
      click_func: () => {
        this.adjustReps(-1)
      }
    })

    this.state.repsWidget = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 126,
      y: rowRepsY,
      w: 214,
      h: 68,
      color: THEME_COLORS.textMain,
      text_size: 38,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: this.getRepsDisplayStr()
    })

    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 346,
      y: rowRepsY,
      w: 68,
      h: 68,
      radius: 34,
      normal_color: THEME_COLORS.stepperBg,
      press_color: THEME_COLORS.stepperPress,
      color: THEME_COLORS.textMain,
      text_size: 34,
      text: '+',
      click_func: () => {
        this.adjustReps(1)
      }
    })

    // 5. BOTÓN PRINCIPAL DE ACCIÓN: "✓ Hecha"
    const isIso = ex && ex.metricType === 'isometria'
    if (isIso) {
      this.state.cronoBtnWidget = hmUI.createWidget(hmUI.widget.BUTTON, {
        x: 58,
        y: 298,
        w: 168,
        h: 64,
        radius: 32,
        normal_color: THEME_COLORS.indigoPlank,
        press_color: 0x4f46e5,
        color: 0xffffff,
        text_size: 19,
        text: '⏱️ CRONO',
        click_func: () => {
          this.togglePlankTimer()
        }
      })

      hmUI.createWidget(hmUI.widget.BUTTON, {
        x: 240,
        y: 298,
        w: 168,
        h: 64,
        radius: 32,
        normal_color: THEME_COLORS.emerald,
        press_color: THEME_COLORS.emeraldDark,
        color: THEME_COLORS.textDark,
        text_size: 20,
        text: '✓ GUARDAR',
        click_func: () => {
          this.stopPlankTimer()
          this.completeCurrentSet()
        }
      })
    } else {
      hmUI.createWidget(hmUI.widget.BUTTON, {
        x: 103,
        y: 298,
        w: 260,
        h: 64,
        radius: 32,
        normal_color: THEME_COLORS.emerald,
        press_color: THEME_COLORS.emeraldDark,
        color: THEME_COLORS.textDark,
        text_size: 24,
        text: '✓ Hecha',
        click_func: () => {
          this.completeCurrentSet()
        }
      })
    }

    // 6. HORA ACTUAL INFERIOR
    this.state.clockWidget = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 133,
      y: 374,
      w: 200,
      h: 28,
      color: THEME_COLORS.textMuted,
      text_size: 20,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: this.getClockStr()
    })

    // 7. BOTÓN INFERIOR: MENÚ
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 173,
      y: 406,
      w: 120,
      h: 36,
      radius: 18,
      normal_color: THEME_COLORS.surfaceSubtle,
      press_color: THEME_COLORS.stepperPress,
      color: THEME_COLORS.cyan,
      text_size: 14,
      text: 'Menú',
      click_func: () => {
        push({ url: 'page/options/index' })
      }
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

  getKgDisplayStr() {
    const ex = this.state.app.getActiveExercise()
    const isBodyweight = ex && (ex.metricType === 'peso_corporal' || ex.metricType === 'isometria')
    if (isBodyweight) {
      return this.state.currentKg > 0 ? `+${this.state.currentKg.toFixed(1)} kg` : '+0.0 kg'
    }
    return `${this.state.currentKg.toFixed(1)} kg`
  },

  getRepsDisplayStr() {
    const ex = this.state.app.getActiveExercise()
    if (ex && ex.metricType === 'isometria') {
      return `${this.state.currentReps} seg`
    }
    if (ex && ex.metricType === 'unilateral') {
      return `${this.state.currentReps} /lado`
    }
    return `${this.state.currentReps} reps`
  },

  adjustKg(delta) {
    this.state.currentKg = Math.max(0, Math.round((this.state.currentKg + delta) * 10) / 10)
    if (this.state.kgWidget) {
      this.state.kgWidget.setProperty(hmUI.prop.TEXT, this.getKgDisplayStr())
    }
  },

  adjustReps(delta) {
    const ex = this.state.app.getActiveExercise()
    const isIso = ex && ex.metricType === 'isometria'
    const step = isIso ? 5 : 1
    const minVal = isIso ? 5 : 1
    this.state.currentReps = Math.max(minVal, this.state.currentReps + (delta * step))
    if (this.state.repsWidget) {
      this.state.repsWidget.setProperty(hmUI.prop.TEXT, this.getRepsDisplayStr())
    }
  },

  togglePlankTimer() {
    if (this.state.isPlankRunning) {
      this.stopPlankTimer()
      vibrateShort()
    } else {
      vibrateShort()
      this.state.isPlankRunning = true
      keepScreenActive(180000)
      if (this.state.cronoBtnWidget) {
        this.state.cronoBtnWidget.setProperty(hmUI.prop.TEXT, '⏹ PARAR')
        this.state.cronoBtnWidget.setProperty(hmUI.prop.NORMAL_COLOR, 0xef4444)
      }
      this.state.currentReps = 0
      if (this.state.repsWidget) {
        this.state.repsWidget.setProperty(hmUI.prop.TEXT, this.getRepsDisplayStr())
      }
      this.state.plankTimer = setInterval(() => {
        this.state.currentReps++
        if (this.state.repsWidget) {
          this.state.repsWidget.setProperty(hmUI.prop.TEXT, this.getRepsDisplayStr())
        }
      }, 1000)
    }
  },

  stopPlankTimer() {
    if (this.state.plankTimer) {
      clearInterval(this.state.plankTimer)
      this.state.plankTimer = null
    }
    this.state.isPlankRunning = false
    if (this.state.cronoBtnWidget) {
      this.state.cronoBtnWidget.setProperty(hmUI.prop.TEXT, '⏱️ CRONO')
      this.state.cronoBtnWidget.setProperty(hmUI.prop.NORMAL_COLOR, 0x6366f1)
    }
  },

  startWorkoutTicker() {
    this.stopWorkoutTicker()
    this.updateTimerDisplay()
    this.updateClockDisplay()
    this.state.tickerTimer = setInterval(() => {
      this.updateTimerDisplay()
      this.updateClockDisplay()
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
    const syncStatus = app.getSyncStatus ? app.getSyncStatus() : { text: 'ok', color: 0x94a3b8 }
    const statusLabel = syncStatus.text ? ` ${syncStatus.text}` : ''

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
        this.state.timerWidget.setProperty(hmUI.prop.TEXT, `⏳ ${str}${statusLabel}`)
        this.state.timerWidget.setProperty(hmUI.prop.COLOR, 0xfbbf24) // Gold / Amber
        this.state.timerWidget.setProperty(hmUI.prop.NORMAL_COLOR, 0x1e293b)

        if (rem === 10 && !this.state.restPreWarned) {
          this.state.restPreWarned = true
          vibratePreWarning()
        }
        return
      } else {
        rt.active = false
        this.state.restPreWarned = false
        vibrateRestFinished()
        // Al terminar el descanso: consultar bajo demanda con el móvil respetando throttle de 60s
        this.checkPhoneSyncOnDemand(false)
      }
    }

    const elapsedMinutes = Math.floor((Date.now() - (app.globalData.sessionStartTime || Date.now())) / 60000)
    this.state.timerWidget.setProperty(hmUI.prop.TEXT, `⏱️ ${elapsedMinutes}m${statusLabel}`)
    this.state.timerWidget.setProperty(hmUI.prop.COLOR, syncStatus.color || 0x94a3b8)
    this.state.timerWidget.setProperty(hmUI.prop.NORMAL_COLOR, 0x0f172a)
  },

  // Consulta bajo demanda sin recargar la pantalla ni perder inputs en edición (prohibido replace)
  async checkPhoneSyncOnDemand(force = false) {
    const app = this.state.app
    try {
      const phoneSession = await app.checkPhoneLiveSession(force)
      if (!phoneSession || !phoneSession.activeDayId) return
      if (phoneSession.activeDayId === app.globalData.activeDayId) {
        app.mergePhoneSession(phoneSession)
        this.updateTimerDisplay()
      }
    } catch (e) {
      console.log('[Workout] Error en sincronización bajo demanda:', e)
    }
  },

  completeCurrentSet() {
    this.stopPlankTimer()
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
          const app = this.state.app
          if (app && app.globalData) {
            if (!app.globalData.hrHistory) app.globalData.hrHistory = []
            app.globalData.hrHistory.push(bpm)
            if (!app.globalData.hrMax || bpm > app.globalData.hrMax) {
              app.globalData.hrMax = bpm
            }
          }
        }
      })
    } catch (e) {
      console.log('[Workout] Sensor de pulso no disponible:', e)
    }
  },

  onResume() {
    this.enableWakeUpRelaunch()
    this.updateClockDisplay()
    this.updateTimerDisplay()
    this.checkPhoneSyncOnDemand(false)
    if (this.state.app && typeof this.state.app.flushPendingOutbox === 'function') {
      this.state.app.flushPendingOutbox()
    }
  },

  enableWakeUpRelaunch() {
    keepScreenActive(45000)
  },

  disableWakeUpRelaunch() {
    restoreScreenBehavior()
  },

  onDestroy() {
    this.stopPlankTimer()
    this.stopWorkoutTicker()
    this.disableWakeUpRelaunch()
    if (this.state.heartRateSensor) {
      try {
        this.state.heartRateSensor.offCurrentChange()
      } catch (e) {}
    }
  }
}))
