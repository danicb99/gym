/**
 * VigorexiApp Watch - Selector de Ejercicios Alternativos (Round 466x466)
 * Cambio rápido de máquina si la zona está ocupada
 */

import * as hmUI from '@zos/ui'
import { back, replace } from '@zos/router'
import { EXERCISE_CATALOG } from '../../utils/routine_data'
import { vibrateShort } from '../../utils/haptics'

Page({
  state: {
    app: null
  },

  build() {
    this.state.app = getApp()
    const app = this.state.app
    const slot = app.getActiveSlot()
    const currentEx = app.getActiveExercise()

    if (!slot || !currentEx) {
      back()
      return
    }

    // 1. TÍTULO
    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 33,
      y: 40,
      w: 400,
      h: 30,
      color: 0xfbbf24, // Gold / Amber
      text_size: 19,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: '⇄ CAMBIAR MÁQUINA'
    })

    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 40,
      y: 72,
      w: 386,
      h: 24,
      color: 0x94a3b8,
      text_size: 14,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: `Actual: ${currentEx.name}`
    })

    const alternatives = currentEx.alternatives || []
    let startY = 108
    const btnHeight = 52
    const btnGap = 10

    alternatives.slice(0, 3).forEach((altId, idx) => {
      const altEx = EXERCISE_CATALOG[altId]
      if (!altEx) return

      hmUI.createWidget(hmUI.widget.BUTTON, {
        x: 63,
        y: startY + idx * (btnHeight + btnGap),
        w: 340,
        h: btnHeight,
        radius: 26,
        normal_color: 0x1e293b,
        press_color: 0x38bdf8,
        color: 0xf8fafc,
        text_size: 16,
        text: altEx.name,
        click_func: () => {
          vibrateShort()
          app.globalData.slotExOverrides[slot.slotId] = altId
          replace({ url: 'page/workout/index' })
        }
      })
    })

    // Botón cancelar en la parte inferior
    const cancelY = startY + Math.min(3, alternatives.length) * (btnHeight + btnGap) + 12
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 133,
      y: Math.min(380, cancelY),
      w: 200,
      h: 44,
      radius: 22,
      normal_color: 0x334155,
      press_color: 0x475569,
      color: 0x94a3b8,
      text_size: 15,
      text: '✕ Cancelar',
      click_func: () => {
        vibrateShort()
        back()
      }
    })
  }
})
