/**
 * VigorexiApp Watch - Selector de Día de Entrenamiento (Round 466x466)
 * Permite iniciar sesión autónoma o sincronizarse en caliente con el smartphone
 */

import * as hmUI from '@zos/ui'
import { push } from '@zos/router'
import { BasePage } from '@zeppos/zml/base-page'
import { ROUTINE_SLOTS } from '../../utils/routine_data'
import { vibrateShort } from '../../utils/haptics'
import { requestPhoneLiveWorkout } from '../../utils/sync_bridge'

Page(
  BasePage({
    state: {
      titleWidget: null,
      subWidget: null,
      syncButton: null,
      clockWidget: null,
      buttons: []
    },

    async onInit() {
      // Iniciar búsqueda automática de sesión en móvil
      this.checkSync(false)
    },

    async checkSync(manualTrigger = false) {
      const app = getApp()
      if (this.state.syncButton && !app.globalData.phoneLiveSession) {
        this.state.syncButton.setProperty(hmUI.prop.TEXT, '🔄 Buscando móvil...')
        this.state.syncButton.setProperty(hmUI.prop.NORMAL_COLOR, 0x1e293b)
      }
      if (this.state.subWidget && !app.globalData.phoneLiveSession) {
        this.state.subWidget.setProperty(hmUI.prop.TEXT, 'Conectando con tu móvil...')
      }

      try {
        const phoneSession = await requestPhoneLiveWorkout(this)
        if (phoneSession && phoneSession.activeDayId) {
          app.globalData.phoneLiveSession = phoneSession
          const dayData = ROUTINE_SLOTS[phoneSession.activeDayId]
          const title = dayData ? dayData.shortName : phoneSession.activeDayId

          if (this.state.syncButton) {
            this.state.syncButton.setProperty(hmUI.prop.TEXT, `🟢 Unirse a ${title}`)
            this.state.syncButton.setProperty(hmUI.prop.NORMAL_COLOR, 0x0284c7)
          }
          if (this.state.subWidget) {
            this.state.subWidget.setProperty(hmUI.prop.TEXT, '¡Entreno activo detectado!')
            this.state.subWidget.setProperty(hmUI.prop.COLOR, 0x38bdf8)
          }
          vibrateShort()
        } else {
          if (this.state.syncButton) {
            this.state.syncButton.setProperty(hmUI.prop.TEXT, '🔄 Sincronizar Móvil')
            this.state.syncButton.setProperty(hmUI.prop.NORMAL_COLOR, 0x1e293b)
          }
          if (this.state.subWidget) {
            this.state.subWidget.setProperty(hmUI.prop.TEXT, 'Selecciona rutina o sincroniza')
            this.state.subWidget.setProperty(hmUI.prop.COLOR, 0x94a3b8)
          }
          if (manualTrigger) {
            vibrateShort()
          }
        }
      } catch (e) {
        console.log('[DaySelect] Error consultando móvil:', e)
        if (this.state.syncButton) {
          this.state.syncButton.setProperty(hmUI.prop.TEXT, '🔄 Reintentar conexión')
        }
      }
    },

    build() {
      const app = getApp()
      const activeLocal = app.globalData.activeDayId
      const phoneSession = app.globalData.phoneLiveSession

      // Título Principal
      this.state.titleWidget = hmUI.createWidget(hmUI.widget.TEXT, {
        x: 33,
        y: 28,
        w: 400,
        h: 32,
        color: 0xfbbf24, // Gold / Amber
        text_size: 22,
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V,
        text: 'VIGOREXIAPP'
      })

      // Subtítulo de estado
      let subText = 'Buscando entreno en móvil...'
      let subColor = 0x94a3b8
      if (phoneSession && phoneSession.activeDayId) {
        subText = '¡Entreno activo detectado!'
        subColor = 0x38bdf8
      } else if (activeLocal) {
        subText = 'Sesión en curso disponible'
      }

      this.state.subWidget = hmUI.createWidget(hmUI.widget.TEXT, {
        x: 33,
        y: 62,
        w: 400,
        h: 24,
        color: subColor,
        text_size: 14,
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V,
        text: subText
      })

      // 1. BOTÓN PRIORITARIO: Unirse al entrenamiento del móvil (Live Sync)
      const phoneDayData = phoneSession ? ROUTINE_SLOTS[phoneSession.activeDayId] : null
      const phoneDayTitle = phoneDayData ? phoneDayData.shortName : (phoneSession ? phoneSession.activeDayId : '')
      const initialBtnText = phoneSession ? `🟢 Unirse a ${phoneDayTitle}` : '🔄 Conectar con Móvil'
      const initialBtnColor = phoneSession ? 0x0284c7 : 0x1e293b

      this.state.syncButton = hmUI.createWidget(hmUI.widget.BUTTON, {
        x: 58,
        y: 92,
        w: 350,
        h: 50,
        radius: 25,
        normal_color: initialBtnColor,
        press_color: 0x0369a1,
        color: 0xffffff,
        text_size: 16,
        text: initialBtnText,
        click_func: () => {
          vibrateShort()
          if (app.globalData.phoneLiveSession) {
            app.adoptPhoneSession(app.globalData.phoneLiveSession)
            if (app.globalData.restTimer && app.globalData.restTimer.active && app.globalData.restTimer.remainingSeconds > 2) {
              push({ url: 'page/timer/index' })
            } else {
              push({ url: 'page/workout/index' })
            }
          } else {
            this.checkSync(true)
          }
        }
      })

      let startY = 150
      const btnHeight = 46
      const btnGap = 8

      // 2. BOTÓN: Continuar sesión local (si hay sesión previa en el reloj diferente a la del móvil)
      if (activeLocal && (!phoneSession || activeLocal !== phoneSession.activeDayId)) {
        const activeDay = ROUTINE_SLOTS[activeLocal]
        hmUI.createWidget(hmUI.widget.BUTTON, {
          x: 58,
          y: startY,
          w: 350,
          h: btnHeight,
          radius: 23,
          normal_color: 0x10b981, // Emerald green
          press_color: 0x059669,
          color: 0xffffff,
          text_size: 16,
          text: `▶ Continuar ${activeDay ? activeDay.shortName : 'Sesión'}`,
          click_func: () => {
            vibrateShort()
            push({ url: 'page/workout/index' })
          }
        })
        startY += btnHeight + btnGap
      }

      // 3. BOTONES NORMALES DE RUTINA
      const days = [
        { id: 'torsoA', label: 'D1: Torso A (Empuje)' },
        { id: 'piernaA', label: 'D2: Pierna A (Cuádriceps)' },
        { id: 'torsoB', label: 'D3: Torso B (Tracción)' },
        { id: 'piernaB', label: 'D4: Pierna B (Isquios)' }
      ]

      const maxButtonsToShow = (startY > 160) ? 3 : 4

      days.forEach((day, idx) => {
        if (idx >= maxButtonsToShow) return

        hmUI.createWidget(hmUI.widget.BUTTON, {
          x: 58,
          y: startY + idx * (btnHeight + btnGap),
          w: 350,
          h: btnHeight,
          radius: 23,
          normal_color: 0x1e293b,
          press_color: 0x334155,
          color: 0xf8fafc,
          text_size: 15,
          text: day.label,
          click_func: () => {
            vibrateShort()
            app.startNewWorkout(day.id)
            push({ url: 'page/workout/index' })
          }
        })
      })

      // Reloj inferior (Hora actual - Limpio)
      this.state.clockWidget = hmUI.createWidget(hmUI.widget.TEXT, {
        x: 108,
        y: 388,
        w: 250,
        h: 38,
        color: 0xf1f5f9,
        text_size: 26,
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V,
        text: this.getClockStr()
      })
    },

    getClockStr() {
      const now = new Date()
      const h = now.getHours()
      const m = now.getMinutes()
      const hStr = h < 10 ? '0' + h : '' + h
      const mStr = m < 10 ? '0' + m : '' + m
      return `${hStr}:${mStr}`
    },

    onResume() {
      if (this.state.clockWidget) {
        this.state.clockWidget.setProperty(hmUI.prop.TEXT, this.getClockStr())
      }
    }
  })
)
