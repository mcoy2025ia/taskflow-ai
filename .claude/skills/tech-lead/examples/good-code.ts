/**
 * GOOD CODE — Misma funcionalidad, principios SOLID aplicados
 * Contexto: TaskFlow AI — tablero Kanban
 *
 * Correcciones:
 *  [SRP]  Lógica de posición → función pura `calculateNewPosition`
 *         Estado del drag + columnas → hook `useKanbanBoard`
 *         GodTaskBoard dividido en Board (orquestación) + Column + Card
 *  [OCP]  Columnas y prioridades definidas como mapas de config externalizables
 *         Añadir 'blocked' = añadir una entrada al mapa, sin tocar los componentes
 *  [LSP]  TaskCard y OverlayCard implementan la misma interfaz `TaskDisplayProps`
 *         son intercambiables en DragOverlay sin cambiar el consumidor
 *  [ISP]  Props divididas: `TaskDisplayProps` (render) vs `TaskActionProps` (acciones)
 *         El overlay solo recibe `TaskDisplayProps`
 *  [DIP]  Los componentes reciben las acciones como callbacks tipados
 *         El hook recibe `moveTaskFn` inyectable → testeable sin mockear módulos
 */

'use client'

import { useOptimistic, useTransition } from 'react'
import type { Task, TaskStatus } from '@/types/app.types'

// ─── Configuración externalizable (OCP) ──────────────────────────────────────
// Añadir 'blocked': una línea aquí. Nada más cambia.

export type ColumnConfig = {
  label: string
  color: string
}

export const COLUMN_CONFIG: Record<TaskStatus, ColumnConfig> = {
  todo:        { label: 'Por hacer',   color: 'bg-slate-100 dark:bg-slate-800' },
  in_progress: { label: 'En progreso', color: 'bg-amber-50 dark:bg-amber-950/30' },
  done:        { label: 'Completado',  color: 'bg-emerald-50 dark:bg-emerald-950/30' },
}

export const PRIORITY_CONFIG = {
  low:    { label: 'Baja',  className: 'text-slate-500' },
  medium: { label: 'Media', className: 'text-amber-600' },
  high:   { label: 'Alta',  className: 'text-red-600' },
} satisfies Record<string, { label: string; className: string }>

// ─── Función pura de cálculo (SRP) ───────────────────────────────────────────
// Una sola responsabilidad: calcular posición a partir de vecinos.
// Testeable sin montar componentes ni mockear nada.

export function calculateNewPosition(
  siblings: Task[],
  overIndex: number
): number {
  const prevPos = siblings[overIndex - 1]?.position ?? 0
  const nextPos = siblings[overIndex]?.position ?? prevPos + 2000
  return Math.round((prevPos + nextPos) / 2)
}

// ─── Tipos de props segregados (ISP) ─────────────────────────────────────────
// TaskDisplayProps: lo mínimo para renderizar una tarjeta.
// TaskActionProps: callbacks solo para los componentes que actúan.

interface TaskDisplayProps {
  task: Task
  isOverlay?: boolean
  isPending?: boolean
}

interface TaskActionProps {
  onDelete: (id: string) => void
}

// ─── Hook de orquestación (SRP) ───────────────────────────────────────────────
// Separa toda la lógica de estado del rendering.
// `moveTaskFn` es inyectable → DIP: el hook depende de la abstracción, no de la concreción.

type MoveTaskFn = (args: {
  id: string
  status: TaskStatus
  position: number
}) => Promise<{ success: boolean; error?: string }>

type OptimisticAction = {
  type: 'MOVE_TASK'
  taskId: string
  newStatus: TaskStatus
  newPosition: number
}

function boardReducer(tasks: Task[], action: OptimisticAction): Task[] {
  if (action.type === 'MOVE_TASK') {
    return tasks.map(t =>
      t.id === action.taskId
        ? { ...t, status: action.newStatus, position: action.newPosition }
        : t
    )
  }
  return tasks
}

export function useKanbanBoard(initialTasks: Task[], moveTaskFn: MoveTaskFn) {
  const [isPending, startTransition] = useTransition()
  const [optimisticTasks, applyOptimisticMove] = useOptimistic(
    initialTasks,
    boardReducer
  )

  // Agrupa en columnas respetando el orden del config (OCP: el orden viene del mapa)
  const columns = (Object.keys(COLUMN_CONFIG) as TaskStatus[]).map(status => ({
    status,
    config: COLUMN_CONFIG[status],
    tasks: optimisticTasks
      .filter(t => t.status === status)
      .sort((a, b) => a.position - b.position),
  }))

  function moveOptimistic(
    activeId: string,
    targetStatus: TaskStatus,
    targetTasks: Task[]
  ) {
    const overIndex = targetTasks.findIndex(t => t.id === activeId)
    const position = calculateNewPosition(targetTasks, overIndex)

    startTransition(async () => {
      applyOptimisticMove({
        type: 'MOVE_TASK',
        taskId: activeId,
        newStatus: targetStatus,
        newPosition: position,
      })

      // [DIP] Llama a la función inyectada, no a la concreción
      const result = await moveTaskFn({ id: activeId, status: targetStatus, position })
      if (!result.success) {
        console.error('[board] moveTask failed:', result.error)
      }
    })
  }

  return { columns, isPending, moveOptimistic }
}

// ─── Componentes (SRP + ISP + LSP) ───────────────────────────────────────────

// TaskCard: solo renderiza. No conoce acciones. (ISP)
// Implementa TaskDisplayProps → intercambiable con OverlayCard. (LSP)
export function TaskCard({ task, isPending, isOverlay = false }: TaskDisplayProps) {
  const priority = PRIORITY_CONFIG[task.priority]
  return (
    <div
      style={{ opacity: isPending ? 0.5 : 1 }}
      data-overlay={isOverlay || undefined}
    >
      <p>{task.title}</p>
      <span className={priority.className}>{priority.label}</span>
    </div>
  )
}

// OverlayCard: misma interfaz que TaskCard → LSP garantizado.
// El consumidor puede intercambiar uno por otro en DragOverlay sin cambios.
export function OverlayCard({ task }: TaskDisplayProps) {
  return <TaskCard task={task} isOverlay />
}

// ActionableTaskCard: extiende el display con la prop de acción. (ISP)
// El padre pasa onDelete; TaskCard nunca lo ve.
export function ActionableTaskCard({ task, isPending, onDelete }: TaskDisplayProps & TaskActionProps) {
  return (
    <div>
      <TaskCard task={task} isPending={isPending} />
      <button
        onClick={() => onDelete(task.id)}
        aria-label={`Eliminar tarea ${task.title}`}
      >
        Eliminar
      </button>
    </div>
  )
}

// ─── Componente raíz (DIP + OCP) ─────────────────────────────────────────────
// KanbanBoard recibe moveTaskFn inyectado → testeable, intercambiable.
// No tiene lógica de negocio: delega al hook.

interface KanbanBoardProps {
  initialTasks: Task[]
  // [DIP] Recibe la abstracción, no la importación concreta de task.actions
  moveTaskFn: MoveTaskFn
  onDeleteTask: (id: string) => void
}

export function KanbanBoard({ initialTasks, moveTaskFn, onDeleteTask }: KanbanBoardProps) {
  const { columns, isPending, moveOptimistic } = useKanbanBoard(initialTasks, moveTaskFn)

  return (
    <div className="grid grid-cols-3 gap-6">
      {columns.map(({ status, config, tasks }) => (
        <div key={status} className={config.color}>
          <h2>{config.label} ({tasks.length})</h2>
          {tasks.map(task => (
            <ActionableTaskCard
              key={task.id}
              task={task}
              isPending={isPending}
              onDelete={onDeleteTask}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Uso en page.tsx (wiring de dependencias) ─────────────────────────────────
//
// import { moveTask, deleteTask } from '@/actions/task.actions'
//
// export default function BoardPage() {
//   return (
//     <KanbanBoard
//       initialTasks={tasks}
//       moveTaskFn={moveTask}          // inyección de la concreción en el borde externo
//       onDeleteTask={id => deleteTask(id)}
//     />
//   )
// }
