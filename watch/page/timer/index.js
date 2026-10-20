/**
 * VigorexiApp Watch - Temporizador de Descanso con Alarma Háptica (Round 466x466)
 */

import * as hmUI from '@zos/ui'
import { replace } from '@zos/router'
import { vibrateRestFinished, vibratePreWarning } from '../../utils/haptics'
import { keepScreenActive, restoreScreenBehavior } from '../../utils/display'
import { THEME_COLORS } from '../../utils/theme'

Page({
  state: {
    app: null,
    totalSeconds: 90,
    remainingSeconds: 90,
    digitsWidget: null,
    arcWidget: null,
    clockWidget: null,
    timerInterval: null,
    preWarned: false
  },

  onInit() {
    this.state.app = getApp()
    if (this.state.app && typeof this.state.app.flushPendingOutbox === 'function') {
      this.state.app.flushPendingOutbox()
    }
    this.enableWakeUpRelaunch()
    const timerData = this.state.app.globalData.restTimer
    this.state.totalSeconds = (timerData && timerData.totalSeconds) || 90
    if (timerData && timerData.endTime && timerData.endTime > Date.now()) {
      this.state.remainingSeconds = Math.max(0, Math.round((timerData.endTime - Date.now()) / 1000))
    } else {
      this.state.remainingSeconds = (timerData && timerData.remainingSeconds) || 90
    }
  },

  build() {
    const timerData = this.state.app.globalData.restTimer

    // 0. ANILLO PERIMETRAL DE DESCANSO
    // Pista base
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

    // Arco de cuenta atrás en ámbar brillante
    this.state.arcWidget = hmUI.createWidget(hmUI.widget.ARC, {
      x: 8,
      y: 8,
      w: 450,
      h: 450,
      start_angle: -90,
      end_angle: 270,
      color: THEME_COLORS.timerAmber,
      line_width: 8
    })

    // 1. TÍTULO SUPERIOR
    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 50,
      y: 42,
      w: 366,
      h: 26,
      color: THEME_COLORS.cyan,
      text_size: 16,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: 'DESCANSO'
    })

    // 2. PRÓXIMO EJERCICIO Y SERIE (Gold)
    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 50,
      y: 74,
      w: 366,
      h: 28,
      color: THEME_COLORS.gold,
      text_size: 19,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: timerData ? `Sigue: ${timerData.nextExerciseName}` : 'Siguiente serie lista'
    })

    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 50,
      y: 104,
      w: 366,
      h: 24,
      color: THEME_COLORS.textMuted,
      text_size: 15,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: timerData ? `Preparar Serie ${timerData.nextSetNum}` : 'Toma aire y magnesio'
    })

    // 3. DÍGITOS GIGANTES DEL CRONÓMETRO (Ámbar AMOLED, 72px)
    this.state.digitsWidget = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 50,
      y: 138,
      w: 366,
      h: 96,
      color: THEME_COLORS.timerAmber,
      text_size: 72,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: this.formatTime(this.state.remainingSeconds)
    })

    // 4. CONTROLES DE ACCIÓN RÁPIDA (+15 s y Saltar)
    const btnY = 256
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 73,
      y: btnY,
      w: 150,
      h: 62,
      radius: 31,
      normal_color: THEME_COLORS.stepperBg,
      press_color: THEME_COLORS.stepperPress,
      color: THEME_COLORS.textMain,
      text_size: 22,
      text: '+15 s',
      click_func: () => {
        this.addTime(15)
      }
    })

    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 243,
      y: btnY,
      w: 150,
      h: 62,
      radius: 31,
      normal_color: THEME_COLORS.emerald,
      press_color: THEME_COLORS.emeraldDark,
      color: THEME_COLORS.textDark,
      text_size: 22,
      text: 'Saltar',
      click_func: () => {
        this.finishRest()
      }
    })

    // 5. AVISO HÁPTICO
    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 50,
      y: 336,
      w: 366,
      h: 22,
      color: THEME_COLORS.textDim,
      text_size: 13,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: 'Vibración a los 10 s y al terminar'
    })

    // 6. RELOJ INFERIOR
    this.state.clockWidget = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 133,
      y: 368,
      w: 200,
      h: 32,
      color: THEME_COLORS.textMuted,
      text_size: 22,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: this.getClockStr()
    })

    // Iniciar cuenta atrás
    this.startCountdown()
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

  formatTime(totalSec) {
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    const mStr = m < 10 ? `0${m}` : `${m}`
    const sStr = s < 10 ? `0${s}` : `${s}`
    return `${mStr}:${sStr}`
  },

  addTime(seconds) {
    this.state.remainingSeconds += seconds
    this.state.totalSeconds = Math.max(this.state.totalSeconds, this.state.remainingSeconds)
    if (this.state.remainingSeconds > 10) {
      this.state.preWarned = false
    }
    if (this.state.app && this.state.app.globalData.restTimer) {
      this.state.app.globalData.restTimer.remainingSeconds = this.state.remainingSeconds
      this.state.app.globalData.restTimer.endTime = Date.now() + this.state.remainingSeconds * 1000
      this.state.app.globalData.restTimer.totalSeconds = this.state.totalSeconds
    }
    this.updateUI()
  },

  updateUI() {
    if (this.state.digitsWidget) {
      this.state.digitsWidget.setProperty(hmUI.prop.TEXT, this.formatTime(this.state.remainingSeconds))
    }

    if (this.state.arcWidget && this.state.totalSeconds > 0) {
      const progressFraction = Math.max(0, Math.min(1, this.state.remainingSeconds / this.state.totalSeconds))
      const endAngle = -90 + Math.round(360 * progressFraction)
      this.state.arcWidget.setProperty(hmUI.prop.END_ANGLE, endAngle)
    }
  },

  startCountdown() {
    this.updateClockDisplay()
    this.state.timerInterval = setInterval(() => {
      const timerData = this.state.app ? this.state.app.globalData.restTimer : null
      if (timerData && timerData.endTime) {
        this.state.remainingSeconds = Math.max(0, Math.round((timerData.endTime - Date.now()) / 1000))
      } else if (this.state.remainingSeconds > 0) {
        this.state.remainingSeconds -= 1
      }
      this.updateUI()
      this.updateClockDisplay()

      if (this.state.remainingSeconds === 10 && !this.state.preWarned) {
        this.state.preWarned = true
        vibratePreWarning()
      }

      if (this.state.remainingSeconds === 0) {
        this.onTimerExpired()
      }
    }, 1000)
  },

  onTimerExpired() {
    this.clearCountdown()
    this.state.preWarned = false
    vibrateRestFinished()

    if (this.state.digitsWidget) {
      this.state.digitsWidget.setProperty(hmUI.prop.COLOR, 0x10b981)
      this.state.digitsWidget.setProperty(hmUI.prop.TEXT, '¡A POR ELLO!')
    }

    setTimeout(() => {
      this.finishRest()
    }, 1200)
  },

  finishRest() {
    this.clearCountdown()
    this.state.app.globalData.restTimer.active = false
    replace({ url: 'page/workout/index' })
  },

  clearCountdown() {
    if (this.state.timerInterval) {
      clearInterval(this.state.timerInterval)
      this.state.timerInterval = null
    }
  },

  onResume() {
    this.enableWakeUpRelaunch()
    this.updateUI()
    this.updateClockDisplay()
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
    this.clearCountdown()
    this.disableWakeUpRelaunch()
  }
})
