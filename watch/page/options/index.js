/**
 * VigorexiApp Watch - Menú de Opciones y Ajustes Rápidos (Round 466x466)
 * Scrollable list con todas las acciones secundarias del entrenamiento
 */

import * as hmUI from '@zos/ui'
import { back, push, replace } from '@zos/router'
import { setWakeUpRelaunch, resetWakeUpRelaunch } from '@zos/display'
import { BasePage } from '@zeppos/zml/base-page'
import { ROUTINE_SLOTS } from '../../utils/routine_data'
import { vibrateShort } from '../../utils/haptics'
import { requestPhoneLiveWorkout } from '../../utils/sync_bridge'

Page(
  BasePage({
    state: {
      app: null,
      syncFeedbackWidget: null
    },

    onInit() {
      this.state.app = getApp()
      this.enableWakeUpRelaunch()
    },

    build() {
      const app = this.state.app
      const slot = app.getActiveSlot()
      const ex = app.getActiveExercise()
      const day = ROUTINE_SLOTS[app.globalData.activeDayId]
      const currentSlotNum = app.globalData.currentSlotIndex + 1
      const totalSlots = day ? day.slots.length : 1
      const totalSets = app.getTotalSetsForSlot ? app.getTotalSetsForSlot(slot) : ((slot && slot.sets && slot.sets.length) || 4)

      // Activar barra de desplazamiento de página completa
      try {
        hmUI.createWidget(hmUI.widget.PAGE_SCROLLBAR)
      } catch (e) {}

      // 1. TÍTULO SUPERIOR
      hmUI.createWidget(hmUI.widget.TEXT, {
        x: 33,
        y: 35,
        w: 400,
        h: 32,
        color: 0xfbbf24, // Gold / Amber
        text_size: 22,
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V,
        text: '⚙️ AJUSTES / MENÚ'
      })

      // 2. SUBTÍTULO CON CONTEXTO ACTUAL
      const exName = ex ? ex.name : 'Ejercicio'
      hmUI.createWidget(hmUI.widget.TEXT, {
        x: 40,
        y: 68,
        w: 386,
        h: 26,
        color: 0x38bdf8, // Cyan
        text_size: 15,
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V,
        text: `Ej. ${currentSlotNum}/${totalSlots}: ${exName}`
      })

      const btnX = 48
      const btnW = 370
      const btnH = 54
      const btnRadius = 27
      const btnGap = 12
      let curY = 105

      // OPCIÓN 1: CAMBIAR MÁQUINA (ALTERNATIVAS)
      hmUI.createWidget(hmUI.widget.BUTTON, {
        x: btnX,
        y: curY,
        w: btnW,
        h: btnH,
        radius: btnRadius,
        normal_color: 0x1e293b,
        press_color: 0x334155,
        color: 0xfbbf24,
        text_size: 16,
        text: '⇄ Cambiar Máquina (Alternativas)',
        click_func: () => {
          vibrateShort()
          push({ url: 'page/alternatives/index' })
        }
      })
      curY += btnH + btnGap

      // OPCIÓN 2: SALTAR ESTE EJERCICIO
      const isLastSlot = currentSlotNum >= totalSlots
      hmUI.createWidget(hmUI.widget.BUTTON, {
        x: btnX,
        y: curY,
        w: btnW,
        h: btnH,
        radius: btnRadius,
        normal_color: 0x1e293b,
        press_color: 0x334155,
        color: 0x38bdf8,
        text_size: 16,
        text: isLastSlot ? '⏭️ Saltar al Resumen' : '⏭️ Saltar este ejercicio',
        click_func: () => {
          vibrateShort()
          if (!isLastSlot) {
            app.globalData.currentSlotIndex += 1
            app.globalData.currentSetIndex = 0
            replace({ url: 'page/workout/index' })
          } else {
            app.finishWorkout()
            replace({ url: 'page/summary/index' })
          }
        }
      })
      curY += btnH + btnGap

      // OPCIÓN 3: VOLVER AL EJERCICIO ANTERIOR
      hmUI.createWidget(hmUI.widget.BUTTON, {
        x: btnX,
        y: curY,
        w: btnW,
        h: btnH,
        radius: btnRadius,
        normal_color: 0x1e293b,
        press_color: 0x334155,
        color: 0x38bdf8,
        text_size: 16,
        text: '⏮️ Ejercicio anterior',
        click_func: () => {
          vibrateShort()
          if (app.globalData.currentSlotIndex > 0) {
            app.globalData.currentSlotIndex -= 1
            app.globalData.currentSetIndex = 0
            replace({ url: 'page/workout/index' })
          } else {
            back()
          }
        }
      })
      curY += btnH + btnGap

      // OPCIÓN 4: AÑADIR SERIE EXTRA
      hmUI.createWidget(hmUI.widget.BUTTON, {
        x: btnX,
        y: curY,
        w: btnW,
        h: btnH,
        radius: btnRadius,
        normal_color: 0x1e293b,
        press_color: 0x334155,
        color: 0x10b981,
        text_size: 16,
        text: `➕ Añadir serie extra (Ahora ${totalSets + 1})`,
        click_func: () => {
          vibrateShort()
          if (slot) {
            if (app.addExtraSet) {
              app.addExtraSet(slot.slotId)
            } else {
              app.globalData.slotExtraSets = app.globalData.slotExtraSets || {}
              app.globalData.slotExtraSets[slot.slotId] = (app.globalData.slotExtraSets[slot.slotId] || 0) + 1
            }
          }
          back()
        }
      })
      curY += btnH + btnGap

      // OPCIÓN 5: QUITAR UNA SERIE
      hmUI.createWidget(hmUI.widget.BUTTON, {
        x: btnX,
        y: curY,
        w: btnW,
        h: btnH,
        radius: btnRadius,
        normal_color: 0x1e293b,
        press_color: 0x334155,
        color: 0xf59e0b,
        text_size: 16,
        text: `➖ Quitar 1 serie (Mínimo 1)`,
        click_func: () => {
          vibrateShort()
          if (slot && totalSets > 1) {
            if (app.removeSet) {
              app.removeSet(slot.slotId)
            } else {
              app.globalData.slotExtraSets = app.globalData.slotExtraSets || {}
              app.globalData.slotExtraSets[slot.slotId] = (app.globalData.slotExtraSets[slot.slotId] || 0) - 1
            }
            if (app.globalData.currentSetIndex >= totalSets - 1) {
              app.globalData.currentSetIndex = Math.max(0, totalSets - 2)
            }
          }
          back()
        }
      })
      curY += btnH + btnGap

      // OPCIÓN 6: SINCRONIZAR CON MÓVIL
      hmUI.createWidget(hmUI.widget.BUTTON, {
        x: btnX,
        y: curY,
        w: btnW,
        h: btnH,
        radius: btnRadius,
        normal_color: 0x1e293b,
        press_color: 0x334155,
        color: 0x38bdf8,
        text_size: 16,
        text: '🔄 Sincronizar con Móvil',
        click_func: async () => {
          vibrateShort()
          try {
            await app.checkPhoneLiveSession()
            vibrateShort()
          } catch (e) {}
          back()
        }
      })
      curY += btnH + btnGap

      // OPCIÓN 7: FINALIZAR ENTRENAMIENTO
      hmUI.createWidget(hmUI.widget.BUTTON, {
        x: btnX,
        y: curY,
        w: btnW,
        h: btnH,
        radius: btnRadius,
        normal_color: 0xef4444, // Red
        press_color: 0xdc2626,
        color: 0xffffff,
        text_size: 16,
        text: '🏁 Finalizar Entrenamiento',
        click_func: () => {
          vibrateShort()
          app.finishWorkout()
          replace({ url: 'page/summary/index' })
        }
      })
      curY += btnH + btnGap

      // BOTÓN FINAL: VOLVER / CERRAR MENÚ (Flecha hacia abajo)
      hmUI.createWidget(hmUI.widget.BUTTON, {
        x: btnX,
        y: curY,
        w: btnW,
        h: btnH,
        radius: btnRadius,
        normal_color: 0x334155,
        press_color: 0x475569,
        color: 0xf8fafc,
        text_size: 16,
        text: '▼ Cerrar Menú (Volver)',
        click_func: () => {
          vibrateShort()
          back()
        }
      })
      curY += btnH + 60 // Espacio inferior de seguridad para la curvatura de la pantalla

      // Widget espaciador invisible inferior para scroll suave
      hmUI.createWidget(hmUI.widget.TEXT, {
        x: 100,
        y: curY,
        w: 266,
        h: 20,
        color: 0x000000,
        text: ''
      })
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
    },

    disableWakeUpRelaunch() {
      try {
        if (typeof resetWakeUpRelaunch === 'function') {
          resetWakeUpRelaunch()
        } else if (typeof setWakeUpRelaunch === 'function') {
          setWakeUpRelaunch({ relaunch: false })
        }
      } catch (e) {}
    },

    onDestroy() {
      this.disableWakeUpRelaunch()
    }
  })
)
