/**
 * VigorexiApp Watch - Menú de Opciones y Ajustes Rápidos (Round 466x466)
 * Scrollable list con tarjetas grandes de 68px (sin vibraciones molestas)
 */

import * as hmUI from '@zos/ui'
import { back, push, replace } from '@zos/router'
import { keepScreenActive, restoreScreenBehavior } from '../../utils/display'
import { BasePage } from '@zeppos/zml/base-page'
import { ROUTINE_SLOTS } from '../../utils/routine_data'

Page(
  BasePage({
    state: {
      app: null
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

      // 1. TÍTULO SUPERIOR (Grande)
      hmUI.createWidget(hmUI.widget.TEXT, {
        x: 33,
        y: 32,
        w: 400,
        h: 34,
        color: 0xfbbf24, // Gold / Amber
        text_size: 24,
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V,
        text: '▲ MENÚ DE AJUSTES'
      })

      // 2. SUBTÍTULO CON CONTEXTO ACTUAL
      const exName = ex ? ex.name : 'Ejercicio'
      hmUI.createWidget(hmUI.widget.TEXT, {
        x: 40,
        y: 68,
        w: 386,
        h: 28,
        color: 0x38bdf8, // Cyan
        text_size: 16,
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V,
        text: `Ej. ${currentSlotNum}/${totalSlots}: ${exName}`
      })

      // Tarjetas de opciones en tamaño XL (68px de alto, fuente 19px)
      const btnX = 45
      const btnW = 376
      const btnH = 68
      const btnRadius = 34
      const btnGap = 14
      let curY = 108

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
        text_size: 19,
        text: '⇄ Cambiar Máquina',
        click_func: () => {
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
        text_size: 19,
        text: isLastSlot ? '⏭️ Saltar al Resumen' : '⏭️ Saltar este Ejercicio',
        click_func: () => {
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
        text_size: 19,
        text: '⏮️ Ejercicio Anterior',
        click_func: () => {
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
        text_size: 19,
        text: `➕ Serie Extra (Total: ${totalSets + 1})`,
        click_func: () => {
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
        text_size: 19,
        text: `➖ Quitar 1 Serie (Total: ${Math.max(1, totalSets - 1)})`,
        click_func: () => {
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
        text_size: 19,
        text: '🔄 Sincronizar con Móvil',
        click_func: async () => {
          try {
            await app.checkPhoneLiveSession()
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
        text_size: 19,
        text: '🏁 Finalizar Entrenamiento',
        click_func: () => {
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
        h: 62,
        radius: 31,
        normal_color: 0x334155,
        press_color: 0x475569,
        color: 0xf8fafc,
        text_size: 18,
        text: '▼ Cerrar Menú (Volver)',
        click_func: () => {
          back()
        }
      })
      curY += 62 + 70 // Margen inferior generoso para librar la curvatura redonda del bisel

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
