"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
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

export async function createTask(
  input: CreateTaskInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Error de validación' }
  }
  const { supabase, user } = await getAuthenticatedUser()
  const { data: maxPos } = await supabase
    .from("tasks")
    .select("position")
    .eq("user_id", user.id)
    .eq("status", parsed.data.status)
    .order("position", { ascending: false })
    .limit(1)
    .single()
  const position = maxPos ? maxPos.position + 1000 : 1000
  const { data, error } = await supabase
    .from("tasks")
    .insert({ ...parsed.data, user_id: user.id, position })
    .select("id")
    .single()
  if (error) return { success: false, error: "Error al crear la tarea" }
  void triggerEmbedding(data.id, parsed.data.title, parsed.data.description)
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
  const { error } = await supabase
    .from("tasks")
    .update({ status: parsed.data.status, position: parsed.data.position })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
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
  const { error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
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
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
  if (error) return { success: false, error: "Error al eliminar la tarea" }
  revalidatePath("/board")
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
    const hmacHeaders = await signRequest(path)
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...hmacHeaders },
      body: JSON.stringify({ taskId, title, description }),
    })
  } catch {
    console.error("[embed] Fallo el trigger para tarea", taskId)
  }
}
