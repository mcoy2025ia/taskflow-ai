import type { Metadata } from 'next'
import nextDynamic from 'next/dynamic'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/supabase/get-user'
import { KanbanSkeleton } from '@/components/kanban/skeleton'
import type { Task } from '@/types/app.types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Mi tablero',
  description: 'Organiza tus tareas con drag-and-drop y busca en lenguaje natural con el asistente IA.',
}

// @dnd-kit (~60 KB) is excluded from the initial bundle — loaded lazily after
// the shell HTML is painted. ssr:false is correct: drag-and-drop is client-only.
const KanbanBoard = nextDynamic(
  () => import('@/components/kanban/board').then(m => m.KanbanBoard),
  { ssr: false, loading: () => <KanbanSkeleton /> }
)

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
