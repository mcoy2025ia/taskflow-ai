import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTasksByStatus } from '../use-tasks-by-status'
import type { Task } from '@/types/app.types'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    user_id: 'user-123',
    title: 'Test task',
    description: null,
    status: 'todo',
    priority: 'medium',
    position: 1000,
    due_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('useTasksByStatus', () => {
  it('returns only tasks matching the given status', () => {
    const tasks = [
      makeTask({ id: '1', status: 'todo' }),
      makeTask({ id: '2', status: 'in_progress' }),
      makeTask({ id: '3', status: 'todo' }),
    ]
    const { result } = renderHook(() => useTasksByStatus(tasks, 'todo'))
    expect(result.current).toHaveLength(2)
    expect(result.current.every(t => t.status === 'todo')).toBe(true)
  })

  it('sorts tasks by position ascending', () => {
    const tasks = [
      makeTask({ id: '1', status: 'todo', position: 3000 }),
      makeTask({ id: '2', status: 'todo', position: 1000 }),
      makeTask({ id: '3', status: 'todo', position: 2000 }),
    ]
    const { result } = renderHook(() => useTasksByStatus(tasks, 'todo'))
    expect(result.current.map(t => t.id)).toEqual(['2', '3', '1'])
  })

  it('returns empty array when no tasks match the status', () => {
    const tasks = [makeTask({ status: 'todo' }), makeTask({ status: 'in_progress' })]
    const { result } = renderHook(() => useTasksByStatus(tasks, 'done'))
    expect(result.current).toHaveLength(0)
  })

  it('returns empty array when task list is empty', () => {
    const { result } = renderHook(() => useTasksByStatus([], 'todo'))
    expect(result.current).toHaveLength(0)
  })

  it('returns the same reference when inputs do not change (memoization)', () => {
    const tasks = [makeTask({ id: '1', status: 'todo' })]
    const { result, rerender } = renderHook(
      ({ t, s }: { t: Task[]; s: 'todo' | 'in_progress' | 'done' }) =>
        useTasksByStatus(t, s),
      { initialProps: { t: tasks, s: 'todo' as const } }
    )
    const first = result.current
    rerender({ t: tasks, s: 'todo' })
    expect(result.current).toBe(first)
  })

  it('recomputes when status changes', () => {
    const tasks = [
      makeTask({ id: '1', status: 'todo' }),
      makeTask({ id: '2', status: 'done' }),
    ]
    const { result, rerender } = renderHook(
      ({ s }: { s: 'todo' | 'in_progress' | 'done' }) => useTasksByStatus(tasks, s),
      { initialProps: { s: 'todo' as const } }
    )
    expect(result.current).toHaveLength(1)
    expect(result.current[0].id).toBe('1')

    rerender({ s: 'done' })
    expect(result.current).toHaveLength(1)
    expect(result.current[0].id).toBe('2')
  })
})
