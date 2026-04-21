import { useMemo } from 'react'
import type { Task, TaskStatus } from '@/types/app.types'

export function useTasksByStatus(tasks: Task[], status: TaskStatus): Task[] {
  return useMemo(
    () =>
      tasks
        .filter(t => t.status === status)
        .sort((a, b) => a.position - b.position),
    [tasks, status]
  )
}
