'use client'

import { memo, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trash2, Calendar, GripVertical } from 'lucide-react'
import { deleteTask } from '@/actions/task.actions'
import { toast } from 'sonner'
import type { Task } from '@/types/app.types'

// Module-level singleton — avoids re-creating the formatter on every render
const dueDateFormatter = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' })

const PRIORITY_CONFIG = {
  low:    { label: 'Baja',  class: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  medium: { label: 'Media', class: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  high:   { label: 'Alta',  class: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
}

interface TaskCardProps {
  task: Task
  isOverlay?: boolean
}

export const TaskCard = memo(function TaskCard({ task, isOverlay = false }: TaskCardProps) {
  const [isPending, startTransition] = useTransition()
  const priority = PRIORITY_CONFIG[task.priority]

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    startTransition(async () => {
      const result = await deleteTask(task.id)
      if (!result.success) toast.error(result.error)
    })
  }

  return (
    <div
      className={cn(
        'group relative bg-background rounded-lg border border-border/50 p-3',
        'shadow-sm hover:shadow-md transition-all duration-200',
        'hover:border-border cursor-grab active:cursor-grabbing',
        isOverlay && 'shadow-xl rotate-2 scale-105 border-primary/30',
        isPending && 'opacity-50 pointer-events-none'
      )}
    >
      {/* Grip handle visual */}
      <GripVertical
        size={14}
        className="absolute top-3 right-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors"
      />

      <div className="flex flex-col gap-2 pr-5">
        <p className="text-sm font-medium leading-snug line-clamp-2">
          {task.title}
        </p>

        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}

        <div className="flex items-center justify-between mt-1">
          <Badge variant="outline" className={cn('text-xs px-2 py-0', priority.class)}>
            {priority.label}
          </Badge>

          <div className="flex items-center gap-1">
            {task.due_date && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar size={10} />
                {dueDateFormatter.format(new Date(task.due_date))}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 size={12} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
})