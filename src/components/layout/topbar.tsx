'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Moon, Sun, Menu, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

const PAGE_META: Record<string, { eyebrow: string; title: string }> = {
  '/board': { eyebrow: 'Workspace', title: 'Tablero' },
  '/chat': { eyebrow: 'Inteligencia', title: 'Asistente' },
  '/analytics': { eyebrow: 'Rendimiento', title: 'Analítica' },
}

interface TopbarProps { onMenuToggle?: () => void }

export function Topbar({ onMenuToggle }: TopbarProps) {
  const pathname = usePathname()
  const [isDark, setIsDark] = useState(() =>
    typeof window !== 'undefined' ? document.documentElement.classList.contains('dark') : false
  )
  const basePath = `/${pathname.split('/').filter(Boolean)[0] ?? ''}`
  const meta = PAGE_META[basePath] ?? { eyebrow: 'TaskFlow', title: 'Workspace' }

  function toggleTheme() {
    const nowDark = document.documentElement.classList.toggle('dark')
    setIsDark(nowDark)
    localStorage.setItem('theme', nowDark ? 'dark' : 'light')
  }

  return (
    <header className="z-20 flex h-16 flex-shrink-0 items-center justify-between border-b border-border/70 bg-background/80 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-[8px] text-muted-foreground md:hidden"
          onClick={onMenuToggle}
          title="Abrir menú"
        >
          <Menu size={18} />
        </Button>
        <div className="min-w-0">
          <p className="hidden text-[10px] font-semibold uppercase text-muted-foreground sm:block">
            {meta.eyebrow}
          </p>
          <h1 className="truncate text-sm font-semibold leading-tight text-foreground sm:text-[15px]">
            {meta.title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]" />
          Sincronizado
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-[8px] border border-transparent text-muted-foreground hover:border-border/70 hover:bg-card hover:text-foreground"
          onClick={toggleTheme}
          title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          suppressHydrationWarning
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </Button>
        <div className="hidden h-9 items-center gap-2 rounded-[8px] bg-foreground px-3 text-xs font-semibold text-background shadow-sm lg:flex">
          <Sparkles size={14} />
          TaskFlow AI
        </div>
      </div>
    </header>
  )
}
