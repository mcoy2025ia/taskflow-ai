import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { KanbanBoard } from '@/components/kanban/board'
import type { Task } from '@/types/app.types'

export const dynamic = 'force-dynamic'

export default async function BoardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .order('position', { ascending: true })

  if (error) {
    console.error('[board] Error al cargar tareas:', error)
  }

  return (
    <main className="flex-1 p-6 overflow-hidden">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Mi tablero</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Arrastra las tarjetas para reorganizar. Usa el chat para buscar por lenguaje natural.
        </p>
      </div>
      <KanbanBoard initialTasks={(tasks as Task[]) ?? []} />
    </main>
  )
}