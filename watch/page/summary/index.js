/**
 * VigorexiApp Watch - Resumen de Sesión Completada (Round 466x466)
 */

import * as hmUI from '@zos/ui'
import { replace } from '@zos/router'
import { loadWorkoutData } from '../../utils/storage'
import { THEME_COLORS } from '../../utils/theme'
import { getPendingOutboxCount } from '../../utils/sync_bridge'

Page({
  onInit() {
    const app = getApp()
    if (app && typeof app.flushPendingOutbox === 'function') {
      app.flushPendingOutbox()
    }
  },

  onResume() {
    const app = getApp()
    if (app && typeof app.flushPendingOutbox === 'function') {
      app.flushPendingOutbox()
    }
  },

  build() {
    const data = loadWorkoutData()
    const lastSession = (data.history && data.history.length > 0) ? data.history[0] : null

    // 0. ANILLO PERIMETRAL DE COMPLETADO (Verde esmeralda)
    hmUI.createWidget(hmUI.widget.ARC, {
      x: 8,
      y: 8,
      w: 450,
      h: 450,
      start_angle: -90,
      end_angle: 270,
      color: THEME_COLORS.emerald,
      line_width: 8
    })

    // 1. TÍTULO DE ÉXITO
    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 33,
      y: 38,
      w: 400,
      h: 34,
      color: THEME_COLORS.emerald,
      text_size: 24,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: '🎉 ¡ENTRENO COMPLETADO!'
    })

    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 33,
      y: 72,
      w: 400,
      h: 26,
      color: THEME_COLORS.gold,
      text_size: 18,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: lastSession ? lastSession.dayName : 'Sesión Finalizada'
    })

    // Calcular estadísticas
    let totalSeries = 0
    let totalExCount = 0
    let durationMin = (lastSession && lastSession.durationMinutes) || 0
    let hrAvg = (lastSession && lastSession.hrAvg) || 0
    let hrMax = (lastSession && lastSession.hrMax) || 0

    if (lastSession && lastSession.exercises) {
      totalExCount = lastSession.exercises.length
      lastSession.exercises.forEach(e => {
        totalSeries += (e.sets ? e.sets.length : 0)
      })
    }

    // 2. TARJETA DE MÉTRICAS (Fondo oscuro elevado)
    const cardY = 106
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 63,
      y: cardY,
      w: 340,
      h: 170,
      radius: 20,
      normal_color: THEME_COLORS.surface,
      press_color: THEME_COLORS.surface,
      color: 0xffffff,
      text: ''
    })

    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 85,
      y: cardY + 14,
      w: 296,
      h: 32,
      color: THEME_COLORS.textMain,
      text_size: 18,
      align_h: hmUI.align.LEFT,
      align_v: hmUI.align.CENTER_V,
      text: `💪 Series: ${totalSeries} efectivas`
    })

    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 85,
      y: cardY + 52,
      w: 296,
      h: 32,
      color: THEME_COLORS.cyan,
      text_size: 18,
      align_h: hmUI.align.LEFT,
      align_v: hmUI.align.CENTER_V,
      text: `⏱️ Duración: ${durationMin} min`
    })

    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 85,
      y: cardY + 90,
      w: 296,
      h: 32,
      color: THEME_COLORS.roseHeart,
      text_size: 18,
      align_h: hmUI.align.LEFT,
      align_v: hmUI.align.CENTER_V,
      text: `❤️ FC Med: ${hrAvg > 0 ? hrAvg : '--'} • Máx ${hrMax > 0 ? hrMax : '--'} bpm`
    })

    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 85,
      y: cardY + 128,
      w: 296,
      h: 28,
      color: THEME_COLORS.textMuted,
      text_size: 16,
      align_h: hmUI.align.LEFT,
      align_v: hmUI.align.CENTER_V,
      text: `🏋️ Ejercicios: ${totalExCount} realizados`
    })

    // 3. ESTADO DE SINCRONIZACIÓN
    const pendCount = getPendingOutboxCount()
    const syncStatusText = pendCount > 0 
      ? `⏳ En cola (${pendCount}), se enviará al conectar` 
      : '✅ Enviado y sincronizado con el móvil'

    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 43,
      y: 288,
      w: 380,
      h: 24,
      color: pendCount > 0 ? THEME_COLORS.timerAmber : THEME_COLORS.emerald,
      text_size: 14,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: syncStatusText
    })

    // 4. BOTÓN "LISTO"
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 103,
      y: 324,
      w: 260,
      h: 56,
      radius: 28,
      normal_color: THEME_COLORS.surfaceSubtle,
      press_color: THEME_COLORS.stepperPress,
      color: THEME_COLORS.textMain,
      text_size: 20,
      text: 'Listo ➔',
      click_func: () => {
        replace({ url: 'page/day_select/index' })
      }
    })

    // Reloj inferior (Hora actual - Limpio)
    const now = new Date()
    const h = now.getHours()
    const m = now.getMinutes()
    const hStr = h < 10 ? '0' + h : '' + h
    const mStr = m < 10 ? '0' + m : '' + m
    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 108,
      y: 388,
      w: 250,
      h: 38,
      color: 0xf1f5f9,
      text_size: 26,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: `${hStr}:${mStr}`
    })
  }
})
