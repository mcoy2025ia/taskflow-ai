'use server'

import { z } from 'zod'
import { getAuthUser } from '@/lib/supabase/get-user'
import { createClient } from '@/lib/supabase/server'

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

export interface CommentRow {
  id: string
  task_id: string
  user_id: string
  content: string
  created_at: string
}

const AddCommentSchema = z.object({
  taskId: z.string().uuid(),
  content: z.string().min(1).max(2000),
})

export async function addComment(
  input: z.infer<typeof AddCommentSchema>
): Promise<ActionResult<CommentRow>> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = AddCommentSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('comments')
    .insert({
      task_id: parsed.data.taskId,
      user_id: user.id,
      content: parsed.data.content,
    })
    .select('id, task_id, user_id, content, created_at')
    .single()

  if (error || !data) return { success: false, error: error?.message ?? 'Error al guardar' }

  return { success: true, data: data as CommentRow }
}

export async function getComments(taskId: string): Promise<ActionResult<CommentRow[]>> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('comments')
    .select('id, task_id, user_id, content, created_at')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })

  if (error) return { success: false, error: error.message }

  return { success: true, data: (data ?? []) as CommentRow[] }
}

export async function deleteComment(commentId: string): Promise<ActionResult> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}
