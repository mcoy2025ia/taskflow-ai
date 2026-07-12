'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download, CircleCheckBig, Clock3, TriangleAlert, Gauge, Layers3, ArrowUpRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAnalytics } from '@/hooks/use-analytics'
import { useActiveProjectSafe } from '@/contexts/active-project'
import type { TaskRow } from '@/lib/analytics/metrics'

const ROLES = [
  { id: 'data', label: 'Datos', color: '#3b82f6', keywords: ['etl', 'data', 'bronze', 'silver', 'gold', 'sql', 'pipeline'] },
  { id: 'ml', label: 'Machine Learning', color: '#8b5cf6', keywords: ['modelo', 'ml', 'embedding', 'rag', 'xgboost', 'feature'] },
  { id: 'product', label: 'Producto', color: '#10b981', keywords: ['dashboard', 'diseño', 'cliente', 'informe', 'análisis'] },
  { id: 'platform', label: 'Plataforma', color: '#f59e0b', keywords: ['api', 'docker', 'deploy', 'cloud', 'redis', 'backend'] },
  { id: 'quality', label: 'Calidad', color: '#ef4444', keywords: ['qa', 'prueba', 'test', 'documentación', 'validación'] },
] as const

const PHASES = [
  { id: 'discover', label: 'Descubrimiento', sub: 'Datos, alcance y preparación', color: '#3b82f6', keywords: ['setup', 'eda', 'datos', 'calidad', 'descarga'] },
  { id: 'build', label: 'Construcción', sub: 'Pipelines, producto y modelos', color: '#8b5cf6', keywords: ['etl', 'modelo', 'feature', 'rag', 'api', 'dashboard'] },
  { id: 'validate', label: 'Validación', sub: 'Pruebas, revisión y ajustes', color: '#f59e0b', keywords: ['test', 'prueba', 'qa', 'validación', 'revisión'] },
  { id: 'deliver', label: 'Entrega', sub: 'Despliegue, demo y documentación', color: '#10b981', keywords: ['deploy', 'cloud', 'demo', 'release', 'documentación'] },
] as const

const SP = { high: 3, medium: 2, low: 1 } as const
const storyPoints = (task: TaskRow) => SP[task.priority] ?? 2
const classify = <T extends readonly { id: string; keywords: readonly string[] }[]>(task: TaskRow, groups: T) => {
  const title = (task.title ?? '').toLowerCase()
  return groups.find(group => group.keywords.some(keyword => title.includes(keyword)))?.id ?? groups[0].id
}

export default function AnalyticsPage() {
  const searchParams = useSearchParams()
  const projectCtx = useActiveProjectSafe()
  const projectId = searchParams.get('project_id') ?? projectCtx?.activeProject?.id
  const { loading, error, tasks, project, metrics, endDate } = useAnalytics(projectId)
  const [isExporting, setIsExporting] = useState(false)

  const roleStats = useMemo(() => ROLES.map(role => {
    const grouped = tasks.filter(task => classify(task, ROLES) === role.id)
    const completed = grouped.filter(task => task.status === 'done')
    return { ...role, desc: 'Distribución de trabajo', total: grouped.length, done: completed.length, inProgress: grouped.filter(task => task.status === 'in_progress').length, pct: grouped.length ? Math.round(completed.length / grouped.length * 100) : 0, spTotal: grouped.reduce((sum, task) => sum + storyPoints(task), 0), spDone: completed.reduce((sum, task) => sum + storyPoints(task), 0) }
  }), [tasks])

  const phaseStats = useMemo(() => PHASES.map(phase => {
    const grouped = tasks.filter(task => classify(task, PHASES) === phase.id)
    const completed = grouped.filter(task => task.status === 'done')
    return { ...phase, total: grouped.length, done: completed.length, inProgress: grouped.filter(task => task.status === 'in_progress').length, todo: grouped.filter(task => task.status === 'todo').length, pct: grouped.length ? Math.round(completed.length / grouped.length * 100) : 0, spTotal: grouped.reduce((sum, task) => sum + storyPoints(task), 0), spDone: completed.reduce((sum, task) => sum + storyPoints(task), 0) }
  }), [tasks])

  if (loading) return <AnalyticsLoading />
  if (error) return <div className="flex h-full items-center justify-center p-8 text-sm text-destructive">{error}</div>
  if (!metrics || !endDate) return <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">Sin datos de proyecto.</div>

  const { done, total, inProgress, todo, pct, daysLeft, atRisk, velocityActual, velocityRequired, velocityWeekly, pending, burndown, overdue, daysElapsed, totalDays } = metrics
  const timePct = totalDays > 0 ? Math.min(100, Math.round(daysElapsed / totalDays * 100)) : 0
  const totalSP = tasks.reduce((sum, task) => sum + storyPoints(task), 0)
  const dateRange = `${project?.start_date ? new Date(`${project.start_date}T00:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin inicio'} - ${endDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}`

  async function handleExportHTML() {
    setIsExporting(true)
    try {
      const [reportRes, auditRes] = await Promise.all([
        fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ summary: { total, done, in_progress: inProgress, todo, overdue, daysLeft, deliveryDate: endDate!.toLocaleDateString('es-CO'), projectId: project?.id } }) }),
        fetch('/api/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tasks, metrics, projectName: project?.name ?? 'Proyecto' }) }),
      ])
      const report = reportRes.ok ? await reportRes.json() as { narrative?: string } : {}
      const audit = auditRes.ok ? await auditRes.json() as { audit?: string } : {}
      const priorityStats = (['high', 'medium', 'low'] as const).map(key => {
        const grouped = tasks.filter(task => task.priority === key)
        const pendingCount = grouped.filter(task => task.status !== 'done').length
        return { key, label: key === 'high' ? 'Alta' : key === 'medium' ? 'Media' : 'Baja', hex: key === 'high' ? '#ef4444' : key === 'medium' ? '#f59e0b' : '#94a3b8', bg: '', border: '', total: grouped.length, pending: pendingCount, done: grouped.length - pendingCount }
      })
      const { buildAnalyticsHTML } = await import('@/lib/analytics/html-builder')
      const html = buildAnalyticsHTML({ projectName: project?.name ?? 'Proyecto', dateRange, narrative: report.narrative ?? '', audit: audit.audit, pct, done, total, inProgress, todo, overdue, daysLeft, timePct, atRisk, pending, velocityActual, velocityRequired, velocityWeekly, burndown, roleStats: roleStats.map(role => ({ label: role.label, desc: role.desc, hex: role.color, done: role.done, total: role.total, pct: role.pct, inProgress: role.inProgress, spDone: role.spDone, spTotal: role.spTotal })), phaseStats: phaseStats.map(phase => ({ label: phase.label, sub: phase.sub, hex: phase.color, done: phase.done, total: phase.total, pct: phase.pct, inProgress: phase.inProgress, todo: phase.todo, spDone: phase.spDone, spTotal: phase.spTotal })), totalSP, spDoneTotal: roleStats.reduce((sum, role) => sum + role.spDone, 0), priorityStats })
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${(project?.name ?? 'informe').replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
      document.body.appendChild(anchor); anchor.click(); document.body.removeChild(anchor); URL.revokeObjectURL(url)
    } catch (exportError) { console.error('[export-html]', exportError) }
    finally { setIsExporting(false) }
  }

  const metricCards = [
    { label: 'Completadas', value: `${done}`, detail: `${pct}% del total`, icon: CircleCheckBig, tone: 'text-emerald-600 bg-emerald-500/10' },
    { label: 'En progreso', value: `${inProgress}`, detail: `${todo} por iniciar`, icon: Clock3, tone: 'text-amber-600 bg-amber-500/10' },
    { label: 'Velocidad', value: `${velocityWeekly}`, detail: 'tareas por semana', icon: Gauge, tone: 'text-primary bg-primary/10' },
    { label: 'Vencidas', value: `${overdue}`, detail: overdue ? 'requieren atención' : 'todo bajo control', icon: TriangleAlert, tone: overdue ? 'text-red-600 bg-red-500/10' : 'text-slate-500 bg-slate-500/10' },
  ]

  return (
    <main className="page-enter mx-auto max-w-7xl space-y-6 p-4 pb-12 sm:p-6 xl:p-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase text-primary">Pulso del proyecto</p>
          <h1 className="text-2xl font-semibold sm:text-[28px]">{project?.name ?? 'Analítica del proyecto'}</h1>
          <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">{dateRange}</p>
        </div>
        <Button onClick={handleExportHTML} disabled={isExporting} className="h-9 gap-2 rounded-[8px] px-3 text-xs shadow-sm">
          {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}{isExporting ? 'Preparando informe...' : 'Exportar informe'}
        </Button>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metricCards.map(({ label, value, detail, icon: Icon, tone }) => (
          <div key={label} className="material-panel interactive-card rounded-[8px] p-4 sm:p-5">
            <div className="mb-5 flex items-center justify-between"><p className="text-[11px] font-semibold text-muted-foreground">{label}</p><span className={cn('flex h-8 w-8 items-center justify-center rounded-[7px]', tone)}><Icon size={15} /></span></div>
            <p className="text-2xl font-semibold tabular-nums sm:text-3xl">{value}</p><p className="mt-1 text-[10px] text-muted-foreground sm:text-[11px]">{detail}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="material-panel rounded-[8px] p-4 sm:p-5">
          <div className="mb-5 flex items-center justify-between"><div><p className="text-sm font-semibold">Trayectoria de entrega</p><p className="mt-1 text-[11px] text-muted-foreground">Trabajo restante frente al ideal</p></div><span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold', atRisk ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-600')}>{atRisk ? 'En riesgo' : 'En ritmo'}</span></div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%"><AreaChart data={burndown} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}><defs><linearGradient id="remainingArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.24} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.18)" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 10 }} /><Tooltip contentStyle={{ borderRadius: 8, border: '1px solid rgba(148,163,184,.25)', boxShadow: '0 10px 30px rgba(15,23,42,.12)', fontSize: 11 }} /><Area type="monotone" dataKey="ideal" name="Ideal" stroke="#94a3b8" strokeDasharray="5 5" fill="none" strokeWidth={1.5} /><Area type="monotone" dataKey="real" name="Restantes" stroke="#3b82f6" fill="url(#remainingArea)" strokeWidth={2.5} /></AreaChart></ResponsiveContainer>
          </div>
        </div>

        <div className="material-panel rounded-[8px] p-4 sm:p-5">
          <div className="mb-6 flex items-center gap-2"><Layers3 size={16} className="text-primary" /><p className="text-sm font-semibold">Progreso global</p></div>
          <div className="mx-auto mb-7 flex h-36 w-36 items-center justify-center rounded-full" style={{ background: `conic-gradient(var(--primary) ${pct}%, var(--muted) 0)` }}><div className="flex h-[112px] w-[112px] flex-col items-center justify-center rounded-full bg-card"><span className="text-3xl font-semibold tabular-nums">{pct}%</span><span className="mt-1 text-[10px] text-muted-foreground">completado</span></div></div>
          <ProgressRow label="Trabajo" value={pct} color="bg-primary" />
          <ProgressRow label="Tiempo" value={timePct} color={timePct > pct + 10 ? 'bg-red-500' : 'bg-emerald-500'} />
          <div className="mt-5 grid grid-cols-2 gap-2 border-t border-border/60 pt-4"><div><p className="text-[10px] text-muted-foreground">Días restantes</p><p className="mt-1 text-lg font-semibold tabular-nums">{daysLeft}</p></div><div><p className="text-[10px] text-muted-foreground">Pendientes</p><p className="mt-1 text-lg font-semibold tabular-nums">{pending}</p></div></div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between"><div><p className="text-sm font-semibold">Avance por fase</p><p className="mt-1 text-[11px] text-muted-foreground">Dónde está concentrado el trabajo</p></div><p className="hidden text-[10px] text-muted-foreground sm:block">{totalSP} puntos estimados</p></div>
        <div className="overflow-hidden rounded-[8px] border border-border/70 bg-card shadow-sm">
          {phaseStats.map((phase, index) => (
            <div key={phase.id} className={cn('grid gap-3 px-4 py-4 sm:grid-cols-[1.2fr_1fr_90px] sm:items-center sm:px-5', index > 0 && 'border-t border-border/60')}>
              <div className="flex min-w-0 items-center gap-3"><span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: phase.color }} /><div className="min-w-0"><p className="truncate text-xs font-semibold sm:text-[13px]">{phase.label}</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{phase.sub}</p></div></div>
              <div className="flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${phase.pct}%`, backgroundColor: phase.color }} /></div><span className="w-8 text-right text-[10px] font-semibold tabular-nums">{phase.pct}%</span></div>
              <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground"><span className="font-semibold text-foreground">{phase.done}</span> / {phase.total}<ArrowUpRight size={12} /></div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {(['high', 'medium', 'low'] as const).map(priority => {
          const grouped = tasks.filter(task => task.priority === priority)
          const open = grouped.filter(task => task.status !== 'done').length
          const config = priority === 'high' ? { label: 'Alta', color: 'text-red-600', bg: 'bg-red-500' } : priority === 'medium' ? { label: 'Media', color: 'text-amber-600', bg: 'bg-amber-500' } : { label: 'Baja', color: 'text-slate-500', bg: 'bg-slate-400' }
          return <div key={priority} className="material-panel rounded-[8px] p-4"><div className="flex items-center justify-between"><p className={cn('text-[10px] font-bold uppercase', config.color)}>Prioridad {config.label}</p><span className={cn('h-2 w-2 rounded-full', config.bg)} /></div><div className="mt-4 flex items-baseline gap-2"><span className="text-2xl font-semibold tabular-nums">{open}</span><span className="text-[10px] text-muted-foreground">pendientes de {grouped.length}</span></div></div>
        })}
      </section>
    </main>
  )
}

function ProgressRow({ label, value, color }: { label: string; value: number; color: string }) {
  return <div className="mb-3"><div className="mb-1.5 flex justify-between text-[10px]"><span className="text-muted-foreground">{label}</span><span className="font-semibold tabular-nums">{value}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full transition-[width] duration-700', color)} style={{ width: `${value}%` }} /></div></div>
}

function AnalyticsLoading() {
  return <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 xl:p-8"><div className="skeleton-shimmer h-16 w-72 rounded-[8px]" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map(item => <div key={item} className="skeleton-shimmer h-32 rounded-[8px]" />)}</div><div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]"><div className="skeleton-shimmer h-80 rounded-[8px]" /><div className="skeleton-shimmer h-80 rounded-[8px]" /></div></div>
}
