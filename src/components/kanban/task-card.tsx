'use client'

import { memo, useTransition, useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trash2, Calendar, GripVertical, UserPlus } from 'lucide-react'
import { deleteTask, assignTask, unassignTask } from '@/actions/task.actions'
import { MemberAvatar } from './member-filter-bar'
import { useTaskDrawer } from './board'
import { toast } from 'sonner'
import type { TaskWithAssignees, ProjectMember } from '@/types/app.types'

const dueDateFormatter = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' })

const PRIORITY_CONFIG = {
  low:    { label: 'Baja',  class: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  medium: { label: 'Media', class: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  high:   { label: 'Alta',  class: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
}

interface TaskCardProps {
  task: TaskWithAssignees
  members: ProjectMember[]
  isOverlay?: boolean
}

export const TaskCard = memo(function TaskCard({ task, members, isOverlay = false }: TaskCardProps) {
  const openDrawer = useTaskDrawer()
  const [isPending, startTransition] = useTransition()
  const [assignees, setAssignees] = useState<string[]>(task.assignees)
  const [showAssignMenu, setShowAssignMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const priority = PRIORITY_CONFIG[task.priority]

  useEffect(() => {
    setAssignees(task.assignees)
  }, [task.assignees])

  // Close menu on outside click
  useEffect(() => {
    if (!showAssignMenu) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowAssignMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showAssignMenu])

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    startTransition(async () => {
      const result = await deleteTask(task.id)
      if (!result.success) toast.error(result.error)
    })
  }

  function handleToggleAssign(e: React.MouseEvent, userId: string) {
    e.stopPropagation()
    const isAssigned = assignees.includes(userId)
    setAssignees(prev => isAssigned ? prev.filter(id => id !== userId) : [...prev, userId])
    startTransition(async () => {
      const result = isAssigned
        ? await unassignTask(task.id, userId)
        : await assignTask(task.id, userId)
      if (!result.success) {
        toast.error(result.error)
        // Revert optimistic update
        setAssignees(prev => isAssigned ? [...prev, userId] : prev.filter(id => id !== userId))
      }
    })
  }

  const assignedMembers = members.filter(m => assignees.includes(m.userId))
  const visibleAvatars = assignedMembers.slice(0, 3)
  const overflow = assignedMembers.length - visibleAvatars.length

  return (
    <div
      className={cn(
        'group relative bg-card rounded-xl border border-border/50 p-4.5',
        'shadow-sm apple-card-hover cursor-grab active:cursor-grabbing',
        task.priority === 'high' && 'border-l-[4px] border-l-red-500/85',
        task.priority === 'medium' && 'border-l-[4px] border-l-amber-500/85',
        task.priority === 'low' && 'border-l-[4px] border-l-emerald-500/80',
        isOverlay && 'shadow-xl rotate-[1.5deg] scale-[1.03] border-primary/45 bg-card/90 backdrop-blur-md',
        isPending && 'opacity-50 pointer-events-none'
      )}
    >
      <GripVertical
        size={14}
        className="absolute top-4 right-4 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors"
      />

      <div className="flex flex-col gap-2 pr-5">
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); if (!isOverlay) openDrawer(task) }}
          className="text-sm font-medium leading-snug line-clamp-2 text-left hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors cursor-pointer"
        >
          {task.title}
        </button>

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

        {/* Avatar stack + assign button — only when project has members */}
        {members.length > 0 && (
          <div className="flex items-center gap-1.5 mt-0.5 relative" ref={menuRef}>
            {/* Stacked avatars */}
            {visibleAvatars.length > 0 && (
              <div className="flex items-center">
                {visibleAvatars.map((m, i) => (
                  <div
                    key={m.userId}
                    style={{ marginLeft: i === 0 ? 0 : -6, zIndex: visibleAvatars.length - i }}
                    className="ring-1 ring-background rounded-full"
                  >
                    <MemberAvatar member={m} size={18} />
                  </div>
                ))}
                {overflow > 0 && (
                  <span className="text-[10px] text-muted-foreground ml-1">+{overflow}</span>
                )}
              </div>
            )}

            {/* Assign button */}
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); setShowAssignMenu(o => !o) }}
              className={cn(
                'w-[18px] h-[18px] rounded-full border border-border/60 flex items-center justify-center',
                'text-muted-foreground/60 hover:text-foreground hover:border-border transition-colors',
                'opacity-0 group-hover:opacity-100'
              )}
              title="Asignar"
            >
              <UserPlus size={10} />
            </button>

            {/* Assignment dropdown */}
            {showAssignMenu && (
              <div className={cn(
                'absolute bottom-full left-0 mb-1 z-50',
                'w-44 rounded-lg border border-border/60 bg-popover shadow-lg py-1'
              )}>
                <p className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
                  Asignar a
                </p>
                {members.map(m => {
                  const assigned = assignees.includes(m.userId)
                  return (
                    <button
                      key={m.userId}
                      onPointerDown={e => e.stopPropagation()}
                      onClick={e => handleToggleAssign(e, m.userId)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-muted/60 transition-colors"
                    >
                      <MemberAvatar member={m} size={16} />
                      <span className="flex-1 truncate">{m.name.split(' ')[0]}</span>
                      {assigned && (
                        <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
