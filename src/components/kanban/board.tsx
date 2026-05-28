'use client'

import { useOptimistic, useTransition, useMemo, useCallback, useState, createContext, useContext } from 'react'
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
import { toast } from 'sonner'
import { KanbanColumn } from './column'
import { TaskCard } from './task-card'
import { TaskDrawer } from './task-drawer'
import { moveTask } from '@/actions/task.actions'
import { MemberFilterBar } from './member-filter-bar'
import { useRealtimeTasks } from '@/hooks/use-realtime-tasks'
import { CsvImport } from '@/components/analytics/csv-import'
import type { TaskWithAssignees, TaskStatus, KanbanColumn as KanbanColumnType, ProjectMember } from '@/types/app.types'

// Context so TaskCard can open the drawer without prop-drilling 3 levels
export const TaskDrawerContext = createContext<(task: TaskWithAssignees) => void>(() => {})
export function useTaskDrawer() { return useContext(TaskDrawerContext) }

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'todo',        label: 'Por hacer',   color: 'bg-slate-100 dark:bg-slate-800' },
  { id: 'in_progress', label: 'En progreso', color: 'bg-amber-50 dark:bg-amber-950/30' },
  { id: 'done',        label: 'Completado',  color: 'bg-emerald-50 dark:bg-emerald-950/30' },
]

interface BoardProps {
  initialTasks: TaskWithAssignees[]
  members: ProjectMember[]
  projectId: string | null
  currentUserId: string
}

type OptimisticAction = {
  type: 'MOVE_TASK'
  taskId: string
  newStatus: TaskStatus
  newPosition: number
}

function boardReducer(tasks: TaskWithAssignees[], action: OptimisticAction): TaskWithAssignees[] {
  if (action.type === 'MOVE_TASK') {
    return tasks.map(task =>
      task.id === action.taskId
        ? { ...task, status: action.newStatus, position: action.newPosition }
        : task
    )
  }
  return tasks
}

export function KanbanBoard({ initialTasks, members, projectId, currentUserId }: BoardProps) {
  const [activeTask, setActiveTask] = useState<TaskWithAssignees | null>(null)
  const [drawerTask, setDrawerTask] = useState<TaskWithAssignees | null>(null)
  const [isPending, startTransition] = useTransition()
  const [filteredMemberId, setFilteredMemberId] = useState<string | null>(null)

  useRealtimeTasks({ projectId, currentUserId })

  const [optimisticTasks, applyOptimisticMove] = useOptimistic(
    initialTasks,
    boardReducer
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const visibleTasks = useMemo(() =>
    filteredMemberId
      ? optimisticTasks.filter(t => t.assignees.includes(filteredMemberId))
      : optimisticTasks,
    [optimisticTasks, filteredMemberId]
  )

  const columns = useMemo<KanbanColumnType[]>(() =>
    COLUMNS.map(col => ({
      id: col.id,
      title: col.label,
      tasks: visibleTasks
        .filter(t => t.status === col.id)
        .sort((a, b) => a.position - b.position),
    })),
    [visibleTasks]
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

  const isBoardEmpty = optimisticTasks.length === 0

  return (
    <TaskDrawerContext.Provider value={setDrawerTask}>
      <div className="flex flex-col md:h-full gap-3">
        {members.length > 1 && !isBoardEmpty && (
          <MemberFilterBar
            members={members}
            filteredMemberId={filteredMemberId}
            onChange={setFilteredMemberId}
          />
        )}

        {isBoardEmpty ? (
          <div className="md:flex-1 md:min-h-0 md:overflow-y-auto">
            <CsvImport projectId={projectId} />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 md:flex-1 md:min-h-0 md:overflow-hidden">
              {columns.map((col, i) => (
                <KanbanColumn
                  key={col.id}
                  column={col}
                  colorClass={COLUMNS[i].color}
                  isPending={isPending}
                  members={members}
                />
              ))}
            </div>

            <DragOverlay>
              {activeTask ? (
                <TaskCard task={activeTask} members={members} isOverlay />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <TaskDrawer
        task={drawerTask}
        members={members}
        currentUserId={currentUserId}
        onClose={() => setDrawerTask(null)}
      />
    </TaskDrawerContext.Provider>
  )
}
