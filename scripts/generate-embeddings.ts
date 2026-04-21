import { createClient } from '@supabase/supabase-js'
import { generateEmbedding, buildTaskContent } from './src/lib/ai/voyage'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function generateEmbeddingsForAllTasks() {
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, title, description')
    .is('embedding', null)

  if (error) {
    console.error('Error fetching tasks:', error)
    return
  }

  console.log(`Generando embeddings para ${tasks.length} tareas...`)

  for (const task of tasks) {
    const content = buildTaskContent(task.title, task.description)
    const embedding = await generateEmbedding(content)

    const { error: updateError } = await supabase
      .from('tasks')
      .update({ embedding })
      .eq('id', task.id)

    if (updateError) {
      console.error(`Error updating task ${task.id}:`, updateError)
    } else {
      console.log(`✓ ${task.title}`)
    }
  }

  console.log('✓ Done!')
}

generateEmbeddingsForAllTasks()