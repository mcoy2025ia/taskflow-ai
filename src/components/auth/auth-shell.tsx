import { Zap, CircleCheck, Sparkles, ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'

interface AuthShellProps { eyebrow: string; title: string; description: string; children: ReactNode; footer: ReactNode }

const PREVIEW_TASKS = [
  { title: 'Definir alcance del sprint', meta: 'Hoy', color: 'bg-red-500' },
  { title: 'Validar resultados con el equipo', meta: 'Mañana', color: 'bg-amber-500' },
  { title: 'Preparar informe ejecutivo', meta: 'Vie', color: 'bg-slate-400' },
]

export function AuthShell({ eyebrow, title, description, children, footer }: AuthShellProps) {
  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden border-r border-white/10 bg-[#111827] p-10 text-white lg:flex lg:flex-col xl:p-14">
        <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-white text-[#111827]"><Zap size={17} fill="currentColor" /></div><span className="text-sm font-semibold">TaskFlow AI</span></div>
        <div className="my-auto max-w-xl py-12">
          <p className="mb-4 text-[11px] font-bold uppercase text-blue-300">Workspace inteligente</p>
          <h1 className="max-w-lg text-4xl font-semibold leading-[1.12] xl:text-5xl">Tu proyecto, claro desde el primer vistazo.</h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-slate-300">Organiza el trabajo, detecta riesgos y conversa con tus tareas desde un solo lugar.</p>

          <div className="mt-10 grid max-w-xl grid-cols-[0.9fr_1.1fr] gap-3">
            <div className="rounded-[8px] border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between"><p className="text-[10px] font-semibold text-slate-300">Progreso semanal</p><ArrowUpRight size={14} className="text-emerald-300" /></div>
              <p className="mt-6 text-3xl font-semibold">78%</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[78%] rounded-full bg-emerald-400" /></div>
              <p className="mt-3 text-[10px] text-slate-400">12 tareas completadas</p>
            </div>
            <div className="rounded-[8px] border border-white/10 bg-white/[0.06] p-3 backdrop-blur-sm">
              <div className="mb-2 flex items-center justify-between px-1"><p className="text-[10px] font-semibold text-slate-300">En progreso</p><span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] text-slate-300">3</span></div>
              <div className="space-y-1.5">{PREVIEW_TASKS.map(task => <div key={task.title} className="rounded-[7px] border border-white/10 bg-[#182235] px-3 py-2.5"><div className="flex items-start gap-2"><span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${task.color}`} /><div className="min-w-0"><p className="truncate text-[10px] font-medium text-slate-100">{task.title}</p><p className="mt-1 text-[9px] text-slate-500">{task.meta}</p></div></div></div>)}</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400"><Sparkles size={13} className="text-blue-300" /> RAG, analítica y colaboración en tiempo real.</div>
      </section>

      <section className="flex min-h-dvh items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[390px] animate-in">
          <div className="mb-8 lg:hidden"><div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-foreground text-background"><Zap size={17} fill="currentColor" /></div><span className="text-sm font-semibold">TaskFlow AI</span></div></div>
          <div className="mb-7"><p className="mb-2 text-[10px] font-bold uppercase text-primary">{eyebrow}</p><h2 className="text-2xl font-semibold sm:text-[28px]">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p></div>
          <div className="material-panel rounded-[8px] p-5 sm:p-6">{children}</div>
          <div className="mt-5 text-center">{footer}</div>
          <div className="mt-8 flex items-center justify-center gap-2 text-[10px] text-muted-foreground/70"><CircleCheck size={12} /> Acceso protegido por Supabase Auth</div>
        </div>
      </section>
    </main>
  )
}
