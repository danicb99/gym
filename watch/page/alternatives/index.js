/**
 * VigorexiApp Watch - Selector de Ejercicios Alternativos (Round 466x466)
 * Cambio rápido de máquina si la zona está ocupada
 */

import * as hmUI from '@zos/ui'
import { back, replace } from '@zos/router'
import { EXERCISE_CATALOG } from '../../utils/routine_data'

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

    // Activar barra de scroll nativa
    hmUI.createWidget(hmUI.widget.PAGE_SCROLLBAR)

    // 1. TÍTULO
    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 33,
      y: 35,
      w: 400,
      h: 32,
      color: 0xfbbf24, // Gold / Amber
      text_size: 21,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: '⇄ ALTERNATIVAS'
    })

    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 40,
      y: 72,
      w: 386,
      h: 26,
      color: 0x94a3b8,
      text_size: 15,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: `Actual: ${currentEx.name}`
    })

    const alternatives = currentEx.alternatives || []
    let curY = 112
    const btnW = 376
    const btnH = 68
    const btnRadius = 34
    const btnGap = 14

    alternatives.forEach((altId) => {
      const altEx = EXERCISE_CATALOG[altId]
      if (!altEx) return

      hmUI.createWidget(hmUI.widget.BUTTON, {
        x: 45,
        y: curY,
        w: btnW,
        h: btnH,
        radius: btnRadius,
        normal_color: 0x1e293b,
        press_color: 0x38bdf8,
        color: 0xf8fafc,
        text_size: 19,
        text: altEx.name,
        click_func: () => {
          app.globalData.slotExOverrides[slot.slotId] = altId
          replace({ url: 'page/workout/index' })
        }
      })
      curY += btnH + btnGap
    })

    // Botón cancelar grande
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 45,
      y: curY,
      w: btnW,
      h: btnH,
      radius: btnRadius,
      normal_color: 0x334155,
      press_color: 0x475569,
      color: 0x94a3b8,
      text_size: 18,
      text: '✕ Cancelar (Volver)',
      click_func: () => {
        back()
      }
    })
    curY += btnH + btnGap

    // Espacio inferior para scroll holgado
    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 45,
      y: curY,
      w: btnW,
      h: 70,
      text: ''
    })
  }
})
