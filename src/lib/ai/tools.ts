import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

// ── Definiciones de tools para Groq/OpenAI ───────────────────────────────────

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export const TASK_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Crea una nueva tarea en el tablero Kanban del usuario. Úsala cuando el usuario pida crear, agregar o añadir una tarea.',
      parameters: {
        type: 'object',
        properties: {
          title:       { type: 'string', description: 'Título de la tarea. Máximo 200 caracteres.' },
          description: { type: 'string', description: 'Descripción detallada (opcional).' },
          status:      { type: 'string', enum: ['todo', 'in_progress', 'done'], description: 'Estado inicial. Por defecto: todo.' },
          priority:    { type: 'string', enum: ['low', 'medium', 'high'],       description: 'Prioridad. Por defecto: medium.' },
          due_date:    { type: 'string', description: 'Fecha límite en formato ISO 8601 (opcional). Ej: 2025-05-15T00:00:00.000Z' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'Actualiza los campos de una tarea existente. Úsala para cambiar título, descripción, prioridad o fecha límite. Para mover entre columnas usa move_task.',
      parameters: {
        type: 'object',
        properties: {
          task_id:     { type: 'string', description: 'ID UUID de la tarea a actualizar.' },
          title:       { type: 'string', description: 'Nuevo título (opcional).' },
          description: { type: 'string', description: 'Nueva descripción (opcional).' },
          priority:    { type: 'string', enum: ['low', 'medium', 'high'], description: 'Nueva prioridad (opcional).' },
          due_date:    { type: 'string', description: 'Nueva fecha límite ISO 8601 (opcional).' },
        },
        required: ['task_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'move_task',
      description: 'Mueve una tarea a otra columna del tablero Kanban (cambia su estado). Úsala cuando el usuario quiera marcar una tarea como completada, iniciarla o moverla.',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'ID UUID de la tarea.' },
          status:  { type: 'string', enum: ['todo', 'in_progress', 'done'], description: 'Nuevo estado de la tarea.' },
        },
        required: ['task_id', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_task',
      description: 'Elimina permanentemente una tarea. Úsala solo cuando el usuario pida explícitamente eliminar o borrar una tarea.',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'ID UUID de la tarea a eliminar.' },
        },
        required: ['task_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_tasks',
      description: 'Busca tareas del usuario por texto libre, estado o prioridad. Úsala cuando necesites encontrar tareas específicas para operar sobre ellas.',
      parameters: {
        type: 'object',
        properties: {
          query:    { type: 'string', description: 'Texto de búsqueda libre.' },
          status:   { type: 'string', enum: ['todo', 'in_progress', 'done'], description: 'Filtrar por estado (opcional).' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'],       description: 'Filtrar por prioridad (opcional).' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_comments',
      description: 'Busca comentarios en las tareas del proyecto por texto libre. Útil cuando el usuario pregunta por discusiones, notas o contexto dejado en comentarios.',
      parameters: {
        type: 'object',
        properties: {
          query:   { type: 'string', description: 'Texto a buscar en el contenido de comentarios.' },
          task_id: { type: 'string', description: 'ID UUID de la tarea específica (opcional). Si no se provee, busca en todas.' },
        },
        required: ['query'],
      },
    },
  },
]

// ── Ejecutor de tools ─────────────────────────────────────────────────────────

interface ToolContext {
  supabase: SupabaseClient<Database>
  userId: string
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const { supabase, userId } = ctx

  switch (name) {
    case 'create_task': {
      // Calcular posición: al final de la columna
      const status = ((args.status as string) ?? 'todo') as 'todo' | 'in_progress' | 'done'
      const { data: maxPos } = await supabase
        .from('tasks')
        .select('position')
        .eq('user_id', userId)
        .eq('status', status)
        .order('position', { ascending: false })
        .limit(1)
        .single()

      const position = maxPos ? maxPos.position + 1000 : 1000

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id:     userId,
          title:       args.title as string,
          description: (args.description as string) ?? null,
          status:      status as 'todo' | 'in_progress' | 'done',
          priority:    ((args.priority as string) ?? 'medium') as 'low' | 'medium' | 'high',
          due_date:    (args.due_date as string) ?? null,
          position,
        })
        .select('id, title')
        .single()

      if (error) return `Error al crear la tarea: ${error.message}`
      return `Tarea creada correctamente: "${data.title}" (id: ${data.id})`
    }

    case 'update_task': {
      const taskId = args.task_id as string
      const updates: {
        title?: string
        description?: string | null
        priority?: 'low' | 'medium' | 'high'
        due_date?: string | null
      } = {}
      if (args.title       !== undefined) updates.title       = args.title as string
      if (args.description !== undefined) updates.description = (args.description as string | null) ?? null
      if (args.priority    !== undefined) updates.priority    = args.priority as 'low' | 'medium' | 'high'
      if (args.due_date    !== undefined) updates.due_date    = (args.due_date as string | null) ?? null

      if (Object.keys(updates).length === 0) return 'No se proporcionaron campos para actualizar.'

      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .eq('user_id', userId)

      if (error) return `Error al actualizar la tarea: ${error.message}`
      return `Tarea ${taskId} actualizada correctamente.`
    }

    case 'move_task': {
      const taskId = args.task_id as string
      const newStatus = args.status as 'todo' | 'in_progress' | 'done'

      const { data: maxPos } = await supabase
        .from('tasks')
        .select('position')
        .eq('user_id', userId)
        .eq('status', newStatus)
        .order('position', { ascending: false })
        .limit(1)
        .single()

      const position = maxPos ? maxPos.position + 1000 : 1000

      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus, position })
        .eq('id', taskId)
        .eq('user_id', userId)

      if (error) return `Error al mover la tarea: ${error.message}`
      return `Tarea ${taskId} movida a "${newStatus}" correctamente.`
    }

    case 'delete_task': {
      const taskId = args.task_id as string
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', userId)

      if (error) return `Error al eliminar la tarea: ${error.message}`
      return `Tarea ${taskId} eliminada correctamente.`
    }

    case 'search_tasks': {
      let query = supabase
        .from('tasks')
        .select('id, title, status, priority, due_date')
        .eq('user_id', userId)
        .order('position', { ascending: true })
        .limit(10)

      if (args.status)   query = query.eq('status',   args.status   as 'todo' | 'in_progress' | 'done')
      if (args.priority) query = query.eq('priority', args.priority as 'low' | 'medium' | 'high')

      const { data, error } = await query
      if (error) return `Error al buscar tareas: ${error.message}`
      if (!data?.length) return 'No se encontraron tareas con esos criterios.'

      return data.map((t, i) =>
        `[${i + 1}] id:${t.id} | "${t.title}" | ${t.status} | prioridad: ${t.priority}`
      ).join('\n')
    }

    case 'search_comments': {
      const query = (args.query as string).trim()
      const taskId = args.task_id as string | undefined

      let dbQuery = supabase
        .from('comments')
        .select('id, task_id, content, created_at')
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(10)

      if (taskId) dbQuery = dbQuery.eq('task_id', taskId)

      const { data, error } = await dbQuery
      if (error) return `Error al buscar comentarios: ${error.message}`
      if (!data?.length) return 'No se encontraron comentarios con esa búsqueda.'

      return data.map((c, i) =>
        `[${i + 1}] tarea:${c.task_id}\n"${c.content.slice(0, 200)}"`
      ).join('\n\n')
    }

    default:
      return `Tool desconocida: ${name}`
  }
}
