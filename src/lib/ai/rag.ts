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

// ─── Detección de intención estructural ───────────────────────────────────────

interface StructuralIntent {
  status?: TaskStatus
  priority?: TaskPriority
}

function detectStructuralIntent(query: string): StructuralIntent {
  const q = query.toLowerCase()
  const intent: StructuralIntent = {}

  // Estado — orden importa: más específico primero
  if (/en progreso|en curso|trabajando|activ/.test(q)) intent.status = 'in_progress'
  else if (/por hacer|para hacer|pendiente|sin empezar|backlog|que me falta|que falta/.test(q)) intent.status = 'todo'
  else if (/complet|termin|hech|done|listo|finaliz/.test(q)) intent.status = 'done'

  // Prioridad
  if (/urgent|críti|alta prioridad|prioridad alta|importante/.test(q)) intent.priority = 'high'
  else if (/media|prioridad media|normal/.test(q)) intent.priority = 'medium'
  else if (/baja|prioridad baja|low/.test(q)) intent.priority = 'low'

  return intent
}

// ─── Consulta estructural directa por SQL ─────────────────────────────────────

async function searchTasksByFilter(
  intent: StructuralIntent,
  userId: string,
  limit: number
): Promise<TaskSearchResult[]> {
  const supabase = await createClient()

  let query = supabase
    .from('tasks')
    .select('id, title, description, status, priority')
    .eq('user_id', userId)
    .order('position', { ascending: true })
    .limit(limit)

  if (intent.status) query = query.eq('status', intent.status)
  if (intent.priority) query = query.eq('priority', intent.priority)

  const { data, error } = await query

  if (error) {
    console.error('[rag] Error en búsqueda estructural:', error)
    return []
  }

  return (data ?? []).map(t => ({
    task_id: t.id,
    title: t.title,
    description: t.description,
    status: t.status as TaskStatus,
    priority: t.priority as TaskPriority,
    similarity: 1.0, // máxima relevancia por ser match exacto
  }))
}

// ─── Búsqueda semántica por embeddings ────────────────────────────────────────

async function searchTasksBySemantic(
  query: string,
  userId: string,
  threshold: number,
  limit: number
): Promise<TaskSearchResult[]> {
  const queryEmbedding = await generateQueryEmbedding(query)
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('search_tasks_by_embedding', {
    query_embedding: queryEmbedding as unknown as string,
    similarity_threshold: threshold,
    match_count: limit,
    p_user_id: userId,
  })

  if (error) {
    console.error('[rag] Error en búsqueda vectorial:', error)
    return []
  }

  return (data as TaskSearchResult[]) ?? []
}

// ─── Fusión de resultados deduplicada ─────────────────────────────────────────

function mergeResults(
  structural: TaskSearchResult[],
  semantic: TaskSearchResult[],
  limit: number
): TaskSearchResult[] {
  const seen = new Set<string>()
  const merged: TaskSearchResult[] = []

  // Primero los estructurales (match exacto por estado/prioridad)
  for (const t of structural) {
    if (!seen.has(t.task_id)) {
      seen.add(t.task_id)
      merged.push(t)
    }
  }

  // Luego los semánticos no duplicados
  for (const t of semantic) {
    if (!seen.has(t.task_id)) {
      seen.add(t.task_id)
      merged.push(t)
    }
  }

  return merged.slice(0, limit)
}

// ─── Función principal híbrida ────────────────────────────────────────────────

export async function searchTasksByQuery(
  query: string,
  options: { threshold?: number; limit?: number; userId?: string } = {}
): Promise<TaskSearchResult[]> {
  const { threshold = 0.3, limit = 10, userId } = options

  if (!userId) {
    console.error('[rag] userId requerido')
    return []
  }

  const intent = detectStructuralIntent(query)
  const hasStructuralIntent = Object.keys(intent).length > 0

  if (hasStructuralIntent) {
    // Query estructural + semántica en paralelo
    const [structural, semantic] = await Promise.all([
      searchTasksByFilter(intent, userId, limit),
      searchTasksBySemantic(query, userId, threshold, limit),
    ])
    return mergeResults(structural, semantic, limit)
  }

  // Solo semántica para queries abstractas
  return searchTasksBySemantic(query, userId, threshold, limit)
}

// ─── Helpers de presentación ──────────────────────────────────────────────────

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

// ─── Resumen global del proyecto ──────────────────────────────────────────────

export interface ProjectSummary {
  total: number
  done: number
  in_progress: number
  todo: number
  overdue: number
  daysLeft: number
  deliveryDate: string
}

export async function getProjectSummary(userId: string): Promise<ProjectSummary> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tasks')
    .select('status, due_date')
    .eq('user_id', userId)

  const tasks = data ?? []
  const now = new Date()
  const deliveryDate = new Date('2025-05-12')
  const daysLeft = Math.ceil((deliveryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  return {
    total: tasks.length,
    done: tasks.filter(t => t.status === 'done').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    todo: tasks.filter(t => t.status === 'todo').length,
    overdue: tasks.filter(t => t.due_date && new Date(t.due_date) < now && t.status !== 'done').length,
    daysLeft: Math.max(0, daysLeft),
    deliveryDate: deliveryDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
  }
}

export function buildSystemPrompt(contextBlock: string, voiceMode = false, project?: ProjectSummary): string {
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

${project ? `
RESUMEN DEL PROYECTO:
- Total de tareas: ${project.total}
- Completadas: ${project.done} (${Math.round(project.done / project.total * 100)}%)
- En progreso: ${project.in_progress}
- Por hacer: ${project.todo}
- Vencidas sin completar: ${project.overdue}
- Días restantes hasta entrega (${project.deliveryDate}): ${project.daysLeft}
- Velocidad requerida: ${project.daysLeft > 0 ? ((project.in_progress + project.todo) / project.daysLeft).toFixed(1) : 'N/A'} tareas/día
` : ''}

TAREAS RELEVANTES:
${contextBlock}

${formatInstructions}

- Si el usuario pregunta por tareas urgentes, prioriza prioridad alta y estado en progreso.
- Si no hay tareas relevantes, indícalo con honestidad.
- No inventes tareas que no estén en el contexto.

Fecha actual: ${new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`
}