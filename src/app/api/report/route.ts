import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface ReportSummary {
  total: number
  done: number
  in_progress: number
  todo: number
  overdue: number
  daysLeft: number
  deliveryDate: string
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { summary }: { summary: ReportSummary } = await request.json()

  const pct = Math.round(summary.done / summary.total * 100)
  const pending = summary.in_progress + summary.todo
  const totalDays = 75
  const daysElapsed = totalDays - summary.daysLeft
  const timePct = Math.round((daysElapsed / totalDays) * 100)
  const weeksElapsed = Math.max(1, Math.floor(daysElapsed / 7))
  const velocityActual = (summary.done / Math.max(1, daysElapsed)).toFixed(2)
  const velocityWeekly = (summary.done / weeksElapsed).toFixed(1)
  const velocityRequired = summary.daysLeft > 0 ? (pending / summary.daysLeft).toFixed(2) : 'N/A'
  const velocityGap = summary.daysLeft > 0
    ? (parseFloat(velocityRequired) - parseFloat(velocityActual)).toFixed(2)
    : 'N/A'
  const deficit = velocityGap !== 'N/A' && parseFloat(velocityGap) > 0

  const today = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  const prompt = `Eres el líder de datos de un proyecto de ingeniería de datos y machine learning sobre el dataset público de Olist (e-commerce brasileño). Redacta un informe ejecutivo formal dirigido al patrocinador del proyecto.

DATOS DEL PROYECTO:
- Fecha de corte del informe: ${today}
- Inicio: 27 de febrero de 2025
- Fin planificado: 12 de mayo de 2025
- Duración total: ${totalDays} días
- Días transcurridos: ${daysElapsed} de ${totalDays} (${timePct}% del tiempo consumido)
- Días restantes: ${summary.daysLeft}

ESTADO DE TAREAS:
- Total: ${summary.total} tareas
- Completadas: ${summary.done} (${pct}% del total)
- En progreso: ${summary.in_progress}
- Por hacer: ${summary.todo}
- Vencidas sin completar: ${summary.overdue}
- Brecha avance vs tiempo: tareas ${pct}% completadas con ${timePct}% del tiempo consumido

FASES DEL PIPELINE:
- Bronze: 6/6 COMPLETA
- Silver: 6/6 COMPLETA
- Gold: 0/3 en ejecución — bloqueante para ML y Dashboards
- Feature Engineering: 0/4 en ejecución — bloqueante para ML
- Selección de Modelos ML: 2/5 iniciados — depende de Gold y Feature Eng.
- Dashboards: 0/3 sin iniciar — depende de Gold
- Informe y Despliegue: 0/2 sin iniciar — depende de todo lo anterior

VELOCIDAD:
- Actual: ${velocityActual} tareas/día | ${velocityWeekly} tareas/semana
- Requerida para entregar a tiempo: ${velocityRequired} tareas/día
- Brecha: ${velocityGap} tareas/día — ${deficit ? 'DÉFICIT CRÍTICO' : 'margen positivo'}
- Semana actual del proyecto: semana ${weeksElapsed + 1} de ${Math.ceil(totalDays / 7)}

Estructura el informe con estos títulos exactos seguidos de dos puntos y el texto en el mismo párrafo:

RESUMEN EJECUTIVO: Fecha de inicio, fecha de entrega, días restantes, porcentaje de avance en tareas vs porcentaje de tiempo consumido. Si hay brecha entre ambos, cuantifícala como señal de alerta.

ESTADO SEMANAL: En qué semana del proyecto estamos, velocidad semanal promedio real, cuántas tareas por semana se necesitan para cerrar a tiempo, y si esa velocidad es alcanzable.

ESTADO POR FASE: Para cada fase activa o pendiente (Gold, Feature Eng., ML, Dashboards, Informe) describe en una oración: estado actual, si es bloqueante, y nivel de riesgo (ALTO/MEDIO/BAJO).

RECOMENDACIONES: Tres recomendaciones numeradas, concretas, con nombre de fase o tarea específica. Sin generalidades.

VISIÓN CRÍTICA: Sin eufemismos — ¿se cumplirá la entrega el 12 de mayo? Presenta los dos escenarios posibles con los números que los respaldan. Si la entrega no es viable, dilo directamente.

Máximo 120 palabras por sección. Sin markdown, sin bullets, sin asteriscos. Solo texto plano con los títulos en mayúsculas seguidos de dos puntos.`

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      temperature: 0.75,
      max_tokens: 1500,
    }),
  })

  if (!response.ok) {
    console.error('[api/report] Groq error:', response.status)
    return NextResponse.json({ error: 'LLM error' }, { status: 500 })
  }

  const data = await response.json()
  const narrative = data.choices?.[0]?.message?.content ?? ''

  return NextResponse.json({ narrative })
}