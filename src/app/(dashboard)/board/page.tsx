import type { Metadata } from 'next'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/supabase/get-user'
import { KanbanSkeleton } from '@/components/kanban/skeleton'
import { KanbanBoardDynamic } from '@/components/kanban/board-dynamic'
import { InsightBanner } from '@/components/kanban/insight-banner'
import { BoardActions } from '@/components/kanban/board-actions'
import type { TaskWithAssignees, ProjectMember } from '@/types/app.types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Mi tablero',
  description: 'Organiza tus tareas con drag-and-drop y busca en lenguaje natural con el asistente IA.',
}

interface BoardPageProps {
  searchParams: Promise<{ project_id?: string }>
}

async function BoardTasks({ projectId }: { projectId?: string }) {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  // Resolve project_id: use param or fallback to user's first project
  let resolvedProjectId = projectId
  if (!resolvedProjectId) {
    const { data: firstProject } = await supabase
      .from('projects')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at')
      .limit(1)
      .maybeSingle()
    resolvedProjectId = firstProject?.id
    // Redirect so the URL always carries project_id — keeps client context in sync
    if (resolvedProjectId) {
      redirect(`/board?project_id=${resolvedProjectId}`)
    }
  }

  // Fetch tasks with assignees in parallel with member profiles
  const [tasksResult, membersResult] = await Promise.all([
    resolvedProjectId
      ? supabase
          .from('tasks')
          .select('*, task_assignments(user_id)')
          .eq('project_id', resolvedProjectId)
          .order('position', { ascending: true })
      : supabase
          .from('tasks')
          .select('*, task_assignments(user_id)')
          .eq('user_id', user.id)
          .order('position', { ascending: true }),
    resolvedProjectId
      ? supabase.rpc('get_project_member_profiles', { p_project_id: resolvedProjectId })
      : Promise.resolve({ data: [] as { user_id: string; full_name: string; avatar_url: string | null; role: string }[] }),
  ])

  if (tasksResult.error) {
    console.error('[board] Error al cargar tareas:', tasksResult.error.message, tasksResult.error.code, tasksResult.error.details)
  }

  const rawTasks = tasksResult.data ?? []
  const initialTasks: TaskWithAssignees[] = rawTasks.map(({ task_assignments, ...rest }) => ({
    ...rest,
    assignees: (task_assignments ?? []).map((a: { user_id: string }) => a.user_id),
  })) as TaskWithAssignees[]

  type MemberRow = { user_id: string; full_name: string | null; avatar_url: string | null; role: string }
  const members: ProjectMember[] = ((membersResult.data ?? []) as MemberRow[]).map(m => {
    const words = (m.full_name ?? 'U').trim().split(' ')
    const initials = words.slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
    return {
      userId: m.user_id,
      name: m.full_name ?? 'Usuario',
      initials,
      avatarUrl: m.avatar_url,
      role: m.role as ProjectMember['role'],
    }
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const overdueCount = initialTasks.filter(
    t => t.status !== 'done' && t.due_date && new Date(t.due_date) < today
  ).length
  const doneCount = initialTasks.filter(t => t.status === 'done').length
  const pendingCount = initialTasks.filter(t => t.status !== 'done').length
  const atRisk = initialTasks.length > 0 && pendingCount > doneCount * 2

  return (
    <>
      <InsightBanner overdueCount={overdueCount} atRisk={atRisk} />
      <KanbanBoardDynamic
        initialTasks={initialTasks}
        members={members}
        projectId={resolvedProjectId ?? null}
        currentUserId={user.id}
      />
    </>
  )
}

export default async function BoardPage({ searchParams }: BoardPageProps) {
  const params = await searchParams
  return (
    <main className="p-4 sm:p-6 overflow-x-hidden md:flex md:flex-col md:h-full md:overflow-hidden">
      <div className="mb-4 sm:mb-6 flex-shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Mi tablero</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Arrastra las tarjetas para reorganizar. Usa el chat para buscar por lenguaje natural.
            </p>
          </div>
          <BoardActions projectId={params.project_id ?? null} />
        </div>
      </div>
      <div className="md:flex-1 md:min-h-0">
        <Suspense fallback={<KanbanSkeleton />}>
          <BoardTasks projectId={params.project_id} />
        </Suspense>
      </div>
    </main>
  )
}
