'use client'

import { memo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import { SortableTaskCard } from './sortable-task-card'
import { CreateTaskDialog } from './create-task-dialog'
import type { KanbanColumn as KanbanColumnType } from '@/types/app.types'

interface ColumnProps {
  column: KanbanColumnType
  colorClass: string
  isPending: boolean
}

export const KanbanColumn = memo(function KanbanColumn({ column, colorClass, isPending }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col rounded-xl border border-border/50 transition-colors duration-200',
        colorClass,
        isOver && 'ring-2 ring-primary ring-offset-2'
      )}
    >
      {/* Header de columna */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-tight">{column.title}</h2>
          <span className="text-xs text-muted-foreground bg-background/60 px-2 py-0.5 rounded-full">
            {column.tasks.length}
          </span>
        </div>
        <CreateTaskDialog defaultStatus={column.id} />
      </div>

      {/* Lista de tareas */}
      <div
        className={cn(
          'flex-1 p-3 flex flex-col gap-2 min-h-[200px] transition-opacity',
          isPending && 'opacity-70'
        )}
      >
        <SortableContext
          items={column.tasks.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.tasks.map(task => (
            <SortableTaskCard key={task.id} task={task} />
          ))}
        </SortableContext>

        {column.tasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-muted-foreground/60 select-none">
              Arrastra tareas aquí
            </p>
          </div>
        )}
      </div>
    </div>
  )
})