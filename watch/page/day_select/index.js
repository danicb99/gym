/**
 * VigorexiApp Watch - Selector de Día de Entrenamiento (Round 466x466)
 * Scrollable list con tarjetas grandes de 68px (sin vibraciones en clics)
 */

import * as hmUI from '@zos/ui'
import { push, replace } from '@zos/router'
import { keepScreenActive, restoreScreenBehavior } from '../../utils/display'
import { BasePage } from '@zeppos/zml/base-page'
import { ROUTINE_SLOTS } from '../../utils/routine_data'
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
      const app = getApp()
      // Si ya hay un entrenamiento activo guardado en memoria flash, reanudar inmediatamente
      if (app && app.globalData && app.globalData.activeDayId) {
        console.log('[DaySelect] Sesión activa detectada en flash, auto-resumiendo entreno:', app.globalData.activeDayId)
        replace({ url: 'page/workout/index' })
        return
      }

      this.enableWakeUpRelaunch()
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
        } else {
          if (this.state.syncButton) {
            this.state.syncButton.setProperty(hmUI.prop.TEXT, '🔄 Sincronizar Móvil')
            this.state.syncButton.setProperty(hmUI.prop.NORMAL_COLOR, 0x1e293b)
          }
          if (this.state.subWidget) {
            this.state.subWidget.setProperty(hmUI.prop.TEXT, 'Selecciona rutina o sincroniza')
            this.state.subWidget.setProperty(hmUI.prop.COLOR, 0x94a3b8)
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

      // Activar barra de desplazamiento vertical de página completa
      try {
        hmUI.createWidget(hmUI.widget.PAGE_SCROLLBAR)
      } catch (e) {}

      // Título Principal
      this.state.titleWidget = hmUI.createWidget(hmUI.widget.TEXT, {
        x: 33,
        y: 30,
        w: 400,
        h: 34,
        color: 0xfbbf24, // Gold / Amber
        text_size: 24,
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
        y: 66,
        w: 400,
        h: 26,
        color: subColor,
        text_size: 16,
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V,
        text: subText
      })

      // Medidas XL para tarjetas (68px de alto, fuente 19px)
      const btnX = 45
      const btnW = 376
      const btnH = 68
      const btnRadius = 34
      const btnGap = 14
      let curY = 106

      // 1. BOTÓN PRIORITARIO: Unirse al entrenamiento del móvil (Live Sync)
      const phoneDayData = phoneSession ? ROUTINE_SLOTS[phoneSession.activeDayId] : null
      const phoneDayTitle = phoneDayData ? phoneDayData.shortName : (phoneSession ? phoneSession.activeDayId : '')
      const initialBtnText = phoneSession ? `🟢 Unirse a ${phoneDayTitle}` : '🔄 Sincronizar Móvil'
      const initialBtnColor = phoneSession ? 0x0284c7 : 0x1e293b

      this.state.syncButton = hmUI.createWidget(hmUI.widget.BUTTON, {
        x: btnX,
        y: curY,
        w: btnW,
        h: btnH,
        radius: btnRadius,
        normal_color: initialBtnColor,
        press_color: 0x0369a1,
        color: 0xffffff,
        text_size: 19,
        text: initialBtnText,
        click_func: () => {
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
      curY += btnH + btnGap

      // 2. BOTÓN: Continuar sesión local si existe
      if (activeLocal && (!phoneSession || activeLocal !== phoneSession.activeDayId)) {
        const activeDay = ROUTINE_SLOTS[activeLocal]
        hmUI.createWidget(hmUI.widget.BUTTON, {
          x: btnX,
          y: curY,
          w: btnW,
          h: btnH,
          radius: btnRadius,
          normal_color: 0x10b981, // Emerald green
          press_color: 0x059669,
          color: 0xffffff,
          text_size: 19,
          text: `▶ Continuar ${activeDay ? activeDay.shortName : 'Sesión'}`,
          click_func: () => {
            push({ url: 'page/workout/index' })
          }
        })
        curY += btnH + btnGap
      }

      // 3. BOTONES NORMALES DE RUTINA (TODOS VISIBLES CON SCROLL)
      const days = [
        { id: 'torsoA', label: '💪 D1: Torso A (Empuje)' },
        { id: 'piernaA', label: '🦵 D2: Pierna A (Cuádriceps)' },
        { id: 'torsoB', label: '🔙 D3: Torso B (Tracción)' },
        { id: 'piernaB', label: '🍑 D4: Pierna B (Isquios)' }
      ]

      days.forEach(day => {
        hmUI.createWidget(hmUI.widget.BUTTON, {
          x: btnX,
          y: curY,
          w: btnW,
          h: btnH,
          radius: btnRadius,
          normal_color: 0x1e293b,
          press_color: 0x334155,
          color: 0xf8fafc,
          text_size: 19,
          text: day.label,
          click_func: () => {
            app.startNewWorkout(day.id)
            push({ url: 'page/workout/index' })
          }
        })
        curY += btnH + btnGap
      })

      // Reloj inferior al final del scroll (Grande y limpio)
      curY += 8
      this.state.clockWidget = hmUI.createWidget(hmUI.widget.TEXT, {
        x: 108,
        y: curY,
        w: 250,
        h: 40,
        color: 0xf1f5f9,
        text_size: 28,
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V,
        text: this.getClockStr()
      })
      curY += 40 + 70 // Margen inferior para que el reloj no quede tapado por la curvatura del reloj

      // Espaciador final
      hmUI.createWidget(hmUI.widget.TEXT, {
        x: 100,
        y: curY,
        w: 266,
        h: 20,
        color: 0x000000,
        text: ''
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
    },

    enableWakeUpRelaunch() {
      keepScreenActive(30000)
    },

    disableWakeUpRelaunch() {
      restoreScreenBehavior()
    },

    onDestroy() {
      this.disableWakeUpRelaunch()
    }
  })
)
