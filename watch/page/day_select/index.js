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
      buttons: [],
      syncButton: null
    },

    async onInit() {
      const app = getApp()
      // Si no tenemos todavía la sesión del móvil, consultarla
      if (!app.globalData.phoneLiveSession) {
        try {
          const phoneSession = await requestPhoneLiveWorkout(this)
          if (phoneSession && phoneSession.activeDayId) {
            app.globalData.phoneLiveSession = phoneSession
            // Si hay botón de sincronización, actualizar su texto y hacerlo visible
            if (this.state.syncButton) {
              const dayData = ROUTINE_SLOTS[phoneSession.activeDayId]
              const title = dayData ? dayData.shortName : phoneSession.activeDayId
              this.state.syncButton.setProperty(hmUI.prop.MORE, {
                text: `🟢 Unirse a ${title}`,
                visible: true
              })
            }
          }
        } catch (e) {
          console.log('[DaySelect] Error consultando móvil:', e)
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
        y: 40,
        w: 400,
        h: 38,
        color: 0xfbbf24, // Gold / Amber
        text_size: 24,
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V,
        text: 'VIGOREXIAPP'
      })

      // Subtítulo de estado
      let subText = 'Selecciona tu rutina'
      if (phoneSession && phoneSession.activeDayId) {
        subText = '¡Entrenamiento detectado en móvil!'
      } else if (activeLocal) {
        subText = 'Sesión en curso disponible'
      }

      hmUI.createWidget(hmUI.widget.TEXT, {
        x: 33,
        y: 78,
        w: 400,
        h: 26,
        color: phoneSession ? 0x38bdf8 : 0x94a3b8, // Cyan si hay móvil, slate si no
        text_size: 15,
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V,
        text: subText
      })

      let startY = 112
      const btnHeight = 52
      const btnGap = 10

      // 1. BOTÓN PRIORITARIO: Unirse al entrenamiento del móvil (Live Sync)
      const phoneDayData = phoneSession ? ROUTINE_SLOTS[phoneSession.activeDayId] : null
      const phoneDayTitle = phoneDayData ? phoneDayData.shortName : (phoneSession ? phoneSession.activeDayId : '')

      this.state.syncButton = hmUI.createWidget(hmUI.widget.BUTTON, {
        x: 53,
        y: startY,
        w: 360,
        h: btnHeight,
        radius: 26,
        normal_color: 0x0284c7, // Sky Blue
        press_color: 0x0369a1,
        color: 0xffffff,
        text_size: 17,
        text: phoneSession ? `🟢 Unirse a ${phoneDayTitle}` : 'Buscando móvil...',
        visible: phoneSession ? true : false,
        click_func: () => {
          vibrateShort()
          if (app.globalData.phoneLiveSession) {
            app.adoptPhoneSession(app.globalData.phoneLiveSession)
            push({ url: 'page/workout/index' })
          }
        }
      })

      if (phoneSession) {
        startY += btnHeight + btnGap
      }

      // 2. BOTÓN: Continuar sesión local (si no se está usando el móvil)
      if (activeLocal && (!phoneSession || activeLocal !== phoneSession.activeDayId)) {
        const activeDay = ROUTINE_SLOTS[activeLocal]
        hmUI.createWidget(hmUI.widget.BUTTON, {
          x: 53,
          y: startY,
          w: 360,
          h: btnHeight,
          radius: 26,
          normal_color: 0x10b981, // Emerald green
          press_color: 0x059669,
          color: 0xffffff,
          text_size: 17,
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

      const maxButtonsToShow = phoneSession || activeLocal ? 3 : 4

      days.forEach((day, idx) => {
        if (idx >= maxButtonsToShow) return

        hmUI.createWidget(hmUI.widget.BUTTON, {
          x: 53,
          y: startY + idx * (btnHeight + btnGap),
          w: 360,
          h: btnHeight,
          radius: 26,
          normal_color: 0x1e293b,
          press_color: 0x334155,
          color: 0xf8fafc,
          text_size: 16,
          text: day.label,
          click_func: () => {
            vibrateShort()
            app.startNewWorkout(day.id)
            push({ url: 'page/workout/index' })
          }
        })
      })
    }
  })
)
