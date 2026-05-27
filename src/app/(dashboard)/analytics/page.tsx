'use client'

import { useState, useMemo } from 'react'
import { useAnalytics } from '@/hooks/use-analytics'
import type { TaskRow } from '@/lib/analytics/metrics'

// ─────────────────────────────────────────────────────────────
// ROLES — cada tarea se asigna al primer rol cuyo keyword
// coincida con el título (case-insensitive). El orden importa.
// ─────────────────────────────────────────────────────────────
const ROLES = [
  {
    id: 'data_eng', label: 'Ing. de Datos', desc: 'Pipelines · ETL Medallion · DW',
    hex: '#3b82f6', textCls: 'text-blue-400', bgCls: 'bg-blue-500/10', bCls: 'border-blue-500/30',
    keywords: [
      'setup', 'repositorio', 'provisionar', 'postgresql', 'mlflow', 'dvc', 'ci/cd',
      'descarga', 'dq report', 'calidad de datos', 'eda', 'etl', 'bronze', 'silver', 'gold',
      'esquema estrella', 'modelado', 'fact_orders', 'normaliz', 'geolocaliz', 'haversine',
      'kpi', 'gmv', 'churn', 'ltv',
    ],
  },
  {
    id: 'ml_eng', label: 'ML Engineer', desc: 'Modelos · Features · RAG',
    hex: '#8b5cf6', textCls: 'text-violet-400', bgCls: 'bg-violet-500/10', bCls: 'border-violet-500/30',
    keywords: [
      'rfm', 'k-means', 'dbscan', 'cohorte', 'feature engineering', 'lag feature',
      'encoding y normaliz', 'encoding', 'xgboost', 'lightgbm', 'bert', 'optuna',
      'embedding', 'voyage', 'rag', 'hnsw', 'rerank', 'sentimientos',
    ],
  },
  {
    id: 'analyst', label: 'Data Analyst', desc: 'Dashboards · Insights · Reporting',
    hex: '#10b981', textCls: 'text-emerald-400', bgCls: 'bg-emerald-500/10', bCls: 'border-emerald-500/30',
    keywords: [
      'streamlit', 'mapa coroplético', 'year-over-year', 'simulador',
      'what-if', 'chat rag', 'informe ejecutivo',
    ],
  },
  {
    id: 'backend', label: 'Backend / DevOps', desc: 'APIs · Deploy · Monitoreo',
    hex: '#f59e0b', textCls: 'text-amber-400', bgCls: 'bg-amber-500/10', bCls: 'border-amber-500/30',
    keywords: [
      'fastapi', 'redis', 'docker', 'cloud run', 'containeriz',
      'evidently', 'airflow', 'retraining', 'monitoreo', 'alertas', 'release final',
    ],
  },
  {
    id: 'qa_biz', label: 'QA / Negocio', desc: 'Pruebas · Cliente · Docs',
    hex: '#ef4444', textCls: 'text-red-400', bgCls: 'bg-red-500/10', bCls: 'border-red-500/30',
    keywords: [
      'prueba', 'integración end-to-end', 'locust', 'qa', 'validación',
      'demo', 'revisión del cliente', 'documentación', 'mkdocs', 'slides', 'aseguramiento',
    ],
  },
] as const

// ─────────────────────────────────────────────────────────────
// MACRO-FASES — 4 categorías explicitas del proyecto
// ─────────────────────────────────────────────────────────────
const MACRO_PHASES = [
  {
    id: 'data', label: 'Ingeniería de Datos',
    sub: 'Infraestructura · Ingesta · ETL Bronze/Silver/Gold · DW Star Schema · KPIs',
    hex: '#3b82f6',
    keywords: [
      'setup', 'provisionar', 'mlflow', 'dvc', 'ci/cd', 'descarga', 'dq report', 'eda',
      'etl', 'bronze', 'silver', 'gold', 'esquema', 'modelado', 'kpi', 'gmv', 'churn',
      'ltv', 'normaliz', 'geolocaliz', 'haversine',
    ],
  },
  {
    id: 'ml', label: 'Machine Learning',
    sub: 'Segmentación · Feature Engineering · XGBoost · LightGBM · BERT · RAG · Embeddings',
    hex: '#8b5cf6',
    keywords: [
      'rfm', 'dbscan', 'cohorte', 'feature', 'encoding', 'xgboost', 'lightgbm',
      'bert', 'optuna', 'embedding', 'voyage', 'rag', 'hnsw', 'sentimientos',
    ],
  },
  {
    id: 'viz', label: 'Visualización & APIs',
    sub: 'Dashboard Streamlit · FastAPI · Redis · Docker · Cloud Run Staging',
    hex: '#10b981',
    keywords: [
      'streamlit', 'fastapi', 'redis', 'docker', 'cloud run', 'containeriz',
      'mapa', 'year-over-year', 'simulador', 'what-if', 'chat rag',
    ],
  },
  {
    id: 'ops', label: 'Operaciones & Negocio',
    sub: 'Airflow · Evidently · Demo Cliente · Pruebas · QA · Docs · Release Prod',
    hex: '#f59e0b',
    keywords: [
      'evidently', 'airflow', 'informe ejecutivo', 'demo', 'revisión del cliente',
      'prueba', 'qa', 'locust', 'documentación', 'release', 'aseguramiento',
    ],
  },
] as const

// Story Points como proxy de peso: high=3, medium=2, low=1
const SP_MAP = { high: 3, medium: 2, low: 1 } as const
const sp = (t: TaskRow) => SP_MAP[t.priority] ?? 2

const roleOf = (t: TaskRow): string => {
  const l = (t.title ?? '').toLowerCase()
  return ROLES.find(r => r.keywords.some(k => l.includes(k)))?.id ?? 'data_eng'
}
const phaseOf = (t: TaskRow): string => {
  const l = (t.title ?? '').toLowerCase()
  return MACRO_PHASES.find(p => p.keywords.some(k => l.includes(k)))?.id ?? 'data'
}

// ─────────────────────────────────────────────────────────────
// SVG Burndown — línea real vs ideal con área de relleno
// ─────────────────────────────────────────────────────────────
function BurndownChart({
  data, total,
}: {
  data: { label: string; real: number; ideal: number }[]
  total: number
}) {
  if (data.length < 2 || total === 0) return (
    <p className="text-xs text-muted-foreground py-8 text-center">Sin suficientes datos de semana.</p>
  )

  const W = 520, H = 170, PL = 32, PB = 30, PT = 8, PR = 8
  const iW = W - PL - PR, iH = H - PT - PB, n = data.length
  const X = (i: number) => PL + (i / Math.max(n - 1, 1)) * iW
  const Y = (v: number) => PT + (1 - v / total) * iH

  const rPath = data.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.real).toFixed(1)}`).join('')
  const iPath = data.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.ideal).toFixed(1)}`).join('')

  const last = data[data.length - 1]
  const ok   = last.real <= last.ideal + 1
  const rc   = ok ? '#10b981' : '#ef4444'

  const ticks  = [0, Math.round(total * 0.25), Math.round(total * 0.5), Math.round(total * 0.75), total]
  const xStep  = Math.max(1, Math.floor(n / 7))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 170 }}>
      {/* Grid horizontal */}
      {ticks.map(v => (
        <g key={v}>
          <line x1={PL} y1={Y(v)} x2={W - PR} y2={Y(v)} stroke="#1e293b" strokeWidth={0.8} />
          <text x={PL - 4} y={Y(v) + 3.5} textAnchor="end" fill="#475569" fontSize={8.5}>{v}</text>
        </g>
      ))}
      {/* Etiquetas X */}
      {data.map((p, i) =>
        (i % xStep === 0 || i === n - 1)
          ? <text key={i} x={X(i)} y={H - 6} textAnchor="middle" fill="#475569" fontSize={8.5}>{p.label}</text>
          : null
      )}
      {/* Línea ideal (dashed) */}
      <path d={iPath} stroke="#334155" strokeWidth={1.5} strokeDasharray="5 3" fill="none" />
      {/* Área bajo la curva real */}
      <path
        d={`${rPath}L${X(n - 1).toFixed(1)},${Y(0).toFixed(1)}L${X(0).toFixed(1)},${Y(0).toFixed(1)}Z`}
        fill={ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'}
      />
      {/* Línea real */}
      <path d={rPath} stroke={rc} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {/* Puntos en la línea real */}
      {data.map((p, i) =>
        (i % Math.max(1, Math.floor(n / 10)) === 0 || i === n - 1)
          ? <circle key={i} cx={X(i)} cy={Y(p.real)} r={3.5} fill={rc} stroke="#0f172a" strokeWidth={1.5} />
          : null
      )}
      {/* Leyenda inline */}
      <line x1={PL} y1={H - 13} x2={PL + 16} y2={H - 13} stroke={rc} strokeWidth={2} />
      <text x={PL + 19} y={H - 10} fill={rc} fontSize={7.5}>Tareas restantes reales</text>
      <line x1={PL + 155} y1={H - 13} x2={PL + 171} y2={H - 13} stroke="#334155" strokeWidth={1.5} strokeDasharray="4 3" />
      <text x={PL + 174} y={H - 10} fill="#475569" fontSize={7.5}>Ideal (ritmo lineal)</text>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────
// Progress Ring — SVG circular con strokeDashoffset
// ─────────────────────────────────────────────────────────────
function ProgressRing({ pct }: { pct: number }) {
  const r = 50, c = 2 * Math.PI * r, offset = c - (pct / 100) * c
  const clr = pct >= 90 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444'
  return (
    <svg width={120} height={120} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={60} cy={60} r={r} strokeWidth={10} fill="none" stroke="#1e293b" />
      <circle cx={60} cy={60} r={r} strokeWidth={10} fill="none"
        stroke={clr} strokeDasharray={`${c}`} strokeDashoffset={`${offset}`}
        strokeLinecap="round" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { loading, error, tasks, project, metrics, endDate } = useAnalytics()
  const [isExporting, setIsExporting] = useState(false)

  // ── Estadísticas por rol ───────────────────────────────────
  const roleStats = useMemo(() => ROLES.map(r => {
    const mine = tasks.filter(t => roleOf(t) === r.id)
    const done = mine.filter(t => t.status === 'done')
    const spTotal = mine.reduce((a, t) => a + sp(t), 0)
    const spDone  = done.reduce((a, t) => a + sp(t), 0)
    return {
      ...r,
      total:      mine.length,
      done:       done.length,
      inProgress: mine.filter(t => t.status === 'in_progress').length,
      pct: mine.length ? Math.round(done.length / mine.length * 100) : 0,
      spTotal, spDone,
    }
  }), [tasks])

  // ── Estadísticas por macro-fase ────────────────────────────
  const phaseStats = useMemo(() => MACRO_PHASES.map(p => {
    const mine = tasks.filter(t => phaseOf(t) === p.id)
    const done = mine.filter(t => t.status === 'done')
    const spTotal = mine.reduce((a, t) => a + sp(t), 0)
    const spDone  = done.reduce((a, t) => a + sp(t), 0)
    return {
      ...p,
      total:      mine.length,
      done:       done.length,
      inProgress: mine.filter(t => t.status === 'in_progress').length,
      todo:       mine.filter(t => t.status === 'todo').length,
      pct: mine.length ? Math.round(done.length / mine.length * 100) : 0,
      spTotal, spDone,
    }
  }), [tasks])

  const totalSP = useMemo(() => tasks.reduce((a, t) => a + sp(t), 0), [tasks])

  // ── Export PDF ─────────────────────────────────────────────
  async function handleExportPDF() {
    if (!metrics || !endDate) return
    setIsExporting(true)
    try {
      const [reportRes, auditRes] = await Promise.all([
        fetch('/api/report', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ summary: {
            total: metrics.total, done: metrics.done, in_progress: metrics.inProgress,
            todo: metrics.todo, overdue: metrics.overdue, daysLeft: metrics.daysLeft,
            deliveryDate: endDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
            projectId: project?.id,
          }}),
        }),
        fetch('/api/audit', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tasks, metrics, projectName: project?.name ?? 'Proyecto' }),
        }),
      ])
      const { narrative } = await reportRes.json() as { narrative: string }
      const auditData = auditRes.ok ? await auditRes.json() as { audit?: string } : { audit: undefined }
      const { buildAnalyticsPDF } = await import('@/lib/analytics/pdf-builder')
      await buildAnalyticsPDF({
        narrative, metrics, tasks,
        projectName: project?.name ?? 'Proyecto',
        deliveryDate: endDate,
        audit: auditData.audit,
      })
    } catch (err) { console.error('[export-pdf]', err) }
    finally { setIsExporting(false) }
  }

  // ── Guards ─────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-full text-muted-foreground">Cargando analítica…</div>
  )
  if (error) return (
    <div className="flex items-center justify-center h-full text-destructive text-sm">{error}</div>
  )
  if (!metrics || !endDate) return (
    <div className="flex items-center justify-center h-full text-muted-foreground">Sin datos de proyecto.</div>
  )

  const {
    done, total, inProgress, todo, pct, daysLeft, atRisk,
    velocityActual, velocityRequired, pending, burndown, overdue,
    daysElapsed, totalDays,
  } = metrics

  // Cap a 100% — daysElapsed puede superar totalDays si el proyecto está vencido
  const timePct = totalDays > 0 ? Math.min(100, Math.round((daysElapsed / totalDays) * 100)) : 0
  const deficit = velocityRequired !== 'N/A'
    ? Math.max(0, parseFloat(velocityRequired) - parseFloat(velocityActual))
    : 0

  const dateRange = `${
    project?.start_date
      ? new Date(project.start_date + 'T00:00:00Z').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—'
  } → ${endDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}`

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate">{project?.name ?? 'Analítica del Proyecto'}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{dateRange}</p>
        </div>
        <button onClick={handleExportPDF} disabled={isExporting}
          className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors">
          {isExporting
            ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Generando…</>
            : <>&#8595; PDF + Auditoría</>}
        </button>
      </div>

      {/* ── ESTADO GENERAL ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/60 bg-muted/20 p-5">
        <div className="flex flex-wrap items-center gap-6">

          {/* Ring de progreso */}
          <div className="relative shrink-0 w-[120px] h-[120px]">
            <ProgressRing pct={pct} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className={`text-2xl font-bold ${pct >= 90 ? 'text-emerald-400' : pct >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                {pct}%
              </span>
              <span className="text-[10px] text-muted-foreground">avance</span>
            </div>
          </div>

          {/* Contadores de status */}
          <div className="flex flex-wrap gap-3">
            {[
              { v: done,       label: 'Completadas', bg: 'bg-emerald-500/10', b: 'border-emerald-500/20', t: 'text-emerald-400' },
              { v: inProgress, label: 'En progreso',  bg: 'bg-amber-500/10',  b: 'border-amber-500/20',  t: 'text-amber-400'  },
              { v: todo,       label: 'Por hacer',    bg: 'bg-slate-500/10',  b: 'border-slate-500/20',  t: 'text-slate-400'  },
              ...(overdue > 0 ? [{ v: overdue, label: 'Vencidas', bg: 'bg-red-500/10', b: 'border-red-500/20', t: 'text-red-400' }] : []),
            ].map(k => (
              <div key={k.label} className={`flex flex-col items-center px-4 py-2.5 rounded-lg ${k.bg} border ${k.b}`}>
                <span className={`text-2xl font-bold ${k.t}`}>{k.v}</span>
                <span className="text-[11px] text-muted-foreground mt-0.5">{k.label}</span>
              </div>
            ))}
          </div>

          {/* Velocidad y tiempo */}
          <div className="ml-auto flex flex-col gap-2 text-right min-w-[160px]">
            <span className={`text-xs font-bold uppercase tracking-wide ${atRisk ? 'text-red-400' : 'text-emerald-400'}`}>
              {atRisk ? '⚠ Riesgo de entrega' : '✓ Dentro del plazo'}
            </span>
            <div className="space-y-1">
              <div className="flex items-center justify-end gap-2">
                <span className="text-xs text-muted-foreground">Tiempo consumido</span>
                <span className="font-mono text-sm font-bold">{timePct}%</span>
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className="text-xs text-muted-foreground">Vel. actual</span>
                <span className="font-mono text-sm font-bold">{velocityActual} t/d</span>
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className="text-xs text-muted-foreground">Vel. requerida</span>
                <span className={`font-mono text-sm font-bold ${atRisk ? 'text-red-400' : 'text-emerald-400'}`}>
                  {velocityRequired} t/d
                </span>
              </div>
              {deficit > 0 && (
                <div className="mt-1 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
                  Déficit: {deficit.toFixed(2)} t/d
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Barra de progreso dual: tareas vs tiempo */}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-24 shrink-0">Tareas {pct}%</span>
            <div className="flex-1 h-2 rounded-full bg-black/20 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-24 shrink-0">Tiempo {timePct}%</span>
            <div className="flex-1 h-2 rounded-full bg-black/20 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${timePct > pct + 10 ? 'bg-red-500' : 'bg-indigo-500'}`}
                style={{ width: `${timePct}%` }} />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {timePct > pct + 10
              ? `⚠ El tiempo avanza más rápido que las tareas — brecha de ${timePct - pct}%`
              : `Las tareas van al mismo ritmo o adelantadas al tiempo consumido`}
          </p>
        </div>
      </div>

      {/* ── POR ROLES ───────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Distribución por Rol del Equipo
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {roleStats.map(r => {
            const projPct = totalSP > 0 ? Math.round(r.spTotal / totalSP * 100) : 0
            return (
              <div key={r.id} className={`rounded-xl border p-4 ${r.bgCls} ${r.bCls} flex flex-col gap-3`}>
                {/* Cabecera */}
                <div>
                  <p className={`text-[11px] font-bold uppercase tracking-wider ${r.textCls}`}>{r.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{r.desc}</p>
                </div>

                {/* Número grande + barra */}
                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-2xl font-bold">{r.done}</span>
                    <span className="text-xs text-muted-foreground">/ {r.total} tareas</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${r.pct}%`, backgroundColor: r.hex, transition: 'width 0.4s ease' }} />
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className={`text-sm font-bold ${r.textCls}`}>{r.pct}%</span>
                    {r.inProgress > 0 && (
                      <span className="text-[10px] text-amber-400 font-medium">
                        {r.inProgress} activa{r.inProgress > 1 ? 's' : ''}
                      </span>
                    )}
                    {r.pct === 100 && <span className="text-[10px] text-emerald-400 font-medium">✓ Completo</span>}
                  </div>
                </div>

                {/* Story Points */}
                <div className="pt-2.5 border-t border-white/10">
                  <p className="text-[10px] text-muted-foreground">
                    <span className="font-mono font-bold text-foreground">{r.spDone}/{r.spTotal}</span>
                    {' SP · '}
                    <span className={`font-semibold ${r.textCls}`}>{projPct}% del proyecto</span>
                  </p>
                  {/* Mini barra de peso relativo */}
                  <div className="h-1 rounded-full mt-1.5 overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                    <div className="h-full rounded-full opacity-60"
                      style={{ width: `${projPct}%`, backgroundColor: r.hex }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── POR FASE ────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Progreso por Fase del Proyecto
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {phaseStats.map(ph => {
            const projPct = totalSP > 0 ? Math.round(ph.spTotal / totalSP * 100) : 0
            const statusBadge =
              ph.pct === 100   ? { label: '✓ Completa',     cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' } :
              ph.inProgress > 0 ? { label: 'En ejecución',  cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' } :
              ph.todo > 0      ? { label: 'Pendiente',       cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30' } :
                                  { label: 'Sin tareas',     cls: 'bg-muted/30 text-muted-foreground border-border/40' }
            return (
              <div key={ph.id} className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                {/* Cabecera de fase */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm" style={{ color: ph.hex }}>{ph.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{ph.sub}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusBadge.cls}`}>
                    {statusBadge.label}
                  </span>
                </div>

                {/* Barra de progreso */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="flex gap-3 text-[10px] text-muted-foreground">
                      <span className="text-emerald-400 font-medium">{ph.done} listas</span>
                      {ph.inProgress > 0 && <span className="text-amber-400 font-medium">{ph.inProgress} activas</span>}
                      {ph.todo > 0       && <span className="text-slate-400 font-medium">{ph.todo} pendientes</span>}
                    </div>
                    <span className="text-sm font-bold" style={{ color: ph.hex }}>{ph.pct}%</span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                    {/* Sección done */}
                    <div className="h-full flex">
                      <div className="h-full rounded-l-full transition-all"
                        style={{ width: `${ph.pct}%`, backgroundColor: ph.hex }} />
                      {ph.inProgress > 0 && (
                        <div className="h-full"
                          style={{ width: `${Math.round(ph.inProgress / ph.total * 100)}%`, backgroundColor: '#f59e0b', opacity: 0.5 }} />
                      )}
                    </div>
                  </div>
                </div>

                {/* Métricas de peso */}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{ph.total} tareas · <b className="text-foreground">{ph.spDone}/{ph.spTotal} SP</b></span>
                  <span className="font-semibold" style={{ color: ph.hex }}>{projPct}% del peso total</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── BURNDOWN ────────────────────────────────────────────────── */}
      <section>
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
          <div className="flex items-start justify-between mb-3 gap-3">
            <div>
              <h2 className="text-sm font-semibold">Burndown — Tareas Restantes por Semana</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Línea {burndown[burndown.length - 1]?.real <= burndown[burndown.length - 1]?.ideal + 1
                  ? 'verde: el equipo va por debajo del ideal (buen ritmo)'
                  : 'roja: el equipo va por encima del ideal (ritmo insuficiente)'}
                {' · '}Pendientes: <b className="text-foreground">{pending}</b>
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs text-muted-foreground">Días restantes</p>
              <p className={`text-xl font-bold ${daysLeft === 0 ? 'text-red-400' : atRisk ? 'text-amber-400' : 'text-emerald-400'}`}>
                {daysLeft}
              </p>
            </div>
          </div>
          <BurndownChart data={burndown} total={total} />
        </div>
      </section>

      {/* ── PRIORIDAD DE PENDIENTES ──────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Tareas Pendientes por Prioridad
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              { p: 'high'   as const, label: 'Alta',  hex: '#ef4444', textCls: 'text-red-400',    bgCls: 'bg-red-500/10',    bCls: 'border-red-500/30'    },
              { p: 'medium' as const, label: 'Media', hex: '#f59e0b', textCls: 'text-amber-400',  bgCls: 'bg-amber-500/10',  bCls: 'border-amber-500/30'  },
              { p: 'low'    as const, label: 'Baja',  hex: '#64748b', textCls: 'text-slate-400',  bgCls: 'bg-slate-500/10',  bCls: 'border-slate-500/30'  },
            ]
          ).map(({ p, label, hex, textCls, bgCls, bCls }) => {
            const pend  = tasks.filter(t => t.priority === p && t.status !== 'done').length
            const ptot  = tasks.filter(t => t.priority === p).length
            const ppct  = ptot > 0 ? Math.round(pend / ptot * 100) : 0
            const pdone = ptot - pend
            return (
              <div key={p} className={`rounded-xl border p-4 ${bgCls} ${bCls}`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: hex }} />
                  <span className={`text-[11px] font-bold uppercase tracking-wide ${textCls}`}>{label}</span>
                </div>
                <p className={`text-3xl font-bold ${textCls}`}>{pend}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  pendientes de {ptot} · <span className="font-medium">{pdone} listas</span>
                </p>
                <div className="h-1.5 rounded-full mt-2.5 overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                  <div className="h-full rounded-full" style={{ width: `${ppct}%`, backgroundColor: hex }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{ppct}% sin completar</p>
              </div>
            )
          })}
        </div>
      </section>

    </div>
  )
}
