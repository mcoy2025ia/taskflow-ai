'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { X, Send, Trash2, Calendar, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { MemberAvatar } from './member-filter-bar'
import { addComment, getComments, deleteComment, type CommentRow } from '@/actions/comment.actions'
import { toast } from 'sonner'
import type { TaskWithAssignees, ProjectMember } from '@/types/app.types'

interface TaskDrawerProps {
  task: TaskWithAssignees | null
  members: ProjectMember[]
  currentUserId: string
  onClose: () => void
}

const PRIORITY_CONFIG = {
  low:    { label: 'Baja',  class: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  medium: { label: 'Media', class: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  high:   { label: 'Alta',  class: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
}

const STATUS_LABELS = {
  todo:        'Por hacer',
  in_progress: 'En progreso',
  done:        'Completado',
}

const dateFormatter = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
const timeFormatter = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })

export function TaskDrawer({ task, members, currentUserId, onClose }: TaskDrawerProps) {
  const [comments, setComments] = useState<CommentRow[]>([])
  const [newComment, setNewComment] = useState('')
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!task) { setComments([]); return }
    setIsLoading(true)
    getComments(task.id).then(result => {
      setIsLoading(false)
      if (result.success) setComments(result.data)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id])  // solo re-fetch cuando cambia el ID, no cada vez que cambia una propiedad

  // Scroll to bottom when new comments arrive
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!task || !newComment.trim()) return

    const content = newComment.trim()
    setNewComment('')

    startTransition(async () => {
      const result = await addComment({ taskId: task.id, content })
      if (result.success) {
        setComments(prev => [...prev, result.data])
      } else {
        toast.error(result.error)
        setNewComment(content) // restore on error
      }
    })
  }

  function handleDeleteComment(commentId: string) {
    startTransition(async () => {
      const result = await deleteComment(commentId)
      if (result.success) {
        setComments(prev => prev.filter(c => c.id !== commentId))
      } else {
        toast.error(result.error)
      }
    })
  }

  const isOpen = task !== null
  const priority = task ? PRIORITY_CONFIG[task.priority] : null
  const assignedMembers = task ? members.filter(m => task.assignees.includes(m.userId)) : []

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer panel */}
      <aside className={cn(
        'fixed top-0 right-0 z-50 h-full w-full max-w-sm',
        'bg-background border-l border-border/60 shadow-xl',
        'flex flex-col transition-transform duration-300 ease-in-out',
        isOpen ? 'translate-x-0' : 'translate-x-full'
      )}>
        {task && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-4 py-4 border-b border-border/50">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-snug line-clamp-2">
                  {task.title}
                </p>
                <span className="text-xs text-muted-foreground mt-0.5 block">
                  {STATUS_LABELS[task.status]}
                </span>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              {/* Meta section */}
              <div className="px-4 py-3 flex flex-col gap-3 border-b border-border/40">
                <div className="flex items-center gap-2 flex-wrap">
                  {priority && (
                    <Badge variant="outline" className={cn('text-xs px-2 py-0', priority.class)}>
                      {priority.label}
                    </Badge>
                  )}
                  {task.due_date && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar size={11} />
                      {dateFormatter.format(new Date(task.due_date))}
                    </span>
                  )}
                </div>

                {task.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {task.description}
                  </p>
                )}

                {assignedMembers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Asignado a:</span>
                    <div className="flex items-center gap-1">
                      {assignedMembers.map(m => (
                        <div key={m.userId} title={m.name}>
                          <MemberAvatar member={m} size={20} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Comments section */}
              <div className="px-4 py-3">
                <div className="flex items-center gap-1.5 mb-3">
                  <MessageSquare size={13} className="text-muted-foreground" />
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Comentarios
                  </h3>
                  {comments.length > 0 && (
                    <span className="text-xs text-muted-foreground">({comments.length})</span>
                  )}
                </div>

                {isLoading ? (
                  <div className="flex flex-col gap-2">
                    {[1, 2].map(i => (
                      <div key={i} className="h-12 rounded-lg bg-muted/50 animate-pulse" />
                    ))}
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 text-center py-4">
                    Aún no hay comentarios
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {comments.map(c => {
                      const author = members.find(m => m.userId === c.user_id)
                      const isOwn = c.user_id === currentUserId
                      return (
                        <div key={c.id} className="group flex gap-2">
                          {author
                            ? <MemberAvatar member={author} size={24} />
                            : (
                              <div className="w-6 h-6 rounded-full bg-muted flex-shrink-0 flex items-center justify-center">
                                <span className="text-[9px] text-muted-foreground">U</span>
                              </div>
                            )
                          }
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-xs font-medium">
                                {author?.name.split(' ')[0] ?? 'Usuario'}
                              </span>
                              <span className="text-[10px] text-muted-foreground/60">
                                {timeFormatter.format(new Date(c.created_at))}
                              </span>
                              {isOwn && (
                                <button
                                  onClick={() => handleDeleteComment(c.id)}
                                  className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/50 hover:text-destructive"
                                >
                                  <Trash2 size={10} />
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5 break-words">
                              {c.content}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={commentsEndRef} />
                  </div>
                )}
              </div>
            </div>

            {/* Comment input */}
            <div className="px-4 py-3 border-t border-border/50">
              <form onSubmit={handleSubmit} className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit()
                    }
                  }}
                  placeholder="Escribe un comentario… (Enter para enviar)"
                  rows={2}
                  maxLength={2000}
                  disabled={isPending}
                  className={cn(
                    'flex-1 px-3 py-2 text-xs rounded-lg border border-border/60 bg-background resize-none',
                    'focus:outline-none focus:ring-1 focus:ring-indigo-500/50',
                    'disabled:opacity-50 placeholder:text-muted-foreground/60'
                  )}
                />
                <button
                  type="submit"
                  disabled={!newComment.trim() || isPending}
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    'bg-indigo-600 text-white hover:bg-indigo-700 transition-colors',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <Send size={13} />
                </button>
              </form>
            </div>
          </>
        )}
      </aside>
    </>
  )
}
