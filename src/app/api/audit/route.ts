import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ratelimit } from '@/lib/ratelimit'
import { isBot, botBlockResponse } from '@/lib/bot-guard'
import type { TaskRow, AnalyticsMetrics } from '@/lib/analytics/metrics'

export const runtime = 'nodejs'

// ── Sistema de auditoría: Principal Data Architect & MLOps Tech Lead ─────────
const AUDITOR_SYSTEM = `Actúas como un Principal Data Architect y MLOps Tech Lead con más de 10 años de experiencia auditando arquitecturas de datos cloud-native, pipelines analíticos, sistemas RAG y despliegues de Machine Learning en producción.

Tu tono es riguroso, directo, analítico, crítico y estrictamente técnico. Tu objetivo no es alentar, sino encontrar los Single Points of Failure, cuellos de botella, riesgos de escalabilidad, deuda técnica y violaciones a las mejores prácticas de ingeniería de datos.

REGLAS ESTRICTAS:
1. Ignora métricas de vanidad (porcentajes de avance). Tu evaluación se basa en resiliencia de la arquitectura, calidad del código, pruebas y operatividad real.
2. Piensa en el Día 2 (Operaciones): todo funciona en staging. Cuestiona cómo se monitoreará en producción, qué pasa cuando los datos cambien (data drift) y cómo se manejan las caídas de infraestructura.
3. Foco en Edge Cases: asume que el Happy Path está cubierto. Analiza transacciones a medianoche, nulos inesperados en origen, fallos de red hacia APIs externas, concurrencia masiva.
4. Evalúa siempre: idempotencia del pipeline, connection pooling bajo carga, invalidación de caché, fail-fast vs propagación silenciosa de errores.

FORMATO DE RESPUESTA — usa estos encabezados EXACTOS seguidos de dos puntos:

DIAGNOSTICO ARQUITECTONICO: [párrafo contundente — viabilidad real para producción, no para staging]

ALERTAS CRITICAS (BLOCKERS): [fallos de diseño, riesgos de pérdida de datos o cuellos de botella severos — explica TECNICAMENTE por qué fallará]

RIESGOS OPERATIVOS (DEUDA TECNICA): [problemas que no rompen el sistema hoy pero lo harán en 3-6 meses de operación real]

INTERROGATORIO TECNICO: [3 a 5 preguntas muy específicas y difíciles que el equipo DEBE poder responder antes del deploy a producción. Sin respuestas — solo las preguntas]

VEREDICTO DE MADUREZ: [una de estas opciones exactas: Prototipo / Staging / Produccion Condicionada / Produccion Segura] — seguido de una oración que justifique el veredicto con datos concretos del proyecto.

Máximo 130 palabras por sección. Sin markdown, sin bullets con guión, sin asteriscos. Texto técnico plano. Los encabezados en MAYUSCULAS seguidos de dos puntos.`

// ── Construcción del mensaje del usuario ──────────────────────────────────────
function buildUserMessage(
  tasks: TaskRow[],
  metrics: AnalyticsMetrics,
  projectName: string,
): string {
  const doneTasks = tasks.filter(t => t.status === 'done')
  const ipTasks   = tasks.filter(t => t.status === 'in_progress')
  const todoTasks = tasks.filter(t => t.status === 'todo')

  // Muestra representativa de lo que está hecho (inferir el stack completo)
  const doneSample = doneTasks
    .map(t => t.title ?? '')
    .filter(Boolean)
    .join('\n')

  const ipList = ipTasks
    .map(t => `[${(t.priority ?? 'medium').toUpperCase()}] ${t.title ?? '(sin título)'}`)
    .join('\n')

  const todoList = todoTasks
    .map(t => `[${(t.priority ?? 'medium').toUpperCase()}] ${t.title ?? '(sin título)'}`)
    .join('\n')

  const timePct = metrics.totalDays > 0
    ? Math.round((metrics.daysElapsed / metrics.totalDays) * 100)
    : 0

  return `Audita la arquitectura del siguiente proyecto de datos en producción inminente:

PROYECTO: ${projectName}
AVANCE: ${metrics.done}/${metrics.total} tareas completadas (${metrics.pct}% tareas | ${timePct}% tiempo consumido)
DIAS RESTANTES PARA ENTREGA: ${metrics.daysLeft}
RIESGO DE ENTREGA: ${metrics.atRisk ? 'SI — velocidad insuficiente' : 'NO — dentro de margen'}

STACK TECNOLOGICO INFERIDO DE LAS TAREAS COMPLETADAS (${doneTasks.length} tareas):
${doneSample}

TRABAJO EN PROGRESO AHORA (${ipTasks.length} tareas — estas bloquean el release):
${ipList || '(ninguna)'}

PENDIENTE / BLOQUEANDO RELEASE FINAL (${todoTasks.length} tareas):
${todoList || '(ninguna)'}

METRICAS DE EJECUCION:
- Velocidad actual: ${metrics.velocityActual} tareas/dia
- Velocidad requerida para entregar a tiempo: ${metrics.velocityRequired} tareas/dia
- Velocidad semanal: ${metrics.velocityWeekly} tareas/semana
- Tareas vencidas sin completar: ${metrics.overdue}
- Tareas pendientes totales: ${metrics.pending}

Proporciona tu auditoría técnica completa. Sé implacable y específico. Cita las tareas del stack por nombre cuando identifiques riesgos.`
}

// ── Llamada a Groq ────────────────────────────────────────────────────────────
async function callGroq(userMessage: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: AUDITOR_SYSTEM },
        { role: 'user',   content: userMessage },
      ],
      stream: false,
      temperature: 0.35,   // bajo: respuestas más deterministas y técnicas
      max_tokens: 2200,
    }),
  })
  if (!res.ok) throw new Error(`Groq ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

// ── Fallback a Anthropic Claude Haiku ────────────────────────────────────────
async function callAnthropic(userMessage: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2200,
      system: AUDITOR_SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}`)
  const data = await res.json()
  return (data.content?.[0]?.text as string) ?? ''
}

// ── Handler principal ────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  if (isBot(request)) return botBlockResponse()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { limited, headers: rlHeaders } = await ratelimit.audit(user.id)
  if (limited) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes al auditor. Espera un momento.' },
      { status: 429, headers: rlHeaders },
    )
  }

  const { tasks, metrics, projectName } = await request.json() as {
    tasks: TaskRow[]
    metrics: AnalyticsMetrics
    projectName: string
  }

  if (!tasks?.length || !metrics) {
    return NextResponse.json({ error: 'Faltan datos para la auditoría' }, { status: 400 })
  }

  const userMessage = buildUserMessage(tasks, metrics, projectName)

  let audit = ''

  try {
    audit = await callGroq(userMessage)
  } catch (groqErr) {
    console.error('[api/audit] Groq falló, intentando Anthropic:', groqErr)
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        audit = await callAnthropic(userMessage)
      } catch (anthropicErr) {
        console.error('[api/audit] Anthropic también falló:', anthropicErr)
      }
    }
  }

  if (!audit) {
    return NextResponse.json(
      { error: 'No se pudo generar la auditoría arquitectónica' },
      { status: 500 },
    )
  }

  return NextResponse.json({ audit })
}
