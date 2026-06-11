'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { computeMetrics, parseUTCDate } from '@/lib/analytics/metrics'
import type { TaskRow, PhaseRow, AnalyticsMetrics } from '@/lib/analytics/metrics'

interface Project {
  id: string
  name: string
  start_date: string
  delivery_date: string
}

export interface AnalyticsState {
  loading: boolean
  error: string | null
  tasks: TaskRow[]
  project: Project | null
  metrics: AnalyticsMetrics | null
  startDate: Date | null
  endDate: Date | null
}

const FALLBACK_START = new Date().toISOString().slice(0, 10)
const FALLBACK_END   = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

export function useAnalytics(): AnalyticsState {
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [tasks, setTasks]       = useState<TaskRow[]>([])
  const [project, setProject]   = useState<Project | null>(null)
  const [phases, setPhases]     = useState<PhaseRow[]>([])

  useEffect(() => {
    const supabase = createClient()

    // Fetch project first, then scope tasks to that project_id.
    // Previously tasks had no filter → mixed tasks from multiple projects.
    const load = async () => {
      const { data: projectData, error: projErr } = await supabase
        .from('projects')
        .select('id, name, start_date, delivery_date')
        .order('created_at')
        .limit(1)
        .single()

      if (projErr && projErr.code !== 'PGRST116') throw projErr

      const taskQuery = projectData
        ? supabase
            .from('tasks')
            .select('status, priority, due_date, created_at, title')
            .eq('project_id', (projectData as Project).id)
        : supabase
            .from('tasks')
            .select('status, priority, due_date, created_at, title')
            .is('project_id', null)

      const phaseQuery = projectData
        ? supabase
            .from('project_phases')
            .select('name, total, done, color, sort_order')
            .eq('project_id', (projectData as Project).id)
            .order('sort_order')
        : Promise.resolve({ data: [] as PhaseRow[], error: null })

      const [{ data: taskData, error: taskErr }, { data: phaseData, error: phaseErr }] =
        await Promise.all([taskQuery, phaseQuery])

      if (taskErr) throw taskErr
      if (phaseErr) throw phaseErr

      setTasks((taskData as TaskRow[]) ?? [])
      if (projectData) {
        setProject(projectData as Project)
        setPhases((phaseData as PhaseRow[]) ?? [])
      }
    }

    load()
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Error al cargar analítica'
        console.error('[use-analytics]', message)
        setError(message)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading || error) {
    return { loading, error, tasks, project, metrics: null, startDate: null, endDate: null }
  }

  const startRaw  = project?.start_date  ?? FALLBACK_START
  const endRaw    = project?.delivery_date ?? FALLBACK_END
  const startDate = parseUTCDate(startRaw)
  const endDate   = parseUTCDate(endRaw)
  const today     = new Date()
  const todayUTC  = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))

  const metrics = computeMetrics(tasks, phases, startDate, endDate, todayUTC)

  return { loading, error, tasks, project, metrics, startDate, endDate }
}
