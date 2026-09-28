/**
 * VigorexiApp Watch - Resumen de Sesión Completada (Round 466x466)
 */

import * as hmUI from '@zos/ui'
import { replace } from '@zos/router'
import { loadWorkoutData } from '../../utils/storage'
import { vibrateShort } from '../../utils/haptics'

Page({
  build() {
    const data = loadWorkoutData()
    const lastSession = (data.history && data.history.length > 0) ? data.history[0] : null

    // 1. TÍTULO DE ÉXITO
    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 33,
      y: 50,
      w: 400,
      h: 36,
      color: 0x10b981, // Emerald green
      text_size: 23,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: '🎉 ¡ENTRENO COMPLETADO!'
    })

    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 33,
      y: 90,
      w: 400,
      h: 28,
      color: 0xfbbf24, // Gold / Amber
      text_size: 18,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: lastSession ? lastSession.dayName : 'Sesión Finalizada'
    })

    // Calcular estadísticas
    let totalSeries = 0
    let totalExCount = 0
    let durationMin = (lastSession && lastSession.durationMinutes) || 0

    if (lastSession && lastSession.exercises) {
      totalExCount = lastSession.exercises.length
      lastSession.exercises.forEach(e => {
        totalSeries += (e.sets ? e.sets.length : 0)
      })
    }

    // 2. TARJETAS DE MÉTRICAS (Fondo oscuro elegante)
    const cardY = 135
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 63,
      y: cardY,
      w: 340,
      h: 155,
      radius: 20,
      normal_color: 0x1e293b,
      press_color: 0x1e293b,
      color: 0xffffff,
      text: ''
    })

    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 80,
      y: cardY + 20,
      w: 306,
      h: 32,
      color: 0xffffff,
      text_size: 18,
      align_h: hmUI.align.LEFT,
      align_v: hmUI.align.CENTER_V,
      text: `⏱️ Duración: ${durationMin} min`
    })

    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 80,
      y: cardY + 62,
      w: 306,
      h: 32,
      color: 0x38bdf8,
      text_size: 18,
      align_h: hmUI.align.LEFT,
      align_v: hmUI.align.CENTER_V,
      text: `🏋️ Ejercicios: ${totalExCount} realizados`
    })

    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 80,
      y: cardY + 104,
      w: 306,
      h: 32,
      color: 0x10b981,
      text_size: 18,
      align_h: hmUI.align.LEFT,
      align_v: hmUI.align.CENTER_V,
      text: `💪 Total Series: ${totalSeries} efectivas`
    })

    // 3. BOTÓN VOLVER
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 83,
      y: 325,
      w: 300,
      h: 54,
      radius: 27,
      normal_color: 0x10b981,
      press_color: 0x059669,
      color: 0xffffff,
      text_size: 18,
      text: '🏠 Volver al Inicio',
      click_func: () => {
        vibrateShort()
        replace({ url: 'page/day_select/index' })
      }
    })

    // Reloj inferior (Hora actual)
    const now = new Date()
    const h = now.getHours()
    const m = now.getMinutes()
    const hStr = h < 10 ? '0' + h : '' + h
    const mStr = m < 10 ? '0' + m : '' + m
    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 103,
      y: 392,
      w: 260,
      h: 28,
      color: 0x94a3b8,
      text_size: 16,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: `🕒 ${hStr}:${mStr}`
    })
  }
})
