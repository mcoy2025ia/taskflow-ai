import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { ratelimit } from '@/lib/ratelimit'
import { isBot, botBlockResponse } from '@/lib/bot-guard'

export const runtime = 'nodejs'

const ReportSummarySchema = z.object({
  total:       z.number().int().min(0).max(100_000),
  done:        z.number().int().min(0).max(100_000),
  in_progress: z.number().int().min(0).max(100_000),
  todo:        z.number().int().min(0).max(100_000),
  overdue:     z.number().int().min(0).max(100_000),
  daysLeft:    z.number().int().min(0).max(3650),
  deliveryDate: z.string().max(100),
  projectId:   z.string().uuid().optional(),
})

type ReportSummary = z.infer<typeof ReportSummarySchema>

interface PhaseRow {
  name: string
  total: number
  done: number
  sort_order: number
}

function phaseStatus(done: number, total: number): string {
  if (total === 0) return 'Sin tareas'
  if (done === total) return 'COMPLETA'
  if (done === 0) return 'Sin iniciar'
  return 'En ejecución'
}

function buildPhasesBlock(phases: PhaseRow[]): string {
  if (phases.length === 0) return 'No hay fases registradas para este proyecto.'
  return phases
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(ph => {
      const pct = ph.total > 0 ? Math.round((ph.done / ph.total) * 100) : 0
      return `- ${ph.name}: ${ph.done}/${ph.total} (${pct}%) — ${phaseStatus(ph.done, ph.total)}`
    })
    .join('\n')
}

export async function POST(request: NextRequest) {
  if (isBot(request)) return botBlockResponse()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { limited, headers: rlHeaders } = await ratelimit.report(user.id)
  if (limited) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Espera un momento.' },
      { status: 429, headers: rlHeaders }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = ReportSummarySchema.safeParse(body?.summary)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }
  const summary: ReportSummary = parsed.data

  const pct = summary.total > 0 ? Math.round(summary.done / summary.total * 100) : 0
  const pending = summary.in_progress + summary.todo

  // Leer proyecto y fases reales desde la DB
  let startUTC = new Date(Date.UTC(new Date().getFullYear(), 0, 1))
  let endUTC   = new Date(Date.UTC(new Date().getFullYear(), 11, 31))
  let projectName = 'Proyecto'
  let phases: PhaseRow[] = []

  if (summary.projectId) {
    const [{ data: project }, { data: phaseData }] = await Promise.all([
      supabase
        .from('projects')
        .select('name, start_date, delivery_date')
        .eq('id', summary.projectId)
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('project_phases')
        .select('name, total, done, sort_order')
        .eq('project_id', summary.projectId)
        .order('sort_order'),
    ])

    if (project) {
      const [sy, sm, sd] = project.start_date.split('-').map(Number)
      const [ey, em, ed] = project.delivery_date.split('-').map(Number)
      startUTC = new Date(Date.UTC(sy, sm - 1, sd))
      endUTC   = new Date(Date.UTC(ey, em - 1, ed))
      projectName = project.name
    }

    phases = (phaseData ?? []) as PhaseRow[]
  }

  const nowUTC      = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()))
  const totalDays   = Math.floor((endUTC.getTime() - startUTC.getTime()) / 86400000)
  const isOverdue   = nowUTC > endUTC
  const daysOverdue = isOverdue ? Math.floor((nowUTC.getTime() - endUTC.getTime()) / 86400000) : 0
  const effectiveNow  = isOverdue ? endUTC : nowUTC
  const daysElapsed   = Math.max(1, Math.floor((effectiveNow.getTime() - startUTC.getTime()) / 86400000))
  const timePct       = Math.round((daysElapsed / totalDays) * 100)
  const weeksElapsed  = Math.max(1, Math.floor(daysElapsed / 7))
  const velocityActual   = (summary.done / daysElapsed).toFixed(2)
  const velocityWeekly   = (summary.done / weeksElapsed).toFixed(1)
  const velocityRequired = !isOverdue && summary.daysLeft > 0
    ? (pending / summary.daysLeft).toFixed(2)
    : 'N/A'
  const velocityGap = velocityRequired !== 'N/A'
    ? (parseFloat(velocityRequired) - parseFloat(velocityActual)).toFixed(2)
    : 'N/A'
  const deficit = velocityGap !== 'N/A' && parseFloat(velocityGap) > 0

  const startLabel = startUTC.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
  const endLabel   = endUTC.toLocaleDateString('es-CO',   { day: 'numeric', month: 'long', year: 'numeric' })
  const today      = nowUTC.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const phasesBlock = buildPhasesBlock(phases)

  const prompt = `Eres el líder de datos del proyecto "${projectName}". Redacta un informe ejecutivo formal dirigido al patrocinador del proyecto.

DATOS DEL PROYECTO:
- Fecha de corte del informe: ${today}
- Inicio: ${startLabel}
- Fin planificado: ${endLabel}
- Duración total: ${totalDays} días
- Días transcurridos: ${daysElapsed} de ${totalDays} (${timePct}% del tiempo consumido)
- Días restantes: ${summary.daysLeft}
${isOverdue ? `- PROYECTO VENCIDO: han transcurrido ${daysOverdue} días desde la fecha de entrega` : ''}

ESTADO DE TAREAS:
- Total: ${summary.total} tareas
- Completadas: ${summary.done} (${pct}% del total)
- En progreso: ${summary.in_progress}
- Por hacer: ${summary.todo}
- Vencidas sin completar: ${summary.overdue}
- Brecha avance vs tiempo: tareas ${pct}% completadas con ${timePct}% del tiempo consumido

FASES DEL PROYECTO:
${phasesBlock}

VELOCIDAD:
- Actual: ${velocityActual} tareas/día | ${velocityWeekly} tareas/semana
- Requerida para entregar a tiempo: ${velocityRequired} tareas/día
- Brecha: ${velocityGap} tareas/día — ${deficit ? 'DÉFICIT CRÍTICO' : 'margen positivo'}
- Semana actual del proyecto: semana ${weeksElapsed + 1} de ${Math.ceil(totalDays / 7)}

Estructura el informe con estos títulos exactos seguidos de dos puntos y el texto en el mismo párrafo:

RESUMEN EJECUTIVO: Fecha de inicio, fecha de entrega, días restantes, porcentaje de avance en tareas vs porcentaje de tiempo consumido. Si hay brecha entre ambos, cuantifícala como señal de alerta.

ESTADO SEMANAL: En qué semana del proyecto estamos, velocidad semanal promedio real, cuántas tareas por semana se necesitan para cerrar a tiempo, y si esa velocidad es alcanzable.

ESTADO POR FASE: Para cada fase activa o pendiente describe en una oración: estado actual y nivel de riesgo (ALTO/MEDIO/BAJO). Basa tu análisis solo en los datos proporcionados.

RECOMENDACIONES: Tres recomendaciones numeradas, concretas, con nombre de fase o área específica. Sin generalidades.

VISIÓN CRÍTICA: Sin eufemismos — ¿se cumplirá la entrega el ${endLabel}? Presenta los dos escenarios posibles con los números que los respaldan. Si la entrega no es viable, dilo directamente.

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
