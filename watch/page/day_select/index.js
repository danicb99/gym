/**
 * VigorexiApp Watch - Selector de Día de Entrenamiento (Round 466x466)
 */

import * as hmUI from '@zos/ui'
import { push } from '@zos/router'
import { ROUTINE_SLOTS } from '../../utils/routine_data'
import { vibrateShort } from '../../utils/haptics'

Page({
  state: {
    titleWidget: null,
    buttons: []
  },

  build() {
    const app = getApp()
    const activeSession = app.globalData.activeDayId

    // Título Principal
    this.state.titleWidget = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 33,
      y: 45,
      w: 400,
      h: 40,
      color: 0xfbbf24, // Gold / Amber
      text_size: 24,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: 'VIGOREXIAPP'
    })

    // Subtítulo
    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 33,
      y: 85,
      w: 400,
      h: 30,
      color: 0x94a3b8, // Slate
      text_size: 16,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: activeSession ? 'Sesión en curso disponible' : 'Selecciona tu rutina'
    })

    let startY = 125
    const btnHeight = 55
    const btnGap = 12

    // Si hay una sesión activa, botón prioritario para reanudar
    if (activeSession) {
      const activeDay = ROUTINE_SLOTS[activeSession]
      hmUI.createWidget(hmUI.widget.BUTTON, {
        x: 63,
        y: startY,
        w: 340,
        h: btnHeight,
        radius: 27,
        normal_color: 0x10b981, // Emerald green
        press_color: 0x059669,
        color: 0xffffff,
        text_size: 18,
        text: `▶ Continuar ${activeDay ? activeDay.shortName : 'Sesión'}`,
        click_func: () => {
          vibrateShort()
          push({ url: 'page/workout/index' })
        }
      })
      startY += btnHeight + btnGap
    }

    const days = [
      { id: 'torsoA', label: 'D1: Torso A (Empuje)', color: 0x1e293b, pressColor: 0x334155 },
      { id: 'piernaA', label: 'D2: Pierna A (Cuádriceps)', color: 0x1e293b, pressColor: 0x334155 },
      { id: 'torsoB', label: 'D3: Torso B (Tracción)', color: 0x1e293b, pressColor: 0x334155 },
      { id: 'piernaB', label: 'D4: Pierna B (Isquios)', color: 0x1e293b, pressColor: 0x334155 }
    ]

    days.forEach((day, idx) => {
      // Si ya hay sesión activa, mostramos hasta 2 o 3 botones para no salir de pantalla
      if (activeSession && idx >= 3) return
      if (!activeSession && idx >= 4) return

      hmUI.createWidget(hmUI.widget.BUTTON, {
        x: 63,
        y: startY + idx * (btnHeight + btnGap),
        w: 340,
        h: btnHeight,
        radius: 27,
        normal_color: day.color,
        press_color: day.pressColor,
        color: 0xf8fafc,
        text_size: 17,
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
