'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import * as Sentry from '@sentry/nextjs'
import { revalidatePath } from 'next/cache'

// ── Tipos públicos ────────────────────────────────────────────────────────────
export interface ImportRowError {
  row: number
  field: string
  message: string
}

export interface ImportResult {
  inserted: number
  skipped: number
  errors: ImportRowError[]
}

// ── Esquema de validación por fila ────────────────────────────────────────────
// Más permisivo que CreateTaskSchema: acepta YYYY-MM-DD, ignora campos extra,
// usa defaults cuando el valor es reconocible pero no exacto.
const RowSchema = z.object({
  title: z.string().min(1, 'El título es obligatorio').max(200, 'Máximo 200 caracteres'),
  description: z.string().max(2000, 'Máximo 2000 caracteres').optional().default(''),
  status: z
    .string()
    .transform(v => v.toLowerCase().trim())
    .pipe(z.enum(['todo', 'in_progress', 'done']))
    .catch('todo'),
  priority: z
    .string()
    .transform(v => v.toLowerCase().trim())
    .pipe(z.enum(['low', 'medium', 'high']))
    .catch('medium'),
  due_date: z
    .string()
    .optional()
    .transform(v => {
      if (!v || v.trim() === '') return null
      const trimmed = v.trim()
      // Acepta YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
      // Acepta DD/MM/YYYY → convierte
      const dmy = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
      if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`
      return null
    }),
})

type ValidatedRow = z.infer<typeof RowSchema>

// ── Acción principal ──────────────────────────────────────────────────────────
export async function importTasksCSV(
  projectId: string | undefined | null,
  rawRows: Record<string, string>[],
): Promise<{ success: true; data: ImportResult } | { success: false; error: string }> {
  if (!rawRows || rawRows.length === 0) {
    return { success: false, error: 'No hay filas para importar' }
  }
  if (rawRows.length > 500) {
    return { success: false, error: 'Máximo 500 filas por importación' }
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: 'No autenticado' }

  // Si hay project_id, verificar que el usuario sea miembro editor/owner
  if (projectId) {
    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!membership || !['owner', 'editor'].includes(membership.role)) {
      return { success: false, error: 'No tienes permisos de edición en este proyecto' }
    }
  }

  // Obtener posición máxima actual para asignar posiciones incrementales
  let posQuery = supabase
    .from('tasks')
    .select('position')
    .eq('user_id', user.id)
    .order('position', { ascending: false })
    .limit(1)

  if (projectId) posQuery = posQuery.eq('project_id', projectId)

  let nextPosition = 1000
  try {
    const { data: lastTask } = await posQuery.single()
    nextPosition = ((lastTask as { position?: number } | null)?.position ?? 0) + 1000
  } catch { /* sin tareas previas: empezar en 1000 */ }

  // Validar y clasificar filas
  const errors: ImportRowError[] = []
  const validRows: Array<ValidatedRow & { position: number }> = []

  for (let i = 0; i < rawRows.length; i++) {
    const rowNum = i + 2 // +2 porque la fila 1 es el header
    const parsed = RowSchema.safeParse(rawRows[i])
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      errors.push({
        row: rowNum,
        field: issue.path[0]?.toString() ?? 'desconocido',
        message: issue.message,
      })
      continue
    }
    validRows.push({ ...parsed.data, position: nextPosition })
    nextPosition += 1000
  }

  if (validRows.length === 0) {
    return { success: true, data: { inserted: 0, skipped: rawRows.length, errors } }
  }

  // Inserción batch
  const insertPayload = validRows.map(r => ({
    title:       r.title,
    description: r.description || null,
    status:      r.status,
    priority:    r.priority,
    due_date:    r.due_date ?? null,
    user_id:     user.id,
    project_id:  projectId ?? null,
    position:    r.position,
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('tasks')
    .insert(insertPayload)
    .select('id, title, description')

  if (insertError) {
    Sentry.captureException(insertError, { extra: { projectId, rowCount: insertPayload.length } })
    return { success: false, error: `Error al insertar: ${insertError.message}` }
  }

  // Generar embeddings en background throttleado.
  // /api/embed rate limit 100/min → 5 paralelas cada 3s ≈ 100/min sostenido.
  // Para 500 filas el proceso dura ~5 min — usamos waitUntil() de Vercel para
  // que la función no se congele tras enviar la response (evita pérdida silenciosa).
  if (inserted && inserted.length > 0) {
    const BATCH_SIZE = 5
    const BATCH_DELAY_MS = 3000

    const embedTask = async () => {
      try {
        const { signRequest } = await import('@/lib/hmac')
        const path = '/api/embed'
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
        for (let i = 0; i < inserted.length; i += BATCH_SIZE) {
          const batch = inserted.slice(i, i + BATCH_SIZE)
          await Promise.allSettled(batch.map(async task => {
            const body = JSON.stringify({ taskId: task.id, title: task.title, description: task.description })
            const hmacHeaders = await signRequest(path, body)
            await fetch(`${baseUrl}${path}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...hmacHeaders },
              body,
            })
          }))
          if (i + BATCH_SIZE < inserted.length) {
            await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
          }
        }
      } catch { /* embedding es opcional — no bloquea la importación */ }
    }

    // after() garantiza que Vercel mantiene la función viva hasta que termine.
    // En entornos sin after (tests, dev local) cae al void fallback.
    try {
      const { after } = await import('next/server')
      after(embedTask())
    } catch {
      void embedTask()
    }
  }

  Sentry.addBreadcrumb({
    category: 'import',
    message: 'csv.imported',
    data: { projectId, inserted: inserted?.length ?? 0, errors: errors.length },
    level: 'info',
  })

  revalidatePath('/board')
  revalidatePath('/analytics')

  return {
    success: true,
    data: {
      inserted: inserted?.length ?? 0,
      skipped: errors.length,
      errors,
    },
  }
}
