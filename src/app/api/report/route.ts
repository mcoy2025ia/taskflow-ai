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
  const velocityRequired = summary.daysLeft > 0 ? (pending / summary.daysLeft).toFixed(1) : 'N/A'

  const velocityGap = summary.daysLeft > 0
    ? (parseFloat(velocityRequired) - (summary.done / 60)).toFixed(2)
    : '0'

  const prompt = `Eres el líder de datos de un proyecto de ingeniería de datos y machine learning sobre el dataset público de Olist (e-commerce brasileño). El proyecto tiene 7 fases: Bronze (ingesta y calidad de datos crudos), Silver (transformaciones y joins maestros), Gold (agregaciones de negocio: revenue, CLV, seller performance), Feature Engineering (variables para ML: recencia, reviews, cancelaciones, estacionalidad), Selección de Modelos ML (churn y predicción de retrasos con XGBoost/LightGBM), Dashboards ejecutivos y operacionales, e Informe final con despliegue del modelo.

Estado actual del proyecto al ${new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}:
- Avance global: ${summary.done}/${summary.total} tareas completadas (${pct}%)
- Fases 100% completas: Bronze y Silver
- Fases en ejecución: Gold (0/3), Feature Engineering (0/4), ML baseline (2/5 iniciados)
- Fases sin iniciar: Dashboards (0/3), Informe ejecutivo y despliegue (0/2)
- Tareas en progreso activo: ${summary.in_progress}
- Tareas en backlog: ${summary.todo}
- Tareas vencidas sin completar: ${summary.overdue}
- Días restantes hasta entrega: ${summary.daysLeft} (fecha límite: ${summary.deliveryDate})
- Velocidad actual: ${(summary.done / 60).toFixed(1)} tareas/día (basado en 60 días transcurridos)
- Velocidad requerida para entregar a tiempo: ${velocityRequired} tareas/día
- Brecha de velocidad: ${velocityGap} tareas/día ${parseFloat(velocityGap) > 0 ? '(déficit crítico)' : '(margen positivo)'}

Genera un informe ejecutivo en español de exactamente 3 párrafos densos y específicos, dirigido al patrocinador del proyecto. Usa datos concretos, nombra las fases por su nombre técnico, identifica riesgos reales basados en los números, y propón acciones específicas y accionables (no genéricas). El tono debe ser directo, profesional y sin eufemismos — si hay riesgo de no entregar, dilo claramente.

Párrafo 1: Estado de avance con métricas y qué fases están en riesgo.
Párrafo 2: Análisis de riesgo cuantificado — brecha de velocidad, fases críticas, dependencias bloqueantes entre fases.
Párrafo 3: Plan de acción para los ${summary.daysLeft} días restantes — qué paralizar, qué acelerar, qué negociar con el patrocinador.

Responde SOLO con los 3 párrafos separados por salto de línea doble. Sin títulos, sin markdown, sin bullets. Mínimo 120 palabras por párrafo.`

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
      temperature: 0.7,
      max_tokens: 1000,
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
