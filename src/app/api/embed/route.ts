import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { generateEmbedding, buildTaskContent, hashContent } from "@/lib/ai/voyage"
import { verifyHmacRequest } from "@/lib/hmac"
import { ratelimit } from "@/lib/ratelimit"

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  // Rate limiting: 100 req/min por origin (antes de verificar HMAC para evitar timing oracle)
  const origin = request.headers.get('origin') ?? request.headers.get('host') ?? 'unknown'
  const { limited, headers: rlHeaders } = await ratelimit.embed(origin)
  if (limited) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: rlHeaders })
  }

  const clonedReq = request.clone()
  const isValid = await verifyHmacRequest(clonedReq)
  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  let taskId: string, title: string, description: string | undefined
  try {
    // verifyHmacRequest consumed the clone; read body from original
    const body = await request.json()
    taskId = body.taskId
    title = body.title
    description = body.description
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }
  if (!taskId || !title) {
    return NextResponse.json({ error: "taskId y title son requeridos" }, { status: 400 })
  }
  try {
    const content = buildTaskContent(title, description)
    const contentHash = await hashContent(content)
    const supabase = createServiceClient()
    const { data: existing } = await supabase
      .from("task_embeddings")
      .select("content_hash")
      .eq("task_id", taskId)
      .single()
    if (existing?.content_hash === contentHash) {
      return NextResponse.json({ skipped: true })
    }
    const { data: task } = await supabase
      .from("tasks")
      .select("user_id")
      .eq("id", taskId)
      .single()
    if (!task) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 })
    }
    const embedding = await generateEmbedding(content)
    const { error } = await supabase.rpc("upsert_task_embedding", {
      p_task_id: taskId,
      p_user_id: task.user_id,
      p_embedding: `[${embedding.join(",")}]`,
      p_content_hash: contentHash,
    })
    if (error) throw error
    return NextResponse.json({ success: true, taskId })
  } catch (error) {
    console.error("[api/embed] Error:", error)
    return NextResponse.json({ error: "Embedding failed" }, { status: 500 })
  }
}
