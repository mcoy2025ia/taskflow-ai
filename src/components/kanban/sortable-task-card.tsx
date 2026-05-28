'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TaskCard } from './task-card'
import type { TaskWithAssignees, ProjectMember } from '@/types/app.types'

interface SortableTaskCardProps {
  task: TaskWithAssignees
  members: ProjectMember[]
}

export function SortableTaskCard({ task, members }: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 'auto',
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} members={members} />
    </div>
  )
}
