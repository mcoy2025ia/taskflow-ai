'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TaskRow {
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  due_date: string | null
  created_at: string
}


const WEEKS = [
  { label: 'S1', end: '2025-03-07' },
  { label: 'S2', end: '2025-03-14' },
  { label: 'S3', end: '2025-03-21' },
  { label: 'S4', end: '2025-03-28' },
  { label: 'S5', end: '2025-04-04' },
  { label: 'S6', end: '2025-04-11' },
  { label: 'S7', end: '2025-04-18' },
  { label: 'S8', end: '2025-04-25' },
  { label: 'S9', end: '2025-05-02' },
  { label: 'S10', end: '2025-05-12' },
]

export default function AnalyticsPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const dashboardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('tasks')
      .select('status, priority, due_date, created_at')
      .then(({ data }) => {
        setTasks((data as TaskRow[]) ?? [])
        setLoading(false)
      })
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      Cargando analítica…
    </div>
  )

  const total = tasks.length
  const done = tasks.filter(t => t.status === 'done').length
  const inProgress = tasks.filter(t => t.status === 'in_progress').length
  const todo = tasks.filter(t => t.status === 'todo').length
  const pct = Math.round(done / total * 100)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const delivery = new Date('2025-05-12')
  delivery.setHours(0, 0, 0, 0)
  const daysLeft = Math.max(0, Math.ceil((delivery.getTime() - today.getTime()) / 86400000))
  const pending = inProgress + todo
  const velocityRequired = daysLeft > 0 ? (pending / daysLeft).toFixed(1) : 'N/A'
  const projectStartDate = new Date('2025-02-27')
  projectStartDate.setHours(0, 0, 0, 0)
  const daysElapsed = Math.ceil((today.getTime() - projectStartDate.getTime()) / 86400000)
  const velocityActual = daysElapsed > 0 ? (done / daysElapsed).toFixed(1) : '0'
  const atRisk = daysLeft > 0 && parseFloat(velocityRequired) > parseFloat(velocityActual)

  // Burndown
  const burndown = WEEKS.map(w => {
    const endDate = new Date(w.end)
    const completedByWeek = tasks.filter(t =>
      t.status === 'done' &&
      t.due_date &&
      new Date(t.due_date) <= endDate
    ).length
    const ideal = Math.round(total - (total / WEEKS.length) * (WEEKS.indexOf(w) + 1))
    return { label: w.label, real: total - completedByWeek, ideal: Math.max(0, ideal) }
  })

  // Distribución real por estado
  const phaseReal = [
    { name: 'Bronze (6)', total: 6, done: 6, pct: 100, color: '#cd7f32' },
    { name: 'Silver (6)', total: 6, done: 6, pct: 100, color: '#94a3b8' },
    { name: 'Gold (3)', total: 3, done: 0, pct: 0, color: '#f59e0b' },
    { name: 'Feature Eng. (4)', total: 4, done: 0, pct: 0, color: '#8b5cf6' },
    { name: 'ML (2+3)', total: 5, done: 0, pct: 0, color: '#3b82f6' },
    { name: 'Dashboard (3)', total: 3, done: 0, pct: 0, color: '#10b981' },
    { name: 'Informe (2)', total: 2, done: 0, pct: 0, color: '#ef4444' },
  ]

  const maxBurndown = total
  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < today && t.status !== 'done').length

  async function handleExportPDF() {
    if (!dashboardRef.current) return
    setIsExporting(true)
    try {
      // 1. Narrativa ejecutiva via LLM
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: { total, done, in_progress: inProgress, todo, overdue, daysLeft, deliveryDate: '12 de mayo de 2025' },
        }),
      })
      const { narrative } = await res.json()

      // 2. Construir PDF completamente en jsPDF (sin html2canvas — incompatible con oklch de Tailwind v4)
      const { default: jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const margin = 20
      const contentW = pageW - margin * 2

      // ── Portada ──────────────────────────────────────────────────────────────
      doc.setFillColor(79, 70, 229)
      doc.rect(0, 0, pageW, 55, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(22)
      doc.text('TaskFlow AI', margin, 28)
      doc.setFontSize(13)
      doc.setFont('helvetica', 'normal')
      doc.text('Informe Ejecutivo del Proyecto', margin, 39)
      doc.setFontSize(9)
      doc.text(
        new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
        margin, 50
      )

      // ── KPIs ─────────────────────────────────────────────────────────────────
      doc.setTextColor(30, 30, 30)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('Métricas clave', margin, 70)

      const kpiData = [
        { label: 'Completadas', value: `${done}/${total}`, sub: `${pct}%`, color: [16, 185, 129] as [number,number,number] },
        { label: 'En progreso', value: String(inProgress), sub: 'activas', color: [245, 158, 11] as [number,number,number] },
        { label: 'Por hacer',   value: String(todo),       sub: 'backlog', color: [100, 116, 139] as [number,number,number] },
        { label: 'Días restantes', value: String(daysLeft), sub: atRisk ? '⚠ Riesgo' : '✓ En tiempo', color: atRisk ? [239,68,68] as [number,number,number] : [16,185,129] as [number,number,number] },
      ]
      const kpiW = contentW / 4
      kpiData.forEach((k, i) => {
        const x = margin + i * kpiW
        doc.setFillColor(248, 250, 252)
        doc.roundedRect(x, 76, kpiW - 3, 22, 2, 2, 'F')
        doc.setFontSize(7)
        doc.setTextColor(100, 116, 139)
        doc.text(k.label.toUpperCase(), x + 3, 81)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(14)
        doc.setTextColor(...k.color)
        doc.text(k.value, x + 3, 90)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(100, 116, 139)
        doc.text(k.sub, x + 3, 95)
      })

      // ── Velocidad ────────────────────────────────────────────────────────────
      doc.setTextColor(30, 30, 30)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('Velocidad de ejecución', margin, 110)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(100, 116, 139)
      doc.text(
        `Actual: ${velocityActual} tareas/día   ·   Requerida: ${velocityRequired} tareas/día   ·   Pendientes: ${pending}   ·   Riesgo: ${atRisk ? 'SÍ' : 'NO'}`,
        margin, 117
      )

      // ── Narrativa ────────────────────────────────────────────────────────────
      doc.setTextColor(30, 30, 30)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('Análisis ejecutivo', margin, 130)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(50, 50, 50)
      const narrativeLines = doc.splitTextToSize(narrative, contentW)
      doc.text(narrativeLines, margin, 138)

      // ── Página 2: Progreso por fase ──────────────────────────────────────────
      doc.addPage()
      doc.setFillColor(79, 70, 229)
      doc.rect(0, 0, pageW, 18, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('Progreso por Fase del Pipeline', margin, 12)

      doc.setTextColor(30, 30, 30)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('Fases', margin, 30)

      const phaseColors: Record<string, [number,number,number]> = {
        'Bronze (6)':       [205, 127, 50],
        'Silver (6)':       [148, 163, 184],
        'Gold (3)':         [245, 158, 11],
        'Feature Eng. (4)': [139, 92, 246],
        'ML (2+3)':         [59, 130, 246],
        'Dashboard (3)':    [16, 185, 129],
        'Informe (2)':      [239, 68, 68],
      }

      phaseReal.forEach((phase, i) => {
        const y = 36 + i * 14
        const barW = contentW - 40
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(50, 50, 50)
        doc.text(phase.name, margin, y + 4)
        doc.setFillColor(241, 245, 249)
        doc.roundedRect(margin + 40, y, barW, 5, 1, 1, 'F')
        const fill = (phase.pct / 100) * barW
        if (fill > 0) {
          const c = phaseColors[phase.name] ?? [99, 102, 241]
          doc.setFillColor(...c)
          doc.roundedRect(margin + 40, y, fill, 5, 1, 1, 'F')
        }
        doc.setFontSize(7)
        doc.setTextColor(100, 116, 139)
        doc.text(`${phase.done}/${phase.total} · ${phase.pct}%`, margin + 40 + barW + 2, y + 4)
      })

      // ── Prioridad ────────────────────────────────────────────────────────────
      let py = 36 + phaseReal.length * 14 + 12
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(30, 30, 30)
      doc.text('Tareas Pendientes por Prioridad', margin, py)
      py += 8

      const priData = [
        { label: 'Alta',  count: tasks.filter(t => t.priority === 'high'   && t.status !== 'done').length, color: [239,68,68]   as [number,number,number] },
        { label: 'Media', count: tasks.filter(t => t.priority === 'medium' && t.status !== 'done').length, color: [245,158,11]  as [number,number,number] },
        { label: 'Baja',  count: tasks.filter(t => t.priority === 'low'    && t.status !== 'done').length, color: [100,116,139] as [number,number,number] },
      ]
      const boxW = contentW / 3
      priData.forEach((p, i) => {
        const x = margin + i * boxW
        doc.setFillColor(248, 250, 252)
        doc.roundedRect(x, py, boxW - 4, 20, 2, 2, 'F')
        doc.setFillColor(...p.color)
        doc.circle(x + 5, py + 5, 2, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(16)
        doc.setTextColor(...p.color)
        doc.text(String(p.count), x + 5, py + 15)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(100, 116, 139)
        doc.text(p.label, x + 14, py + 15)
      })

      doc.save(`taskflow-informe-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (err) {
      console.error('[export-pdf]', err)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div ref={dashboardRef} className="p-6 space-y-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analítica del Proyecto</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Pipeline Olist · Entrega: 12 de mayo de 2025 · {daysLeft} días restantes
          </p>
        </div>
        <button
          onClick={handleExportPDF}
          disabled={isExporting}
          className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          {isExporting ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />
              Generando…
            </>
          ) : (
            'Exportar PDF'
          )}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Completadas', value: `${done}/${total}`, sub: `${pct}%`, color: 'text-emerald-500' },
          { label: 'En Progreso', value: inProgress, sub: 'tareas activas', color: 'text-amber-500' },
          { label: 'Por Hacer', value: todo, sub: 'en backlog', color: 'text-slate-400' },
          { label: 'Días Restantes', value: daysLeft, sub: atRisk ? '⚠ Riesgo de entrega' : '✓ En tiempo', color: atRisk ? 'text-red-500' : 'text-emerald-500' },
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
        <p className="text-sm font-medium">Análisis de Velocidad</p>
        <div className="flex gap-8 mt-2">
          <div>
            <p className="text-xs text-muted-foreground">Velocidad actual</p>
            <p className="text-xl font-bold">{velocityActual} <span className="text-xs font-normal">tareas/día</span></p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Velocidad requerida</p>
            <p className={`text-xl font-bold ${atRisk ? 'text-red-500' : 'text-emerald-500'}`}>
              {velocityRequired} <span className="text-xs font-normal">tareas/día</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tareas pendientes</p>
            <p className="text-xl font-bold">{pending}</p>
          </div>
        </div>
        {atRisk && (
          <p className="text-xs text-red-400 mt-2">
            ⚠ La velocidad requerida supera la actual. Se necesita acelerar la ejecución o renegociar el alcance.
          </p>
        )}
      </div>

      {/* Burndown */}
      <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
        <p className="text-sm font-medium mb-4">Burndown Chart — Tareas Restantes por Semana</p>
        <div className="flex items-end gap-2 h-40">
          {burndown.map((w, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col items-center gap-0.5">
                <div
                  className="w-full bg-primary/70 rounded-t transition-all"
                  style={{ height: `${(w.real / maxBurndown) * 130}px` }}
                  title={`Real S${i + 1}: ${w.real} tareas`}
                />
              </div>
              <div
                className="w-1 rounded-full bg-muted-foreground/30"
                style={{ height: `${(w.ideal / maxBurndown) * 130}px`, marginTop: `-${(w.real / maxBurndown) * 130}px` }}
              />
              <p className="text-xs text-muted-foreground">{w.label}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-2">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="w-3 h-2 rounded bg-primary/70 inline-block"/> Real
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="w-3 h-2 rounded bg-muted-foreground/30 inline-block"/> Ideal
          </span>
        </div>
      </div>

      {/* Progreso por fase */}
      <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
        <p className="text-sm font-medium mb-4">Progreso por Fase del Pipeline</p>
        <div className="space-y-3">
          {phaseReal.map(phase => (
            <div key={phase.name}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium">{phase.name}</span>
                <span className="text-muted-foreground">{phase.done}/{phase.total} · {phase.pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${phase.pct}%`, backgroundColor: phase.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Distribución por prioridad */}
      <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
        <p className="text-sm font-medium mb-4">Tareas Pendientes por Prioridad</p>
        <div className="flex gap-4">
          {(['high', 'medium', 'low'] as const).map(p => {
            const count = tasks.filter(t => t.priority === p && t.status !== 'done').length
            const colors = { high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-slate-400' }
            const labels = { high: 'Alta', medium: 'Media', low: 'Baja' }
            return (
              <div key={p} className="flex-1 rounded-lg bg-muted/50 p-3 text-center">
                <div className={`w-3 h-3 rounded-full ${colors[p]} mx-auto mb-1`} />
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
