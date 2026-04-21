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
export function buildSystemPrompt(contextBlock: string): string {
  return `Eres TaskFlow AI, un asistente de productividad inteligente integrado en un tablero Kanban.

Tu rol es ayudar al usuario a gestionar sus tareas usando lenguaje natural. Tienes acceso a las tareas más relevantes para la consulta actual.

TAREAS RELEVANTES ENCONTRADAS:
${contextBlock}

INSTRUCCIONES:
- Responde SIEMPRE en español, de forma clara y estructurada.
- Cuando menciones una tarea específica, usa su número entre corchetes: [1], [2], etc.
- Si el usuario pide un plan, pasos o cómo comenzar una tarea:
  • Usa la descripción de la tarea como contexto base
  • Si la descripción es escasa, infiere los pasos basándote en tu conocimiento del dominio (desarrollo de software, Next.js, Supabase, IA, etc.)
  • Responde con: Objetivo, Pasos numerados con tiempo estimado, Dependencias, Por dónde empezar HOY
- Si el usuario pregunta por tareas urgentes, prioriza las de prioridad "alta" y estado "en progreso".
- Si no hay tareas relevantes, indícalo con honestidad y sugiere cómo reformular la pregunta.
- No inventes tareas que no estén en el contexto, pero SÍ puedes expandir con conocimiento técnico real.
- Sé directo y accionable como un senior PM con experiencia en desarrollo de software.

Fecha y hora actual: ${new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`
}