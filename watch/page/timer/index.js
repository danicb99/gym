/**
 * VigorexiApp Watch - Temporizador de Descanso con Alarma Háptica (Round 466x466)
 */

import * as hmUI from '@zos/ui'
import { replace } from '@zos/router'
import { setWakeUpRelaunch, resetWakeUpRelaunch } from '@zos/display'
import { vibrateShort, vibrateRestFinished } from '../../utils/haptics'

Page({
  state: {
    app: null,
    totalSeconds: 90,
    remainingSeconds: 90,
    digitsWidget: null,
    arcWidget: null,
    clockWidget: null,
    timerInterval: null
  },

  onInit() {
    this.state.app = getApp()
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

    // 1. TÍTULO SUPERIOR
    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 33,
      y: 45,
      w: 400,
      h: 30,
      color: 0x38bdf8, // Cyan
      text_size: 18,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: '⏱️ DESCANSO'
    })

    // 2. PRÓXIMO EJERCICIO Y SERIE
    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 40,
      y: 80,
      w: 386,
      h: 28,
      color: 0xfbbf24, // Gold / Amber
      text_size: 17,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: timerData ? timerData.nextExerciseName : 'Siguiente serie'
    })

    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 40,
      y: 110,
      w: 386,
      h: 24,
      color: 0x94a3b8, // Slate
      text_size: 15,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: timerData ? `Preparar Serie ${timerData.nextSetNum}` : 'Toma aire y magnesio'
    })

    // 3. ANILLO DE PROGRESO CIRCULAR
    this.state.arcWidget = hmUI.createWidget(hmUI.widget.ARC, {
      x: 43,
      y: 43,
      w: 380,
      h: 380,
      start_angle: -90,
      end_angle: 270,
      color: 0x10b981, // Emerald green
      line_width: 8
    })

    // 4. DÍGITOS GIGANTES DEL CRONÓMETRO
    this.state.digitsWidget = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 33,
      y: 160,
      w: 400,
      h: 80,
      color: 0xffffff,
      text_size: 52,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: this.formatTime(this.state.remainingSeconds)
    })

    // 5. CONTROLES DE DESCANSO (+30s y Saltar / Listo)
    const btnY = 270
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 75,
      y: btnY,
      w: 145,
      h: 52,
      radius: 26,
      normal_color: 0x1e293b,
      press_color: 0x334155,
      color: 0x38bdf8,
      text_size: 17,
      text: '+30s',
      click_func: () => {
        vibrateShort()
        this.addTime(30)
      }
    })

    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 246,
      y: btnY,
      w: 145,
      h: 52,
      radius: 26,
      normal_color: 0x10b981,
      press_color: 0x059669,
      color: 0xffffff,
      text_size: 17,
      text: '¡Listo! ➔',
      click_func: () => {
        vibrateShort()
        this.finishRest()
      }
    })

    // Subtexto motivacional inferior
    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 33,
      y: 345,
      w: 400,
      h: 26,
      color: 0x64748b,
      text_size: 14,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: 'Vibrará en la muñeca al terminar'
    })

    // Reloj inferior (Hora actual)
    this.state.clockWidget = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 103,
      y: 388,
      w: 260,
      h: 30,
      color: 0x94a3b8, // Slate gray
      text_size: 17,
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
    return `🕒 ${hStr}:${mStr}`
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

      if (this.state.remainingSeconds === 0) {
        this.onTimerExpired()
      }
    }, 1000)
  },

  onTimerExpired() {
    this.clearCountdown()
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
    this.updateUI()
    this.updateClockDisplay()
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
    this.clearCountdown()
    this.disableWakeUpRelaunch()
  }
})
