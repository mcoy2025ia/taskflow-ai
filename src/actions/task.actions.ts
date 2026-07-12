"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import * as Sentry from '@sentry/nextjs'
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  MoveTaskSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
  type MoveTaskInput,
} from "@/lib/validations/task.schema"

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect("/login")
  return { supabase, user }
}

type EditableTask = {
  id: string
  user_id: string
  project_id: string | null
}

async function verifyProjectEditor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  userId: string
): Promise<ActionResult> {
  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single()

  if (!membership || !['owner', 'editor'].includes(membership.role)) {
    return { success: false, error: 'No tienes permiso de editor en este proyecto' }
  }

  return { success: true, data: undefined }
}

async function getEditableTask(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskId: string,
  userId: string
): Promise<ActionResult<EditableTask>> {
  const { data: task, error } = await supabase
    .from('tasks')
    .select('id, user_id, project_id')
    .eq('id', taskId)
    .single()

  if (error || !task) {
    return { success: false, error: 'Tarea no encontrada' }
  }

  if (!task.project_id) {
    if (task.user_id !== userId) {
      return { success: false, error: 'No tienes permiso para editar esta tarea' }
    }
    return { success: true, data: task as EditableTask }
  }

  const membership = await verifyProjectEditor(supabase, task.project_id, userId)
  if (!membership.success) return membership

  return { success: true, data: task as EditableTask }
}

export async function createTask(
  input: CreateTaskInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Error de validación' }
  }
  const { supabase, user } = await getAuthenticatedUser()

  const projectId = parsed.data.project_id ?? null
  if (projectId) {
    const membership = await verifyProjectEditor(supabase, projectId, user.id)
    if (!membership.success) return membership
  }

  let posQuery = supabase
    .from("tasks")
    .select("position")
    .eq("status", parsed.data.status)
    .order("position", { ascending: false })
    .limit(1)

  posQuery = projectId
    ? posQuery.eq("project_id", projectId)
    : posQuery.eq("user_id", user.id).is("project_id", null)

  const { data: maxPos } = await posQuery
    .single()
  const position = maxPos ? maxPos.position + 1000 : 1000
  const { data, error } = await supabase
    .from("tasks")
    .insert({ ...parsed.data, project_id: projectId, user_id: user.id, position })
    .select("id")
    .single()
  if (error) return { success: false, error: "Error al crear la tarea" }
  void triggerEmbedding(data.id, parsed.data.title, parsed.data.description)
  Sentry.addBreadcrumb({ category: 'task', message: 'task.created', data: { taskId: data.id, status: parsed.data.status }, level: 'info' })
  revalidatePath("/board")
  return { success: true, data: { id: data.id } }
}

export async function moveTask(
  input: MoveTaskInput
): Promise<ActionResult> {
  const parsed = MoveTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Datos de movimiento invalidos" }
  }
  const { supabase, user } = await getAuthenticatedUser()
  const editable = await getEditableTask(supabase, parsed.data.id, user.id)
  if (!editable.success) return editable

  const { error } = await supabase
    .from("tasks")
    .update({ status: parsed.data.status, position: parsed.data.position })
    .eq("id", parsed.data.id)
  if (error) return { success: false, error: "Error al mover la tarea" }
  revalidatePath("/board")
  return { success: true, data: undefined }
}

export async function updateTask(
  input: UpdateTaskInput
): Promise<ActionResult> {
  const parsed = UpdateTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Error de validación' }
  }
  const { supabase, user } = await getAuthenticatedUser()
  const { id, ...updates } = parsed.data
  const editable = await getEditableTask(supabase, id, user.id)
  if (!editable.success) return editable

  const { error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", id)
  if (error) return { success: false, error: "Error al actualizar la tarea" }
  if (updates.title || updates.description !== undefined) {
    const { data: task } = await supabase
      .from("tasks")
      .select("title, description")
      .eq("id", id)
      .single()
    if (task) void triggerEmbedding(id, task.title, task.description)
  }
  revalidatePath("/board")
  return { success: true, data: undefined }
}

export async function deleteTask(id: string): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedUser()
  const editable = await getEditableTask(supabase, id, user.id)
  if (!editable.success) return editable

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
  if (error) return { success: false, error: "Error al eliminar la tarea" }
  Sentry.addBreadcrumb({ category: 'task', message: 'task.deleted', data: { taskId: id }, level: 'info' })
  revalidatePath("/board")
  return { success: true, data: undefined }
}

export async function assignTask(
  taskId: string,
  userId: string
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedUser()

  // Verify caller can edit this task: fetch project_id + owner to check role explicitly
  const { data: task } = await supabase
    .from('tasks')
    .select('id, user_id, project_id')
    .eq('id', taskId)
    .single()

  if (!task) return { success: false, error: 'Tarea no encontrada' }

  // Personal workspace: only the owner can assign
  if (!task.project_id) {
    if (task.user_id !== user.id) {
      return { success: false, error: 'No tienes permiso para gestionar asignaciones en esta tarea' }
    }
  } else {
    // Shared project: caller must be owner or editor
    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', task.project_id)
      .eq('user_id', user.id)
      .single()

    if (!membership || !['owner', 'editor'].includes(membership.role)) {
      return { success: false, error: 'No tienes permiso de editor en este proyecto' }
    }
  }

  const { error } = await supabase
    .from('task_assignments')
    .upsert({ task_id: taskId, user_id: userId }, { onConflict: 'task_id,user_id' })

  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}

export async function unassignTask(
  taskId: string,
  userId: string
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedUser()

  const { data: task } = await supabase
    .from('tasks')
    .select('id, user_id, project_id')
    .eq('id', taskId)
    .single()

  if (!task) return { success: false, error: 'Tarea no encontrada' }

  if (!task.project_id) {
    if (task.user_id !== user.id) {
      return { success: false, error: 'No tienes permiso para gestionar asignaciones en esta tarea' }
    }
  } else {
    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', task.project_id)
      .eq('user_id', user.id)
      .single()

    if (!membership || !['owner', 'editor'].includes(membership.role)) {
      return { success: false, error: 'No tienes permiso de editor en este proyecto' }
    }
  }

  const { error } = await supabase
    .from('task_assignments')
    .delete()
    .eq('task_id', taskId)
    .eq('user_id', userId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}

async function triggerEmbedding(
  taskId: string,
  title: string,
  description?: string | null
) {
  try {
    const { signRequest } = await import("@/lib/hmac")
    const path = "/api/embed"
    const body = JSON.stringify({ taskId, title, description })
    const hmacHeaders = await signRequest(path, body)
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...hmacHeaders },
      body,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => res.status.toString())
      throw new Error(`HTTP ${res.status}: ${text}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[embed] Fallo el trigger para tarea", taskId, "—", message)
    Sentry.captureException(err, { tags: { taskId }, extra: { title } })
  }
}
