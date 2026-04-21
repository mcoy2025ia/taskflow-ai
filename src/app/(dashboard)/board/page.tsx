import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/supabase/get-user'
import { KanbanBoard } from '@/components/kanban/board'
import { KanbanSkeleton } from '@/components/kanban/skeleton'
import type { Task } from '@/types/app.types'

export const dynamic = 'force-dynamic'

// Isolated async component — only this suspends, not the whole page.
// Next.js streams the shell HTML (h1 + skeleton) immediately, then
// flushes this component's HTML when the Supabase query resolves.
async function BoardTasks() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .order('position', { ascending: true })

  if (error) {
    console.error('[board] Error al cargar tareas:', error)
  }

  return <KanbanBoard initialTasks={(tasks as Task[]) ?? []} />
}

// Synchronous shell — renders in the first HTTP chunk.
// The <h1> is the LCP candidate and arrives before the DB query resolves.
export default function BoardPage() {
  return (
    <main className="flex-1 p-6 overflow-hidden">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Mi tablero</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Arrastra las tarjetas para reorganizar. Usa el chat para buscar por lenguaje natural.
        </p>
      </div>
      <Suspense fallback={<KanbanSkeleton />}>
        <BoardTasks />
      </Suspense>
    </main>
  )
}
