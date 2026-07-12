import type { Metadata } from 'next'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/supabase/get-user'
import { env } from '@/lib/env'
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

  // Resolve project_id: use param or fallback to most active project (most tasks)
  let resolvedProjectId = projectId
  if (!resolvedProjectId) {
    const { data: projects } = await supabase
      .from('projects')
      .select('id')
      .eq('user_id', user.id)

    if (projects && projects.length > 0) {
      // Pick the project with the most tasks
      const counts = await Promise.all(
        projects.map(async p => {
          const { count } = await supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', p.id)
          return { id: p.id, count: count ?? 0 }
        })
      )
      const best = counts.sort((a, b) => b.count - a.count)[0]
      resolvedProjectId = best?.id
    }
    // Redirect so the URL always carries project_id — keeps client context in sync
    if (resolvedProjectId) {
      redirect(`/board?project_id=${resolvedProjectId}`)
    }
  }

  // Fetch tasks with assignees in parallel with member profiles and project metadata
  const [tasksResult, membersResult, projectResult] = await Promise.all([
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
          .is('project_id', null)
          .order('position', { ascending: true }),
    resolvedProjectId
      ? supabase.rpc('get_project_member_profiles', { p_project_id: resolvedProjectId })
      : Promise.resolve({ data: [] as { user_id: string; full_name: string; avatar_url: string | null; role: string }[] }),
    resolvedProjectId
      ? supabase.from('projects').select('name, company, department').eq('id', resolvedProjectId).single()
      : Promise.resolve({ data: null }),
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
        projectName={projectResult.data?.name ?? null}
        projectCompany={projectResult.data?.company ?? null}
        projectDepartment={projectResult.data?.department ?? null}
      />
    </>
  )
}

export default async function BoardPage({ searchParams }: BoardPageProps) {
  const params = await searchParams
  const user = await getAuthUser()
  const isGuest = !!env.DEMO_EMAIL && user?.email === env.DEMO_EMAIL
  return (
    <main className="page-enter overflow-x-hidden p-4 sm:p-6 md:flex md:h-full md:flex-col md:overflow-hidden xl:p-8">
      <div className="mb-5 flex-shrink-0 sm:mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <p className="text-[10px] font-bold uppercase text-primary">Vista de equipo</p>
            </div>
            <h1 className="text-2xl font-semibold text-foreground sm:text-[28px]">Tu trabajo, en movimiento.</h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Prioriza, asigna y mueve cada tarea mientras el equipo avanza.
            </p>
          </div>
          <BoardActions projectId={params.project_id ?? null} isGuest={isGuest} />
        </div>
      </div>
      <div className="min-h-0 md:flex-1">
        <Suspense fallback={<KanbanSkeleton />}>
          <BoardTasks projectId={params.project_id} />
        </Suspense>
      </div>
    </main>
  )
}
