'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronsUpDown, Check, Plus, FolderKanban, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useActiveProject } from '@/contexts/active-project'
import { getProjects, createProject, type ProjectSummary } from '@/actions/project.actions'
import { inviteToProject } from '@/actions/invite.actions'
import { toast } from 'sonner'

const ROLE_LABELS: Record<ProjectSummary['role'], string> = {
  owner: 'Tuyo',
  editor: 'Editor',
  viewer: 'Lector',
}

export function ProjectSwitcher() {
  const { activeProject, setActiveProject } = useActiveProject()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlProjectId = searchParams.get('project_id')
  const [isOpen, setIsOpen] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor')
  const [isPending, startTransition] = useTransition()
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load projects once on mount
  useEffect(() => {
    getProjects().then(result => {
      if (result.success) {
        setProjects(result.data)
        const match = urlProjectId ? result.data.find(p => p.id === urlProjectId) : null
        if (match) {
          setActiveProject({ id: match.id, name: match.name, role: match.role })
        } else {
          const stored = result.data.find(p => p.id === activeProject?.id)
          if (!stored && result.data.length > 0) {
            const best = result.data[0]
            setActiveProject({ id: best.id, name: best.name, role: best.role })
          }
        }
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync context whenever the URL project_id changes (e.g., board redirect)
  useEffect(() => {
    if (!urlProjectId || projects.length === 0) return
    const match = projects.find(p => p.id === urlProjectId)
    if (match && match.id !== activeProject?.id) {
      setActiveProject({ id: match.id, name: match.name, role: match.role })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlProjectId, projects])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setShowNewForm(false)
        setNewName('')
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  function handleSendInvite() {
    if (!inviteEmail.trim() || !activeProject) return
    startTransition(async () => {
      const result = await inviteToProject({
        projectId: activeProject.id,
        email: inviteEmail.trim(),
        role: inviteRole,
      })
      if (result.success) {
        toast.success(`Invitación enviada a ${inviteEmail.trim()}`)
        setShowInviteForm(false)
        setInviteEmail('')
        setInviteRole('editor')
        setIsOpen(false)
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleSelect(p: ProjectSummary) {
    setActiveProject({ id: p.id, name: p.name, role: p.role })
    setIsOpen(false)
    // Propagate project_id via URL so Server Components re-fetch with new project
    router.push(`${pathname}?project_id=${p.id}`)
  }

  function handleCreateProject() {
    if (!newName.trim()) return
    startTransition(async () => {
      const today = new Date().toISOString().split('T')[0]
      const result = await createProject({
        name: newName.trim(),
        start_date: today,
        delivery_date: today,
      })
      if (result.success) {
        const created: ProjectSummary = {
          id: result.data.id,
          name: result.data.name,
          start_date: today,
          delivery_date: today,
          role: 'owner',
          task_count: 0,
        }
        setProjects(prev => [...prev, created])
        setActiveProject({ id: created.id, name: created.name, role: 'owner' })
        setShowNewForm(false)
        setNewName('')
        setIsOpen(false)
        toast.success(`Proyecto "${created.name}" creado`)
      } else {
        toast.error(result.error)
      }
    })
  }

  const displayName = activeProject?.name ?? 'Cargando…'

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(o => !o)}
        className="group flex min-w-0 items-center gap-1.5"
        title="Cambiar proyecto"
      >
        <div className="min-w-0">
          <p className="flex max-w-[155px] items-center gap-1.5 truncate text-xs font-semibold leading-none">
            <span className="truncate">{displayName}</span>
            <ChevronsUpDown
              size={11}
              className="flex-shrink-0 opacity-50 group-hover:opacity-100"
            />
          </p>
          <p className="mt-1 text-left text-[9px] text-muted-foreground">{activeProject ? ROLE_LABELS[activeProject.role] : 'Proyecto activo'}</p>
        </div>
      </button>

      {isOpen && (
        <div className={cn(
          'absolute left-0 top-full mt-1 z-50',
          'material-panel w-64 rounded-[8px] py-1.5 text-sm shadow-xl animate-in'
        )}>
          {projects.length > 0 && (
            <>
              <p className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
                Proyectos
              </p>
              {projects.filter(p => p.task_count > 0).map(p => (
                <button
                  key={p.id}
                  onClick={() => handleSelect(p)}
                  className={cn(
                    'mx-0.5 flex w-[calc(100%-4px)] items-center gap-2 rounded-[7px] px-2.5 py-2 text-left',
                    'hover:bg-muted/70',
                    activeProject?.id === p.id && 'bg-primary/[0.07] text-primary'
                  )}
                >
                  <FolderKanban size={13} className="flex-shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-xs">{p.name}</span>
                  <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">
                    {ROLE_LABELS[p.role]}
                  </span>
                  {activeProject?.id === p.id && (
                    <Check size={11} className="flex-shrink-0 text-primary" />
                  )}
                </button>
              ))}
              <div className="my-1 border-t border-border/40" />
            </>
          )}

          {/* Invite form — only owners */}
          {activeProject?.role === 'owner' && (
            showInviteForm ? (
              <div className="px-2 py-1.5 flex flex-col gap-1.5">
                <input
                  autoFocus
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSendInvite()
                    if (e.key === 'Escape') { setShowInviteForm(false); setInviteEmail('') }
                  }}
                  placeholder="Email del invitado"
                  className={cn(
                    'h-8 w-full rounded-[7px] border border-border/70 bg-background px-2 text-xs',
                    'focus:outline-none focus:ring-2 focus:ring-primary/20'
                  )}
                />
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as 'editor' | 'viewer')}
                  className={cn(
                    'h-8 w-full rounded-[7px] border border-border/70 bg-background px-2 text-xs',
                    'focus:outline-none focus:ring-2 focus:ring-primary/20'
                  )}
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Lector</option>
                </select>
                <div className="flex gap-1">
                  <button
                    onClick={handleSendInvite}
                    disabled={!inviteEmail.trim() || isPending}
                    className={cn(
                      'flex-1 rounded-[7px] bg-primary py-1.5 text-center text-xs text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50'
                    )}
                  >
                    {isPending ? 'Enviando…' : 'Enviar'}
                  </button>
                  <button
                    onClick={() => { setShowInviteForm(false); setInviteEmail('') }}
                    className="px-2 py-1 text-xs rounded-md text-muted-foreground hover:bg-muted/60"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setShowInviteForm(true); setShowNewForm(false) }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-md mx-0.5 transition-colors"
              >
                <UserPlus size={12} />
                Invitar miembro
              </button>
            )
          )}

          {showNewForm ? (
            <div className="px-2 py-1.5 flex flex-col gap-1.5">
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateProject()
                  if (e.key === 'Escape') { setShowNewForm(false); setNewName('') }
                }}
                placeholder="Nombre del proyecto"
                maxLength={100}
                className={cn(
                  'h-8 w-full rounded-[7px] border border-border/70 bg-background px-2 text-xs',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20'
                )}
              />
              <div className="flex gap-1">
                <button
                  onClick={handleCreateProject}
                  disabled={!newName.trim() || isPending}
                  className={cn(
                    'flex-1 rounded-[7px] bg-primary py-1.5 text-center text-xs text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50'
                  )}
                >
                  {isPending ? 'Creando…' : 'Crear'}
                </button>
                <button
                  onClick={() => { setShowNewForm(false); setNewName('') }}
                  className="px-2 py-1 text-xs rounded-md text-muted-foreground hover:bg-muted/60"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setShowNewForm(true); setShowInviteForm(false) }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-md mx-0.5 transition-colors"
            >
              <Plus size={12} />
              Nuevo proyecto
            </button>
          )}
        </div>
      )}
    </div>
  )
}
