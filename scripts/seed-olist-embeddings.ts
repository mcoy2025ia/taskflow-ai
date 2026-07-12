import { createClient } from "@supabase/supabase-js"
import { generateEmbedding, buildTaskContent, hashContent } from "../src/lib/ai/voyage"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const PROJECT_ID = "283a0e26-21ab-45b6-9028-c0440a76a6f7" // Olist E-commerce Analytics & ML

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, user_id, title, description")
    .eq("project_id", PROJECT_ID)

  if (error || !tasks?.length) {
    console.error("No se encontraron tareas del proyecto Olist:", error)
    return
  }

  const { data: existing } = await supabase
    .from("task_embeddings")
    .select("task_id")
    .in("task_id", tasks.map(t => t.id))

  const embeddedIds = new Set(existing?.map(e => e.task_id) ?? [])
  const pending = tasks.filter(t => !embeddedIds.has(t.id))

  console.log(`Total tareas Olist: ${tasks.length} | Sin embedding: ${pending.length}`)

  let ok = 0, fail = 0

  for (const task of pending) {
    try {
      const content = buildTaskContent(task.title, task.description)
      const contentHash = await hashContent(content)
      const embedding = await generateEmbedding(content)

      const { error: rpcError } = await supabase.rpc("upsert_task_embedding", {
        p_task_id: task.id,
        p_user_id: task.user_id,
        p_embedding: `[${embedding.join(",")}]`,
        p_content_hash: contentHash,
      })

      if (rpcError) throw rpcError

      ok++
      console.log(`✓ [${ok}/${pending.length}] ${task.title.slice(0, 60)}`)
    } catch (err) {
      fail++
      console.error(`✗ [fail ${fail}] ${task.title.slice(0, 60)}`, JSON.stringify(err, Object.getOwnPropertyNames(err)))
    }

    // Tier gratuito de Voyage sin método de pago: límite de 3 RPM
    await new Promise(r => setTimeout(r, 21000))
  }

  console.log(`\nCompletado: ${ok} exitosos, ${fail} fallidos de ${pending.length} pendientes`)
}

main()
