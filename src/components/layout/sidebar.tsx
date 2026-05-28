'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useTransition, type ReactNode, type ElementType } from 'react'
import {
  LayoutDashboard,
  MessageSquareText,
  BarChart2,
  Settings,
  Cpu,
  LogOut,
  Zap,
  X,
  Plus,
  Trash2,
} from 'lucide-react'
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

const NAV_MAIN = [
  {
    href: '/board',
    label: 'Tablero',
    icon: LayoutDashboard,
    testId: 'nav-board',
  },
  {
    href: '/chat',
    label: 'Asistente IA',
    icon: MessageSquareText,
    testId: 'nav-chat',
  },
  {
    href: '/analytics',
    label: 'Analítica',
    icon: BarChart2,
    testId: 'nav-analytics',
  },
]

const NAV_SETTINGS = [
  {
    href: '/settings',
    label: 'Preferencias',
    icon: Settings,
    testId: 'nav-settings',
  },
  {
    href: '/settings/ai',
    label: 'Modelos IA',
    icon: Cpu,
    testId: 'nav-ai',
  },
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
      'fixed inset-y-0 left-0 z-40 md:static',
      'w-[220px] flex-shrink-0 flex flex-col apple-glass bg-background/60 border-r border-border/40 h-full',
      'transition-transform duration-300 ease-in-out md:transition-none',
      isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
    )}>
      {/* Brand */}
      <div className="flex items-center justify-between gap-2.5 px-4 py-[18px] border-b border-border/50">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-[7px] bg-gradient-to-br from-indigo-600 to-violet-500 flex items-center justify-center flex-shrink-0">
            <Zap size={14} className="text-white" strokeWidth={2.5} />
          </div>
          <ProjectSwitcher />
        </div>
        <button
          onClick={onClose}
          className="md:hidden w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto">
        <NavSection label="Principal">
          {NAV_MAIN.map(item => (
            <NavItem
              key={item.href}
              {...item}
              isActive={pathname === item.href || (item.href === '/chat' && pathname.startsWith('/chat'))}
              onClick={onClose}
            />
          ))}
          {pathname.startsWith('/chat') && <ChatSessions currentPath={pathname} />}
        </NavSection>

        <NavSection label="Configuración">
          {NAV_SETTINGS.map(item => (
            <NavItem
              key={item.href}
              {...item}
              isActive={pathname.startsWith(item.href)}
              onClick={onClose}
            />
          ))}
        </NavSection>
      </nav>

      {/* User footer */}
      <div className="px-2 py-2 border-t border-border/50">
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-[7px] hover:bg-muted/60 transition-colors group">
          {/* Avatar */}
          {avatarUrl ? (
            <div className="relative w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
              <Image 
                src={avatarUrl} 
                alt={userName}
                width={28}  // ✅ Ajustado a w-7 (28px)
                height={28} // ✅ Ajustado a h-7 (28px)
                className="object-cover"
              />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                {userInitials}
              </span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate leading-none">{userName}</p>
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
              {userEmail}
            </p>
          </div>

          <button
            onClick={handleLogout}
            disabled={isPending}
            data-testid="logout-btn"
            title="Cerrar sesión"
            className={cn(
              'w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0',
              'border border-border/50 text-muted-foreground',
              'opacity-0 group-hover:opacity-100 transition-all',
              'hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30',
              isPending && 'opacity-50 cursor-not-allowed'
            )}
          >
            <LogOut size={12} />
          </button>
        </div>
      </div>
    </aside>
  )
}

function ChatSessions({ currentPath }: { currentPath: string }) {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([])
  const [, startTransition] = useTransition()

  function loadSessions() {
    getChatSessions().then(setSessions)
  }

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
        setSessions(prev => prev.filter(s => s.id !== sessionId))
        // If deleting current session, go to fresh chat
        if (currentPath.includes(sessionId)) {
          window.location.href = '/chat'
        }
      } else {
        toast.error('No se pudo eliminar la conversación')
      }
    })
  }

  if (!sessions.length) return null

  return (
    <div className="mt-1 ml-2 border-l border-border/40 pl-2 flex flex-col gap-0.5">
      <Link
        href="/chat"
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-[6px] text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors group"
      >
        <Plus size={11} />
        <span>Nueva conversación</span>
      </Link>
      {sessions.slice(0, 6).map(s => {
        const isActive = currentPath.includes(s.id)
        return (
          <div key={s.id} className={cn(
            'flex items-center gap-1 px-2 py-1.5 rounded-[6px] group transition-colors',
            isActive ? 'bg-indigo-50 dark:bg-indigo-950/40' : 'hover:bg-muted/50'
          )}>
            <Link
              href={`/chat?session_id=${s.id}`}
              className={cn(
                'flex-1 truncate text-xs leading-none',
                isActive ? 'text-indigo-700 dark:text-indigo-300 font-medium' : 'text-muted-foreground hover:text-foreground'
              )}
              title={s.title}
            >
              {s.title}
            </Link>
            <button
              onClick={(e) => handleDelete(e, s.id)}
              className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/60 hover:text-destructive"
              title="Eliminar conversación"
            >
              <Trash2 size={11} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

function NavSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-2">
      <p className="text-[10px] font-medium text-muted-foreground/70 px-2 py-1.5 uppercase tracking-widest">
        {label}
      </p>
      {children}
    </div>
  )
}

function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
  testId,
  onClick,
}: {
  href: string
  label: string
  icon: ElementType
  isActive: boolean
  testId: string
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 px-2.5 py-[7px] rounded-[7px]',
        'text-sm transition-all duration-150',
        isActive
          ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      )}
    >
      <Icon
        size={15}
        strokeWidth={isActive ? 2 : 1.75}
        className={cn(isActive ? 'text-indigo-600 dark:text-indigo-400' : '')}
      />
      <span className="leading-none">{label}</span>
    </Link>
  )
}