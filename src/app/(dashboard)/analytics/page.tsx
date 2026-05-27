'use client'

import { useState } from 'react'
import { useAnalytics } from '@/hooks/use-analytics'

export default function AnalyticsPage() {
  const { loading, error, tasks, project, metrics, endDate } = useAnalytics()
  const [isExporting, setIsExporting] = useState(false)

  if (loading) return (
    <div className="flex items-center justify-center h-full text-muted-foreground">Cargando analítica…</div>
  )

  if (error) return (
    <div className="flex items-center justify-center h-full text-destructive text-sm">{error}</div>
  )

  if (!metrics || !endDate) return (
    <div className="flex items-center justify-center h-full text-muted-foreground">Sin datos de proyecto.</div>
  )

  const { done, total, inProgress, todo, pct, daysLeft, atRisk,
    velocityActual, velocityRequired, pending, phaseReal, burndown, overdue } = metrics
  const maxBurndown = total

  async function handleExportPDF() {
    if (!metrics || !endDate) return
    setIsExporting(true)
    try {
      // Llamar informe ejecutivo y auditoría de arquitectura en paralelo
      const [reportRes, auditRes] = await Promise.all([
        fetch('/api/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summary: {
              total, done, in_progress: inProgress, todo, overdue, daysLeft,
              deliveryDate: endDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
              projectId: project?.id,
            },
          }),
        }),
        fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tasks,
            metrics,
            projectName: project?.name ?? 'Proyecto',
          }),
        }),
      ])

      const { narrative } = await reportRes.json() as { narrative: string }
      const auditData = auditRes.ok
        ? await auditRes.json() as { audit?: string }
        : { audit: undefined }

      const { buildAnalyticsPDF } = await import('@/lib/analytics/pdf-builder')
      await buildAnalyticsPDF({
        narrative,
        metrics,
        tasks,
        projectName: project?.name ?? 'Proyecto',
        deliveryDate: endDate,
        audit: auditData.audit,
      })
    } catch (err) { console.error('[export-pdf]', err) }
    finally { setIsExporting(false) }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold">Analítica del Proyecto</h1>
          <p className="text-muted-foreground text-sm mt-1 line-clamp-2 sm:line-clamp-1">
            <span className="font-medium">{project?.name ?? 'Proyecto'}</span>
            {' · '}Entrega: {endDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}{daysLeft} días restantes
          </p>
        </div>
        <button onClick={handleExportPDF} disabled={isExporting}
          className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors">
          {isExporting ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block"/>Generando…</> : 'Exportar PDF'}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Completadas',    value: `${done}/${total}`, sub: `${pct}%`,                color: 'text-emerald-500' },
          { label: 'En Progreso',    value: inProgress,         sub: 'tareas activas',         color: 'text-amber-500' },
          { label: 'Por Hacer',      value: todo,               sub: 'en backlog',              color: 'text-slate-400' },
          { label: 'Días Restantes', value: daysLeft,           sub: atRisk ? '⚠ Riesgo' : '✓ En tiempo', color: atRisk ? 'text-red-500' : 'text-emerald-500' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-border/60 bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{k.label}</p>
            <p className={`text-3xl font-bold mt-1 ${k.color}`}>{k.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Velocidad */}
      <div className={`rounded-xl border p-4 ${atRisk ? 'border-red-500/40 bg-red-500/5' : 'border-emerald-500/40 bg-emerald-500/5'}`}>
        <p className="text-sm font-medium mb-2">Análisis de Velocidad</p>
        <div className="flex flex-wrap gap-6">
          <div><p className="text-xs text-muted-foreground">Velocidad actual</p><p className="text-xl font-bold">{velocityActual} <span className="text-xs font-normal">tareas/día</span></p></div>
          <div><p className="text-xs text-muted-foreground">Velocidad requerida</p><p className={`text-xl font-bold ${atRisk ? 'text-red-500' : 'text-emerald-500'}`}>{velocityRequired} <span className="text-xs font-normal">tareas/día</span></p></div>
          <div><p className="text-xs text-muted-foreground">Tareas pendientes</p><p className="text-xl font-bold">{pending}</p></div>
        </div>
        {atRisk && <p className="text-xs text-red-400 mt-2">⚠ La velocidad requerida supera la actual. Se necesita acelerar la ejecución o renegociar el alcance.</p>}
      </div>

      {/* Burndown */}
      <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
        <p className="text-sm font-medium mb-4">Burndown Chart — Tareas Restantes por Semana</p>
        <div className="overflow-x-auto">
          <div className="flex items-end gap-2 h-40" style={{ minWidth: `${Math.max(burndown.length * 44, 280)}px` }}>
            {burndown.map((w, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-[36px]">
                <div className="w-full bg-primary/70 rounded-t" style={{ height: `${(w.real / maxBurndown) * 130}px` }} title={`Real S${i+1}: ${w.real}`}/>
                <div className="w-1 rounded-full bg-muted-foreground/30" style={{ height: `${(w.ideal / maxBurndown) * 130}px`, marginTop: `-${(w.real / maxBurndown) * 130}px` }}/>
                <p className="text-xs text-muted-foreground">{w.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-4 mt-2">
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><span className="w-3 h-2 rounded bg-primary/70 inline-block"/>Real</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><span className="w-3 h-2 rounded bg-muted-foreground/30 inline-block"/>Ideal</span>
        </div>
      </div>

      {/* Fases */}
      <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
        <p className="text-sm font-medium mb-4">Progreso por Fase del Pipeline</p>
        <div className="space-y-3">
          {phaseReal.map(ph => (
            <div key={ph.name}>
              <div className="flex justify-between text-xs mb-1"><span className="font-medium">{ph.name}</span><span className="text-muted-foreground">{ph.done}/{ph.total} · {ph.pct}%</span></div>
              <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full" style={{ width: `${ph.pct}%`, backgroundColor: ph.color }}/></div>
            </div>
          ))}
        </div>
      </div>

      {/* Prioridad */}
      <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
        <p className="text-sm font-medium mb-4">Tareas Pendientes por Prioridad</p>
        <div className="flex gap-4">
          {(['high', 'medium', 'low'] as const).map(p => {
            const count = tasks.filter(t => t.priority === p && t.status !== 'done').length
            const colors = { high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-slate-400' }
            const labels = { high: 'Alta', medium: 'Media', low: 'Baja' }
            return (
              <div key={p} className="flex-1 rounded-lg bg-muted/50 p-3 text-center">
                <div className={`w-3 h-3 rounded-full ${colors[p]} mx-auto mb-1`}/>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{labels[p]}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
