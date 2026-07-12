'use client'

import { memo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SortableTaskCard } from './sortable-task-card'
import { CreateTaskDialog } from './create-task-dialog'
import type { KanbanColumn as KanbanColumnType, ProjectMember } from '@/types/app.types'

interface ColumnProps {
  column: KanbanColumnType
  accentClass: string
  isPending: boolean
  members: ProjectMember[]
  projectId: string | null
}

export const KanbanColumn = memo(function KanbanColumn({ column, accentClass, isPending, members, projectId }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'material-subtle flex flex-col overflow-hidden rounded-[8px] transition-[box-shadow,border-color,background-color] duration-200 md:min-h-0',
        isOver && 'border-primary/50 bg-primary/[0.045] shadow-[0_0_0_3px_rgba(59,130,246,0.10)]'
      )}
    >
      <div className="flex h-12 items-center justify-between border-b border-border/60 bg-card/45 px-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', accentClass)} />
          <h2 className="truncate text-[13px] font-semibold">{column.title}</h2>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full border border-border/70 bg-background/70 px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
            {column.tasks.length}
          </span>
        </div>
        <CreateTaskDialog defaultStatus={column.id} projectId={projectId} />
      </div>

      <div className={cn('flex min-h-[220px] flex-1 flex-col gap-2.5 p-2.5 transition-opacity md:overflow-y-auto', isPending && 'opacity-65')}>
        <SortableContext items={column.tasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
          {column.tasks.map(task => <SortableTaskCard key={task.id} task={task} members={members} />)}
        </SortableContext>

        {column.tasks.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-[7px] border border-dashed border-border/80 px-4 py-10 text-center">
            <Inbox size={18} className="text-muted-foreground/45" strokeWidth={1.6} />
            <p className="select-none text-[11px] text-muted-foreground/70">Arrastra tareas aquí</p>
          </div>
        )}
      </div>
    </div>
  )
})
