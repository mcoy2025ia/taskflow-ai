/**
 * BAD CODE — Ejemplo con 6 violaciones SOLID
 * Contexto: TaskFlow AI — tablero Kanban
 *
 * Violaciones presentes:
 *  [SRP-1]  GodTaskBoard hace fetch, gestiona estado, calcula posiciones y renderiza
 *  [SRP-2]  handleDragEnd contiene lógica de negocio mezclada con lógica de UI
 *  [OCP-1]  Switch hardcoded de columnas: añadir "blocked" exige modificar este archivo
 *  [OCP-2]  Mapa de colores de prioridad embebido en JSX con ternarios anidados
 *  [ISP-1]  TaskItemProps obliga a todos los consumidores a recibir onDelete + onEdit
 *           aunque el overlay solo necesita renderizar, nunca actuar
 *  [DIP-1]  moveTask y deleteTask importados directamente — imposible testear en aislamiento
 */

'use client'

import { useState, useTransition } from 'react'
// [DIP-1] Dependencias concretas importadas directamente. No se pueden sustituir en tests.
import { moveTask, deleteTask } from '@/actions/task.actions'
import type { Task, TaskStatus } from '@/types/app.types'

// ─── [ISP-1] Interface segregation violation ─────────────────────────────────
// Todos los consumidores de TaskItem deben pasar onDelete y onEdit,
// aunque el componente de overlay solo necesita mostrar la tarjeta.
interface TaskItemProps {
  task: Task
  onDelete: (id: string) => void        // el overlay nunca lo usa
  onEdit: (id: string, title: string) => void  // el overlay nunca lo usa
  isOverlay?: boolean
  isPending?: boolean
}

// ─── [OCP-1] Open/Closed violation ───────────────────────────────────────────
// Para añadir la columna "blocked" hay que modificar este switch Y el componente.
function getColumnLabel(status: TaskStatus): string {
  switch (status) {
    case 'todo':        return 'Por hacer'
    case 'in_progress': return 'En progreso'
    case 'done':        return 'Completado'
    // Para añadir 'blocked' → modificar aquí, en el render y en los tipos. OCP roto.
    default:            return status
  }
}

// ─── [OCP-2] Colores hardcoded como ternarios ─────────────────────────────────
function getPriorityColor(priority: string): string {
  // Imposible extender sin modificar esta función
  return priority === 'high'
    ? 'text-red-600'
    : priority === 'medium'
    ? 'text-amber-500'
    : 'text-slate-400'   // low — añadir 'critical' requiere tocar aquí
}

// ─── [SRP-1 + DIP-1] God Component ───────────────────────────────────────────
// Responsabilidades mezcladas:
//   1. Estado del drag (activeTask)
//   2. Cálculo de nueva posición en handleDragEnd
//   3. Orquestación de Server Actions (moveTask)
//   4. Gestión de columnas y agrupación de tareas
//   5. Renderizado de UI
export function GodTaskBoard({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // [SRP-2] handleDragEnd mezcla: validación de entrada + cálculo de posición
  // + actualización optimista + llamada a servidor + manejo de error.
  // Tiene 6 razones para cambiar.
  async function handleDragEnd(activeId: string, overId: string) {
    if (activeId === overId) return

    const movedTask = tasks.find(t => t.id === activeId)
    const targetStatus = tasks.find(t => t.id === overId)?.status ?? overId as TaskStatus

    if (!movedTask || !targetStatus) return

    // Cálculo de posición embebido (debería ser una función pura separada)
    const siblings = tasks
      .filter(t => t.status === targetStatus && t.id !== activeId)
      .sort((a, b) => a.position - b.position)

    const overIndex = siblings.findIndex(t => t.id === overId)
    const prevPos = siblings[overIndex - 1]?.position ?? 0
    const nextPos = siblings[overIndex]?.position ?? prevPos + 2000
    const newPosition = Math.round((prevPos + nextPos) / 2)

    // Actualización de estado local (mezcla de UI con lógica)
    setTasks(prev => prev.map(t =>
      t.id === activeId ? { ...t, status: targetStatus, position: newPosition } : t
    ))

    // [DIP-1] Llamada directa a la concreción. Testear requiere mockear el módulo entero.
    startTransition(async () => {
      const result = await moveTask({ id: activeId, status: targetStatus, position: newPosition })
      if (!result.success) {
        // Revert sin useOptimistic: setState manual propenso a condiciones de carrera
        setTasks(initialTasks)
        alert(result.error) // alert en 2025 🤦
      }
    })
  }

  async function handleDelete(id: string) {
    // [DIP-1] Otra llamada directa a la concreción
    const result = await deleteTask(id)
    if (result.success) {
      setTasks(prev => prev.filter(t => t.id !== id))
    }
  }

  // Agrupar tareas: lógica de datos dentro del render
  const columns = ['todo', 'in_progress', 'done'] as TaskStatus[]
  const grouped = columns.map(status => ({
    status,
    label: getColumnLabel(status),
    tasks: tasks.filter(t => t.status === status).sort((a, b) => a.position - b.position),
  }))

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {grouped.map(col => (
        <div key={col.status}>
          <h2>{col.label} ({col.tasks.length})</h2>
          {col.tasks.map(task => (
            // [ISP-1] Pasar onDelete y onEdit aunque el rendering normal tampoco
            // debería conocer estas operaciones a este nivel
            <TaskItem
              key={task.id}
              task={task}
              onDelete={handleDelete}
              onEdit={(id, title) => console.log('edit', id, title)}
              isPending={isPending}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function TaskItem({ task, onDelete, isPending }: TaskItemProps) {
  return (
    <div style={{ opacity: isPending ? 0.5 : 1 }}>
      <p>{task.title}</p>
      {/* [OCP-2] Color calculado con función no extensible */}
      <span className={getPriorityColor(task.priority)}>{task.priority}</span>
      <button onClick={() => onDelete(task.id)}>Eliminar</button>
    </div>
  )
}
