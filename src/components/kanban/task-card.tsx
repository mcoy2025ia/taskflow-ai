'use client'

import { memo, useTransition, useState, useRef, useEffect } from 'react'
import { Trash2, CalendarDays, GripVertical, UserPlus, CircleCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { deleteTask, assignTask, unassignTask } from '@/actions/task.actions'
import { MemberAvatar } from './member-filter-bar'
import { useTaskDrawer } from './board'
import { toast } from 'sonner'
import type { TaskWithAssignees, ProjectMember } from '@/types/app.types'

const dueDateFormatter = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' })

const PRIORITY_CONFIG = {
  low: { label: 'Baja', className: 'border-slate-400/20 bg-slate-500/[0.08] text-slate-600 dark:text-slate-300', dot: 'bg-slate-400' },
  medium: { label: 'Media', className: 'border-amber-500/20 bg-amber-500/[0.08] text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  high: { label: 'Alta', className: 'border-red-500/20 bg-red-500/[0.08] text-red-700 dark:text-red-300', dot: 'bg-red-500' },
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
  const isOverdue = Boolean(task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date())

  useEffect(() => setAssignees(task.assignees), [task.assignees])

  useEffect(() => {
    if (!showAssignMenu) return
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setShowAssignMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showAssignMenu])

  function handleDelete(event: React.MouseEvent) {
    event.stopPropagation()
    startTransition(async () => {
      const result = await deleteTask(task.id)
      if (!result.success) toast.error(result.error)
    })
  }

  function handleToggleAssign(event: React.MouseEvent, userId: string) {
    event.stopPropagation()
    const isAssigned = assignees.includes(userId)
    setAssignees(current => isAssigned ? current.filter(id => id !== userId) : [...current, userId])
    startTransition(async () => {
      const result = isAssigned ? await unassignTask(task.id, userId) : await assignTask(task.id, userId)
      if (!result.success) {
        toast.error(result.error)
        setAssignees(current => isAssigned ? [...current, userId] : current.filter(id => id !== userId))
      }
    })
  }

  const assignedMembers = members.filter(member => assignees.includes(member.userId))
  const visibleAvatars = assignedMembers.slice(0, 3)
  const overflow = assignedMembers.length - visibleAvatars.length

  return (
    <div className={cn(
      'interactive-card group relative cursor-grab overflow-visible rounded-[8px] border border-border/75 bg-card p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] active:cursor-grabbing',
      'before:absolute before:inset-y-3 before:left-0 before:w-[3px] before:rounded-r-full',
      task.priority === 'high' && 'before:bg-red-500',
      task.priority === 'medium' && 'before:bg-amber-500',
      task.priority === 'low' && 'before:bg-slate-400',
      isOverlay && 'rotate-[1deg] scale-[1.025] border-primary/40 bg-card/92 shadow-2xl backdrop-blur-xl',
      isPending && 'pointer-events-none opacity-50'
    )}>
      <GripVertical size={14} className="absolute right-3 top-3.5 text-muted-foreground/25 transition-colors group-hover:text-muted-foreground/65" />

      <div className="flex flex-col gap-2.5 pl-1 pr-5">
        <button
          onPointerDown={event => event.stopPropagation()}
          onClick={event => { event.stopPropagation(); if (!isOverlay) openDrawer(task) }}
          className="focus-ring line-clamp-2 cursor-pointer rounded-sm text-left text-[13px] font-semibold leading-snug text-foreground hover:text-primary"
        >
          {task.title}
        </button>

        {task.description && <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{task.description}</p>}

        <div className="mt-0.5 flex items-center justify-between gap-2">
          <Badge variant="outline" className={cn('h-5 gap-1.5 rounded-full px-2 text-[9px] font-semibold', priority.className)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', priority.dot)} />
            {priority.label}
          </Badge>

          <div className="flex items-center gap-1">
            {task.due_date && (
              <span className={cn('flex items-center gap-1 text-[10px] font-medium', isOverdue ? 'text-red-600 dark:text-red-300' : 'text-muted-foreground')}>
                {task.status === 'done' ? <CircleCheck size={11} /> : <CalendarDays size={11} />}
                {dueDateFormatter.format(new Date(task.due_date))}
              </span>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-[6px] text-muted-foreground opacity-70 hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100" onClick={handleDelete} title="Eliminar tarea">
              <Trash2 size={12} />
            </Button>
          </div>
        </div>

        {members.length > 0 && (
          <div className="relative mt-0.5 flex min-h-[20px] items-center gap-1.5 border-t border-border/55 pt-2.5" ref={menuRef}>
            {visibleAvatars.length > 0 && (
              <div className="flex items-center">
                {visibleAvatars.map((member, index) => (
                  <div key={member.userId} style={{ marginLeft: index === 0 ? 0 : -6, zIndex: visibleAvatars.length - index }} className="rounded-full ring-2 ring-card">
                    <MemberAvatar member={member} size={18} />
                  </div>
                ))}
                {overflow > 0 && <span className="ml-1 text-[9px] text-muted-foreground">+{overflow}</span>}
              </div>
            )}

            <button
              onPointerDown={event => event.stopPropagation()}
              onClick={event => { event.stopPropagation(); setShowAssignMenu(open => !open) }}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-border/80 bg-background text-muted-foreground/70 hover:border-primary/30 hover:text-primary sm:opacity-0 sm:group-hover:opacity-100"
              title="Asignar"
            >
              <UserPlus size={10} />
            </button>

            {showAssignMenu && (
              <div className="material-panel absolute bottom-full left-0 z-50 mb-1.5 w-48 rounded-[8px] py-1.5 shadow-xl animate-in">
                <p className="px-2.5 py-1 text-[9px] font-bold uppercase text-muted-foreground/70">Asignar a</p>
                {members.map(member => {
                  const assigned = assignees.includes(member.userId)
                  return (
                    <button key={member.userId} onPointerDown={event => event.stopPropagation()} onClick={event => handleToggleAssign(event, member.userId)} className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs hover:bg-muted/70">
                      <MemberAvatar member={member} size={18} />
                      <span className="min-w-0 flex-1 truncate">{member.name.split(' ')[0]}</span>
                      {assigned && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />}
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
