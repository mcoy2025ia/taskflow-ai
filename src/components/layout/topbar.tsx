'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

const PAGE_META: Record<string, { title: string; sub: string }> = {
  '/board': {
    title: 'Mi tablero',
    sub:   'Organiza tus tareas con drag & drop',
  },
  '/chat': {
    title: 'Asistente IA',
    sub:   'Busca y analiza tareas con lenguaje natural',
  },
  '/settings': {
    title: 'Preferencias',
    sub:   'Configura tu experiencia',
  },
  '/settings/ai': {
    title: 'Modelos IA',
    sub:   'Groq · Ollama · Voyage',
  },
}

export function Topbar() {
  const pathname = usePathname()
  // Read synchronously during init — the inline script in layout.tsx already
  // applied the class before first paint, so this matches without a useEffect.
  const [isDark, setIsDark] = useState(() =>
    typeof window !== 'undefined'
      ? document.documentElement.classList.contains('dark')
      : false
  )

  const meta = PAGE_META[pathname] ?? { title: 'TaskFlow AI', sub: '' }

  function toggleTheme() {
    const html = document.documentElement
    const nowDark = html.classList.toggle('dark')
    setIsDark(nowDark)
    localStorage.setItem('theme', nowDark ? 'dark' : 'light')
  }

  return (
    <header className="h-[52px] flex items-center justify-between px-5 bg-background border-b border-border/50 flex-shrink-0">
      <div>
        <h1 className="text-[15px] font-semibold tracking-tight leading-none">
          {meta.title}
        </h1>
        {meta.sub && (
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">
            {meta.sub}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          onClick={toggleTheme}
          title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </Button>
      </div>
    </header>
  )
}