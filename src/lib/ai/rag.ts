import { createClient } from '@/lib/supabase/server'
import { generateQueryEmbedding } from './voyage'
import type { TaskStatus, TaskPriority } from '@/types/app.types'

export interface TaskSearchResult {
  task_id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  similarity: number
}

export async function searchTasksByQuery(
  query: string,
  options: {
    threshold?: number
    limit?: number
  } = {}
): Promise<TaskSearchResult[]> {
  const { threshold = 0.65, limit = 5 } = options

  // 1. Embeddear la query con input_type: 'query'
  const queryEmbedding = await generateQueryEmbedding(query)

  // 2. Llamar a la función SQL RLS-safe definida en Fase 2
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('search_tasks_by_embedding', {
    query_embedding: `[${queryEmbedding.join(',')}]`,
    match_threshold: threshold,
    match_count: limit,
  })

  if (error) {
    console.error('[rag] Error en búsqueda vectorial:', error)
    return []
  }

  return (data as TaskSearchResult[]) ?? []
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo:        'Por hacer',
  in_progress: 'En progreso',
  done:        'Completado',
}

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low:    'baja',
  medium: 'media',
  high:   'alta',
}

// Construir el bloque de contexto que se inyecta en el system prompt
export function buildContextBlock(tasks: TaskSearchResult[]): string {
  if (tasks.length === 0) {
    return 'No encontré tareas relevantes para esta consulta.'
  }

  return tasks
    .map((t, i) => {
      const lines = [
        `[${i + 1}] "${t.title}"`,
        `    Estado: ${STATUS_LABELS[t.status]} | Prioridad: ${PRIORITY_LABELS[t.priority]}`,
        `    Relevancia: ${(t.similarity * 100).toFixed(0)}%`,
      ]
      if (t.description) {
        lines.push(`    Descripción: ${t.description.slice(0, 200)}`)
      }
      return lines.join('\n')
    })
    .join('\n\n')
}

// System prompt del asistente RAG
export function buildSystemPrompt(contextBlock: string, voiceMode = false): string {
  const formatInstructions = voiceMode
    ? `MODO VOZ ACTIVO:
- Responde en máximo 2-3 oraciones cortas.
- Sin asteriscos, bullets, ni markdown de ningún tipo.
- Lenguaje conversacional, como si hablaras con alguien.
- Nunca listes más de 3 items. Si hay más, di "entre otras".
- Termina siempre con una pregunta corta de seguimiento.`
    : `MODO TEXTO:
- Responde en español, de forma clara y estructurada.
- Cuando menciones una tarea, usa su número entre corchetes: [1], [2], etc.
- Si el usuario pide un plan: Objetivo, Pasos con tiempo estimado, Dependencias, Por dónde empezar HOY.
- Sé directo y accionable como un senior PM con experiencia en desarrollo de software.`

  return `Eres TaskFlow AI, un asistente de productividad inteligente integrado en un tablero Kanban.
Tu rol es ayudar al usuario a gestionar sus tareas usando lenguaje natural.

TAREAS RELEVANTES:
${contextBlock}

${formatInstructions}

- Si el usuario pregunta por tareas urgentes, prioriza prioridad alta y estado en progreso.
- Si no hay tareas relevantes, indícalo con honestidad.
- No inventes tareas que no estén en el contexto.

Fecha actual: ${new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`
}