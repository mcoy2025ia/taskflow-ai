'use client'

import { useOptimistic, useTransition, useMemo, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  closestCorners,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useState } from 'react'
import { toast } from 'sonner'
import { KanbanColumn } from './column'
import { TaskCard } from './task-card'
import { moveTask } from '@/actions/task.actions'
import type { Task, TaskStatus, KanbanColumn as KanbanColumnType } from '@/types/app.types'

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'todo',        label: 'Por hacer',   color: 'bg-slate-100 dark:bg-slate-800' },
  { id: 'in_progress', label: 'En progreso', color: 'bg-amber-50 dark:bg-amber-950/30' },
  { id: 'done',        label: 'Completado',  color: 'bg-emerald-50 dark:bg-emerald-950/30' },
]

interface BoardProps {
  initialTasks: Task[]
}

// Reducer para el estado optimista del tablero
type OptimisticAction = {
  type: 'MOVE_TASK'
  taskId: string
  newStatus: TaskStatus
  newPosition: number
}

function boardReducer(tasks: Task[], action: OptimisticAction): Task[] {
  if (action.type === 'MOVE_TASK') {
    return tasks.map(task =>
      task.id === action.taskId
        ? { ...task, status: action.newStatus, position: action.newPosition }
        : task
    )
  }
  return tasks
}

export function KanbanBoard({ initialTasks }: BoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [isPending, startTransition] = useTransition()

  const [optimisticTasks, applyOptimisticMove] = useOptimistic(
    initialTasks,
    boardReducer
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }, // Evitar drag accidental
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const columns = useMemo<KanbanColumnType[]>(() =>
    COLUMNS.map(col => ({
      id: col.id,
      title: col.label,
      tasks: optimisticTasks
        .filter(t => t.status === col.id)
        .sort((a, b) => a.position - b.position),
    })),
    [optimisticTasks]
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = optimisticTasks.find(t => t.id === event.active.id)
    setActiveTask(task ?? null)
  }, [optimisticTasks])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over || active.id === over.id) return

    const overId = over.id as string
    const targetStatus = (
      COLUMNS.find(c => c.id === overId)?.id ??
      optimisticTasks.find(t => t.id === overId)?.status
    ) as TaskStatus | undefined

    if (!targetStatus) return

    const movedTask = optimisticTasks.find(t => t.id === active.id)
    if (!movedTask) return

    // Position calculation runs synchronously — O(n) on ~20 tasks, negligible.
    const targetTasks = optimisticTasks
      .filter(t => t.status === targetStatus && t.id !== movedTask.id)
      .sort((a, b) => a.position - b.position)

    const overTask = optimisticTasks.find(t => t.id === overId)
    const overIndex = overTask
      ? targetTasks.findIndex(t => t.id === overId)
      : targetTasks.length

    const prevPos = targetTasks[overIndex - 1]?.position ?? 0
    const nextPos = targetTasks[overIndex]?.position ?? prevPos + 2000
    const newPosition = Math.round((prevPos + nextPos) / 2)

    startTransition(async () => {
      applyOptimisticMove({
        type: 'MOVE_TASK',
        taskId: movedTask.id,
        newStatus: targetStatus,
        newPosition,
      })

      const result = await moveTask({
        id: movedTask.id,
        status: targetStatus,
        position: newPosition,
      })

      if (!result.success) {
        toast.error(result.error)
      }
    })
  }, [optimisticTasks, startTransition, applyOptimisticMove])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
        {columns.map((col, i) => (
          <KanbanColumn
            key={col.id}
            column={col}
            colorClass={COLUMNS[i].color}
            isPending={isPending}
          />
        ))}
      </div>

      {/* Overlay: tarjeta flotante durante el drag */}
      <DragOverlay>
        {activeTask ? (
          <TaskCard task={activeTask} isOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}