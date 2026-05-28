import { createClient } from "@supabase/supabase-js"
import { generateEmbedding, buildTaskContent, hashContent } from "../src/lib/ai/voyage"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const USER_ID = "9834c505-6bbc-4914-96f6-5cfa6eb89c4f"

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, title, description")
    .eq("user_id", USER_ID)

  if (error || !tasks?.length) {
    console.error("No se encontraron tareas:", error)
    return
  }

  const { data: existing } = await supabase
    .from("task_embeddings")
    .select("task_id")
    .eq("user_id", USER_ID)

  const embeddedIds = new Set(existing?.map(e => e.task_id) ?? [])
  const pending = tasks.filter(t => !embeddedIds.has(t.id))

  console.log(`Total tareas: ${tasks.length} | Sin embedding: ${pending.length}`)

  let ok = 0, fail = 0

  for (const task of pending) {
    try {
      const content = buildTaskContent(task.title, task.description)
      const contentHash = await hashContent(content)
      const embedding = await generateEmbedding(content)

      const { error: rpcError } = await supabase.rpc("upsert_task_embedding", {
        p_task_id: task.id,
        p_user_id: USER_ID,
        p_embedding: `[${embedding.join(",")}]`,
        p_content_hash: contentHash,
      })

      if (rpcError) throw rpcError

      console.log(`✓ [${++ok}] ${task.title.slice(0, 50)}`)
    } catch (err) {
      console.error(`✗ [${++fail}] ${task.title.slice(0, 50)}`, JSON.stringify(err, Object.getOwnPropertyNames(err)))
    }

    await new Promise(r => setTimeout(r, 21000))
  }

  console.log(`\nCompletado: ${ok} exitosos, ${fail} fallidos`)
}

main()
