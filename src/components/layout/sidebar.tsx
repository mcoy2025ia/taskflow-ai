'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useTransition, type ElementType } from 'react'
import { LayoutDashboard, MessageSquareText, ChartNoAxesCombined, LogOut, Zap, X, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from '@/actions/auth.actions'
import { getChatSessions, deleteChatSession, type ChatSessionSummary } from '@/actions/chat.actions'
import { toast } from 'sonner'
import { ProjectSwitcher } from './project-switcher'

interface SidebarProps {
  userName: string
  userEmail: string
  userInitials: string
  avatarUrl: string | null
  isOpen?: boolean
  onClose?: () => void
}

const NAV_ITEMS = [
  { href: '/board', label: 'Tablero', icon: LayoutDashboard, testId: 'nav-board' },
  { href: '/chat', label: 'Asistente IA', icon: MessageSquareText, testId: 'nav-chat' },
  { href: '/analytics', label: 'Analítica', icon: ChartNoAxesCombined, testId: 'nav-analytics' },
]

export function Sidebar({ userName, userEmail, userInitials, avatarUrl, isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  function handleLogout() {
    startTransition(async () => {
      const result = await signOut()
      if (!result.success) toast.error('Error al cerrar sesión')
    })
  }

  return (
    <aside className={cn(
      'fixed inset-y-0 left-0 z-40 flex h-full w-[248px] flex-shrink-0 flex-col border-r border-border/70 bg-card/92 backdrop-blur-xl md:static',
      'transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)] md:transition-none',
      isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
    )}>
      <div className="flex h-16 items-center justify-between border-b border-border/60 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[8px] bg-foreground text-background shadow-sm">
            <Zap size={16} fill="currentColor" strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <p className="mb-0.5 text-[9px] font-bold uppercase text-muted-foreground">TaskFlow</p>
            <ProjectSwitcher />
          </div>
        </div>
        <button onClick={onClose} className="focus-ring flex h-8 w-8 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-muted hover:text-foreground md:hidden" aria-label="Cerrar navegación">
          <X size={16} />
        </button>
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-5">
        <p className="mb-2 px-2 text-[10px] font-bold uppercase text-muted-foreground/70">Organizar</p>
        <div className="space-y-1">
          {NAV_ITEMS.map(item => (
            <NavItem
              key={item.href}
              {...item}
              isActive={pathname === item.href || pathname.startsWith(`${item.href}/`) || (item.href === '/chat' && pathname.startsWith('/chat'))}
              onClick={onClose}
            />
          ))}
        </div>

        {pathname.startsWith('/chat') && <ChatSessions currentPath={pathname} />}

        <div className="mt-auto pt-6">
          <div className="material-subtle rounded-[8px] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold">Asistente conectado</p>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground">Groq + búsqueda semántica disponibles en tu proyecto.</p>
          </div>
        </div>
      </nav>

      <div className="border-t border-border/60 p-3">
        <div className="group flex items-center gap-2.5 rounded-[8px] p-2 hover:bg-muted/70">
          {avatarUrl ? (
            <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-full ring-1 ring-border">
              <Image src={avatarUrl} alt={userName} width={32} height={32} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/15">
              <span className="text-[11px] font-bold text-primary">{userInitials}</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{userName}</p>
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{userEmail}</p>
          </div>
          <button
            onClick={handleLogout}
            disabled={isPending}
            data-testid="logout-btn"
            title="Cerrar sesión"
            className="focus-ring flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[8px] text-muted-foreground opacity-70 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}

function ChatSessions({ currentPath }: { currentPath: string }) {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([])
  const [, startTransition] = useTransition()

  function loadSessions() { getChatSessions().then(setSessions) }

  useEffect(() => {
    loadSessions()
    window.addEventListener('taskflow:session_updated', loadSessions)
    return () => window.removeEventListener('taskflow:session_updated', loadSessions)
  }, [])

  function handleDelete(e: React.MouseEvent, sessionId: string) {
    e.preventDefault()
    e.stopPropagation()
    startTransition(async () => {
      const result = await deleteChatSession(sessionId)
      if (result.success) {
        setSessions(prev => prev.filter(session => session.id !== sessionId))
        if (currentPath.includes(sessionId)) window.location.href = '/chat'
      } else toast.error('No se pudo eliminar la conversación')
    })
  }

  if (!sessions.length) return null

  return (
    <div className="ml-4 mt-2 space-y-1 border-l border-border/70 pl-3">
      <Link href="/chat" className="flex items-center gap-2 rounded-[7px] px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground">
        <Plus size={12} /> Nueva conversación
      </Link>
      {sessions.slice(0, 5).map(session => {
        const isActive = currentPath.includes(session.id)
        return (
          <div key={session.id} className={cn('group/session flex items-center gap-1 rounded-[7px] px-2 py-1.5', isActive ? 'bg-primary/[0.08]' : 'hover:bg-muted/60')}>
            <Link href={`/chat?session_id=${session.id}`} className={cn('min-w-0 flex-1 truncate text-[11px]', isActive ? 'font-semibold text-primary' : 'text-muted-foreground')} title={session.title}>
              {session.title}
            </Link>
            <button onClick={event => handleDelete(event, session.id)} className="text-muted-foreground opacity-0 hover:text-destructive group-hover/session:opacity-100" title="Eliminar conversación">
              <Trash2 size={11} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

function NavItem({ href, label, icon: Icon, isActive, testId, onClick }: { href: string; label: string; icon: ElementType; isActive: boolean; testId: string; onClick?: () => void }) {
  return (
    <Link
      href={href}
      data-testid={testId}
      onClick={onClick}
      className={cn(
        'focus-ring group relative flex h-10 items-center gap-3 rounded-[8px] px-3 text-[13px] font-medium',
        isActive ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
      )}
    >
      <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} />
      <span>{label}</span>
      {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-foreground/80" />}
    </Link>
  )
}
