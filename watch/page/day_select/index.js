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
import { loadWorkoutData } from '../../utils/storage'
import { THEME_COLORS } from '../../utils/theme'

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
      if (app && typeof app.flushPendingOutbox === 'function') {
        app.flushPendingOutbox()
      }
      this.enableWakeUpRelaunch()

      // Si ya hay un entrenamiento activo guardado en memoria flash, comprobar si el móvil tiene otra sesión activa
      if (app && app.globalData && app.globalData.activeDayId) {
        try {
          const phoneSession = await requestPhoneLiveWorkout(this)
          if (phoneSession && phoneSession.workoutActive === true && phoneSession.activeDayId) {
            if (phoneSession.activeDayId !== app.globalData.activeDayId) {
              console.log('[DaySelect] Móvil tiene otra sesión activa:', phoneSession.activeDayId, 'Adoptando...')
              app.adoptPhoneSession(phoneSession)
            } else {
              app.mergePhoneSession(phoneSession)
            }
            replace({ url: 'page/workout/index' })
            return
          } else if (phoneSession && phoneSession.workoutActive === false) {
            // El móvil está en reposo: si la sesión en reloj tiene más de 2h, descartarla para permitir elegir día
            const now = Date.now()
            const sTime = app.globalData.sessionStartTime || 0
            if (now - sTime > 2 * 3600 * 1000) {
              console.log('[DaySelect] Móvil en reposo y sesión en reloj antigua (>2h), descartando...')
              if (typeof app.discardActiveSession === 'function') {
                app.discardActiveSession()
              }
            } else {
              replace({ url: 'page/workout/index' })
              return
            }
          } else {
            replace({ url: 'page/workout/index' })
            return
          }
        } catch (e) {
          replace({ url: 'page/workout/index' })
          return
        }
      }

      // Iniciar búsqueda automática de sesión en móvil
      this.checkSync(false)
    },

    async checkSync(manualTrigger = false) {
      const app = getApp()
      if (this.state.syncButton && !app.globalData.phoneLiveSession) {
        this.state.syncButton.setProperty(hmUI.prop.TEXT, 'Buscando móvil...')
        this.state.syncButton.setProperty(hmUI.prop.NORMAL_COLOR, 0x1e293b)
      }
      if (this.state.subWidget && !app.globalData.phoneLiveSession) {
        this.state.subWidget.setProperty(hmUI.prop.TEXT, 'Conectando con tu móvil...')
      }

      try {
        const phoneSession = await requestPhoneLiveWorkout(this)
        if (phoneSession && phoneSession.activeDayId && phoneSession.workoutActive === true) {
          app.globalData.phoneLiveSession = phoneSession
          const dayData = ROUTINE_SLOTS[phoneSession.activeDayId]
          const title = dayData ? dayData.shortName : phoneSession.activeDayId

          if (this.state.syncButton) {
            this.state.syncButton.setProperty(hmUI.prop.TEXT, `Unirse a ${title}`)
            this.state.syncButton.setProperty(hmUI.prop.NORMAL_COLOR, 0x0284c7)
          }
          if (this.state.subWidget) {
            this.state.subWidget.setProperty(hmUI.prop.TEXT, '¡Entreno activo detectado!')
            this.state.subWidget.setProperty(hmUI.prop.COLOR, 0x38bdf8)
          }
        } else {
          app.globalData.phoneLiveSession = null
          if (this.state.syncButton) {
            this.state.syncButton.setProperty(hmUI.prop.TEXT, 'Sincronizar Móvil')
            this.state.syncButton.setProperty(hmUI.prop.NORMAL_COLOR, 0x1e293b)
          }
          if (this.state.subWidget) {
            this.state.subWidget.setProperty(hmUI.prop.TEXT, manualTrigger ? 'Sin entreno activo en móvil' : 'Selecciona rutina o sincroniza')
            this.state.subWidget.setProperty(hmUI.prop.COLOR, 0x94a3b8)
          }
        }
      } catch (e) {
        console.log('[DaySelect] Error consultando móvil:', e)
        if (this.state.syncButton) {
          this.state.syncButton.setProperty(hmUI.prop.TEXT, 'Reintentar conexión')
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

      // Chip Superior de Sincronización y Título
      const initialSync = app.getSyncStatus ? app.getSyncStatus() : { text: 'ok', color: THEME_COLORS.emerald }
      const syncLabel = initialSync.text ? ` • ${initialSync.text}` : ''

      hmUI.createWidget(hmUI.widget.TEXT, {
        x: 33,
        y: 20,
        w: 400,
        h: 24,
        color: initialSync.color || THEME_COLORS.emerald,
        text_size: 14,
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V,
        text: `VigorexiApp${syncLabel}`
      })

      // Título Principal
      this.state.titleWidget = hmUI.createWidget(hmUI.widget.TEXT, {
        x: 33,
        y: 44,
        w: 400,
        h: 36,
        color: THEME_COLORS.textMain,
        text_size: 26,
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V,
        text: 'Elegir Día'
      })

      // Subtítulo de estado
      let subText = 'Selecciona tu sesión de hoy'
      let subColor = THEME_COLORS.textMuted
      if (phoneSession && phoneSession.activeDayId) {
        subText = '¡Entreno activo detectado en móvil!'
        subColor = THEME_COLORS.cyan
      } else if (activeLocal) {
        subText = 'Sesión en curso disponible'
        subColor = THEME_COLORS.gold
      }

      this.state.subWidget = hmUI.createWidget(hmUI.widget.TEXT, {
        x: 33,
        y: 78,
        w: 400,
        h: 24,
        color: subColor,
        text_size: 15,
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V,
        text: subText
      })

      // Medidas de tarjetas
      const btnX = 45
      const btnW = 376
      const btnH = 68
      const btnRadius = 26
      const btnGap = 12
      let curY = 110

      // 1. BOTÓN PRIORITARIO: Sincronización con el móvil / Unirse a sesión activa
      const phoneDayData = phoneSession ? ROUTINE_SLOTS[phoneSession.activeDayId] : null
      const phoneDayTitle = phoneDayData ? phoneDayData.shortName : (phoneSession ? phoneSession.activeDayId : '')
      const hasLiveWorkout = phoneSession && phoneSession.activeDayId && phoneSession.workoutActive
      const initialBtnText = hasLiveWorkout ? `Unirse a ${phoneDayTitle}` : 'Sincronizar Móvil'
      const initialBtnColor = hasLiveWorkout ? THEME_COLORS.blueAction : THEME_COLORS.stepperBg

      this.state.syncButton = hmUI.createWidget(hmUI.widget.BUTTON, {
        x: btnX,
        y: curY,
        w: btnW,
        h: 72,
        radius: 26,
        normal_color: initialBtnColor,
        press_color: 0x0369a1,
        color: 0xffffff,
        text_size: 19,
        text: initialBtnText,
        click_func: () => {
          if (app.globalData.phoneLiveSession && app.globalData.phoneLiveSession.workoutActive) {
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
      curY += 72 + btnGap

      // 2. BOTÓN: Continuar sesión local si existe
      if (activeLocal && (!phoneSession || activeLocal !== phoneSession.activeDayId)) {
        const activeDay = ROUTINE_SLOTS[activeLocal]
        hmUI.createWidget(hmUI.widget.BUTTON, {
          x: btnX,
          y: curY,
          w: btnW,
          h: btnH,
          radius: btnRadius,
          normal_color: THEME_COLORS.emerald,
          press_color: THEME_COLORS.emeraldDark,
          color: THEME_COLORS.textDark,
          text_size: 20,
          text: `Continuar ${activeDay ? activeDay.shortName : 'Sesión'}`,
          click_func: () => {
            push({ url: 'page/workout/index' })
          }
        })
        curY += btnH + btnGap
      }

      // 3. BOTONES DE RUTINA CON TARJETA DESTACADA PARA EL RECOMENDADO
      const ROTATION_FULLBODY = ['fullbodyA', 'fullbodyB', 'fullbodyC']
      const ROTATION_TP = ['torsoA', 'piernaA', 'torsoB', 'piernaB']
      let recommendedDayId = 'fullbodyA'

      if (phoneSession && phoneSession.recommendedDayId) {
        recommendedDayId = phoneSession.recommendedDayId
      } else {
        try {
          const localData = loadWorkoutData()
          if (localData && localData.history && localData.history.length > 0) {
            const lastDay = localData.history[0].dayId
            if (ROTATION_FULLBODY.indexOf(lastDay) !== -1) {
              const idx = ROTATION_FULLBODY.indexOf(lastDay)
              recommendedDayId = ROTATION_FULLBODY[(idx + 1) % ROTATION_FULLBODY.length]
            } else if (ROTATION_TP.indexOf(lastDay) !== -1) {
              const idx = ROTATION_TP.indexOf(lastDay)
              recommendedDayId = ROTATION_TP[(idx + 1) % ROTATION_TP.length]
            }
          }
        } catch (e) {}
      }

      const days = [
        // --- FULL BODY 3 DÍAS (PRINCIPAL) ---
        { id: 'fullbodyA', label: 'Día A: Squat + Torso' },
        { id: 'fullbodyB', label: 'Día B: RDL + Torso' },
        { id: 'fullbodyC', label: 'Día C: Pierna + Brazos' },
        // --- TORSO / PIERNA 4 DÍAS (ALTERNO) ---
        { id: 'torsoA', label: 'D1: Torso A (Empuje)' },
        { id: 'piernaA', label: 'D2: Pierna A (Cuádriceps)' },
        { id: 'torsoB', label: 'D3: Torso B (Tracción)' },
        { id: 'piernaB', label: 'D4: Pierna B (Isquios)' }
      ]

      days.forEach(day => {
        const isRec = (day.id === recommendedDayId)
        const cardH = isRec ? 80 : 64
        const cardRadius = isRec ? 26 : 22
        const cardBg = isRec ? THEME_COLORS.gold : THEME_COLORS.stepperBg
        const cardTextColor = isRec ? 0x060a12 : THEME_COLORS.textMain
        const cardText = isRec ? `RECOMENDADO\n${day.label}` : day.label

        hmUI.createWidget(hmUI.widget.BUTTON, {
          x: btnX,
          y: curY,
          w: btnW,
          h: cardH,
          radius: cardRadius,
          normal_color: cardBg,
          press_color: isRec ? THEME_COLORS.goldDark : THEME_COLORS.stepperPress,
          color: cardTextColor,
          text_size: isRec ? 18 : 17,
          text: cardText,
          click_func: () => {
            app.startNewWorkout(day.id)
            push({ url: 'page/workout/index' })
          }
        })
        curY += cardH + btnGap
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
      const app = getApp()
      if (app && typeof app.flushPendingOutbox === 'function') {
        app.flushPendingOutbox()
      }
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
