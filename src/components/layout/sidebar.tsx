'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTransition } from 'react'
import {
  LayoutDashboard,
  MessageSquareText,
  Settings,
  Cpu,
  LogOut,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from '@/actions/auth.actions'
import { toast } from 'sonner'

interface SidebarProps {
  userName: string
  userEmail: string
  userInitials: string
  avatarUrl: string | null
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

export function Sidebar({ userName, userEmail, userInitials, avatarUrl }: SidebarProps) {
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  function handleLogout() {
    startTransition(async () => {
      const result = await signOut()
      if (!result.success) toast.error('Error al cerrar sesión')
    })
  }

  return (
    <aside className="w-[220px] flex-shrink-0 flex flex-col bg-background border-r border-border/50 h-full">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-[18px] border-b border-border/50">
        <div className="w-7 h-7 rounded-[7px] bg-gradient-to-br from-indigo-600 to-violet-500 flex items-center justify-center flex-shrink-0">
          <Zap size={14} className="text-white" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight leading-none">
            TaskFlow AI
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Workspace personal
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto">
        <NavSection label="Principal">
          {NAV_MAIN.map(item => (
            <NavItem
              key={item.href}
              {...item}
              isActive={pathname === item.href}
            />
          ))}
        </NavSection>

        <NavSection label="Configuración">
          {NAV_SETTINGS.map(item => (
            <NavItem
              key={item.href}
              {...item}
              isActive={pathname.startsWith(item.href)}
            />
          ))}
        </NavSection>
      </nav>

      {/* User footer */}
      <div className="px-2 py-2 border-t border-border/50">
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-[7px] hover:bg-muted/60 transition-colors group">
          {/* Avatar */}
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={userName}
              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
            />
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

import type { ReactNode, ElementType } from 'react'

function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
  testId,
}: {
  href: string
  label: string
  icon: ElementType
  isActive: boolean
  testId: string
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
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