'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
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
  const [isOpen, setIsOpen] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor')
  const [isPending, startTransition] = useTransition()
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getProjects().then(result => {
      if (result.success) {
        setProjects(result.data)
        // URL project_id always wins over stored localStorage value
        const urlProjectId = new URLSearchParams(window.location.search).get('project_id')
        const urlMatch = urlProjectId ? result.data.find(p => p.id === urlProjectId) : null
        if (urlMatch) {
          setActiveProject({ id: urlMatch.id, name: urlMatch.name, role: urlMatch.role })
        } else {
          const stored = result.data.find(p => p.id === activeProject?.id)
          if (!stored && result.data.length > 0) {
            // Auto-select most active project (already sorted by task_count DESC)
            const best = result.data[0]
            setActiveProject({ id: best.id, name: best.name, role: best.role })
          }
        }
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        className="flex items-center gap-1.5 min-w-0 group"
        title="Cambiar proyecto"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight leading-none truncate max-w-[120px]">
            TaskFlow AI
          </p>
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
            <span className="truncate max-w-[110px]">{displayName}</span>
            <ChevronsUpDown
              size={9}
              className="flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
            />
          </p>
        </div>
      </button>

      {isOpen && (
        <div className={cn(
          'absolute left-0 top-full mt-1 z-50',
          'w-52 rounded-lg border border-border/60 bg-popover shadow-lg',
          'py-1 text-sm'
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
                    'w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors',
                    'hover:bg-muted/60 rounded-md mx-0.5',
                    activeProject?.id === p.id && 'text-indigo-700 dark:text-indigo-300'
                  )}
                >
                  <FolderKanban size={13} className="flex-shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-xs">{p.name}</span>
                  <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">
                    {ROLE_LABELS[p.role]}
                  </span>
                  {activeProject?.id === p.id && (
                    <Check size={11} className="flex-shrink-0 text-indigo-600 dark:text-indigo-400" />
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
                    'w-full px-2 py-1 text-xs rounded-md border border-border/60 bg-background',
                    'focus:outline-none focus:ring-1 focus:ring-indigo-500/50'
                  )}
                />
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as 'editor' | 'viewer')}
                  className={cn(
                    'w-full px-2 py-1 text-xs rounded-md border border-border/60 bg-background',
                    'focus:outline-none focus:ring-1 focus:ring-indigo-500/50'
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
                      'flex-1 py-1 text-xs rounded-md text-center transition-colors',
                      'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed'
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
                  'w-full px-2 py-1 text-xs rounded-md border border-border/60 bg-background',
                  'focus:outline-none focus:ring-1 focus:ring-indigo-500/50'
                )}
              />
              <div className="flex gap-1">
                <button
                  onClick={handleCreateProject}
                  disabled={!newName.trim() || isPending}
                  className={cn(
                    'flex-1 py-1 text-xs rounded-md text-center transition-colors',
                    'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed'
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
