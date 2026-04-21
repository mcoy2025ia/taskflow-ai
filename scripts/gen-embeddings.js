const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const USER_ID = '9834c505-6bbc-4914-96f6-5cfa6eb89c4f';
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, title, description');

  if (error) { console.error('Error fetching tasks:', error); return; }
  console.log(`Generando embeddings para ${tasks.length} tareas...`);

  let processed = 0;
  for (const task of tasks) {
    const input = task.title + (task.description ? '\n\n' + task.description : '');

    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.VOYAGE_API_KEY,
      },
      body: JSON.stringify({ model: 'voyage-3-lite', input, input_type: 'document' }),
    });

    const json = await res.json();
    if (!res.ok) { console.error('❌ Voyage error:', json); continue; }

    const embedding = json.data[0].embedding;

    const { error: insertError } = await supabase
      .from('task_embeddings')
      .upsert({
        task_id: task.id,
        user_id: USER_ID,
        content: input,
        embedding,
        content_hash: task.id, // simplificado
      }, { onConflict: 'task_id' });

    if (insertError) {
      console.error(`❌ Error insertando ${task.title}:`, insertError);
    } else {
      processed++;
      console.log(`✓ [${processed}/${tasks.length}] ${task.title}`);
    }
    await delay(21000);
  }
  console.log('✓ Done!');
})()
;