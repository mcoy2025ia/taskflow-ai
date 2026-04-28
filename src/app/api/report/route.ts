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

  const prompt = `Eres un analista de datos senior. Genera un informe ejecutivo en español de exactamente 3 párrafos sobre el estado de este proyecto de pipeline de datos (Pipeline Olist).

Datos actuales:
- Total de tareas: ${summary.total}
- Completadas: ${summary.done} (${pct}%)
- En progreso: ${summary.in_progress}
- Por hacer: ${summary.todo}
- Vencidas sin completar: ${summary.overdue}
- Días restantes hasta entrega (${summary.deliveryDate}): ${summary.daysLeft}
- Velocidad requerida: ${velocityRequired} tareas/día

Estructura los 3 párrafos así:
1. Estado actual del proyecto con métricas concretas
2. Riesgos identificados y factores críticos
3. Recomendaciones de acción inmediata

Responde SOLO con el texto, sin títulos, sin markdown, sin bullets.`

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
      temperature: 0.4,
      max_tokens: 600,
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
