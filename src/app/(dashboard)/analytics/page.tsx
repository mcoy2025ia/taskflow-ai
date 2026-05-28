'use client'

import { useState, useMemo } from 'react'
import { useAnalytics } from '@/hooks/use-analytics'
import type { TaskRow } from '@/lib/analytics/metrics'

// ─────────────────────────────────────────────────────────────
// Design tokens (dark premium)
// ─────────────────────────────────────────────────────────────
const T = {
  bg:       '#06080f',
  bg2:      '#0b0e1a',
  surface:  '#131729',
  surface2: '#1a1f38',
  border:   'rgba(255,255,255,0.07)',
  border2:  'rgba(255,255,255,0.12)',
  blue:     '#1d70e8',
  blueLt:   '#4d9bff',
  text:     'rgba(240,244,255,0.88)',
  textDim:  'rgba(240,244,255,0.45)',
  textMute: 'rgba(240,244,255,0.28)',
  green:    '#22c55e',
  greenLt:  '#4ade80',
  amber:    '#f59e0b',
  amberLt:  '#fbbf24',
  red:      '#ef4444',
  redLt:    '#f87171',
  mono:     "'DM Mono', 'SF Mono', ui-monospace, monospace",
  font:     "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
} as const

// ─────────────────────────────────────────────────────────────
// ROLES
// ─────────────────────────────────────────────────────────────
const ROLES = [
  {
    id: 'data_eng', label: 'Ing. de Datos', desc: 'Pipelines · ETL Medallion · DW',
    hex: '#3b82f6',
    keywords: [
      'setup', 'repositorio', 'provisionar', 'postgresql', 'mlflow', 'dvc', 'ci/cd',
      'descarga', 'dq report', 'calidad de datos', 'eda', 'etl', 'bronze', 'silver', 'gold',
      'esquema estrella', 'modelado', 'fact_orders', 'normaliz', 'geolocaliz', 'haversine',
      'kpi', 'gmv', 'churn', 'ltv',
    ],
  },
  {
    id: 'ml_eng', label: 'ML Engineer', desc: 'Modelos · Features · RAG',
    hex: '#8b5cf6',
    keywords: [
      'rfm', 'k-means', 'dbscan', 'cohorte', 'feature engineering', 'lag feature',
      'encoding y normaliz', 'encoding', 'xgboost', 'lightgbm', 'bert', 'optuna',
      'embedding', 'voyage', 'rag', 'hnsw', 'rerank', 'sentimientos',
    ],
  },
  {
    id: 'analyst', label: 'Data Analyst', desc: 'Dashboards · Insights · Reporting',
    hex: '#10b981',
    keywords: [
      'streamlit', 'mapa coroplético', 'year-over-year', 'simulador',
      'what-if', 'chat rag', 'informe ejecutivo',
    ],
  },
  {
    id: 'backend', label: 'Backend / DevOps', desc: 'APIs · Deploy · Monitoreo',
    hex: '#f59e0b',
    keywords: [
      'fastapi', 'redis', 'docker', 'cloud run', 'containeriz',
      'evidently', 'airflow', 'retraining', 'monitoreo', 'alertas', 'release final',
    ],
  },
  {
    id: 'qa_biz', label: 'QA / Negocio', desc: 'Pruebas · Cliente · Docs',
    hex: '#ef4444',
    keywords: [
      'prueba', 'integración end-to-end', 'locust', 'qa', 'validación',
      'demo', 'revisión del cliente', 'documentación', 'mkdocs', 'slides', 'aseguramiento',
    ],
  },
] as const

// ─────────────────────────────────────────────────────────────
// MACRO-FASES
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
// Progress Ring — dark mode gradient
// ─────────────────────────────────────────────────────────────
function ProgressRing({ pct }: { pct: number }) {
  const r = 60, cx = 75, cy = 75
  const c = +(2 * Math.PI * r).toFixed(2)
  const off = +(c - (pct / 100) * c).toFixed(2)
  const [clr, ltClr] = pct >= 90
    ? [T.green, T.greenLt]
    : pct >= 70
    ? [T.amber, T.amberLt]
    : [T.red, T.redLt]
  const gid = `rg${pct}`
  return (
    <svg width={150} height={150} viewBox="0 0 150 150" style={{ transform: 'rotate(-90deg)', display: 'block' }}>
      <circle cx={cx} cy={cy} r={r} strokeWidth={10} fill="none" stroke="rgba(255,255,255,0.06)" />
      <circle cx={cx} cy={cy} r={r} strokeWidth={10} fill="none"
        stroke={`url(#${gid})`}
        strokeDasharray={`${c}`}
        strokeDashoffset={`${off}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1.6s cubic-bezier(0.16,1,0.3,1)' }} />
      <defs>
        <linearGradient id={gid} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={clr} />
          <stop offset="100%" stopColor={ltClr} />
        </linearGradient>
      </defs>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────
// Burndown Chart — dark mode
// ─────────────────────────────────────────────────────────────
function BurndownChart({ data, total }: {
  data: { label: string; real: number; ideal: number }[]
  total: number
}) {
  if (data.length < 2 || total === 0) return (
    <p style={{ color: T.textDim, textAlign: 'center', padding: '3rem 0', fontSize: '0.85rem' }}>
      Sin suficientes datos de semana.
    </p>
  )

  const W = 520, H = 170, PL = 32, PB = 30, PT = 8, PR = 8
  const iW = W - PL - PR, iH = H - PT - PB, n = data.length
  const X = (i: number) => PL + (i / Math.max(n - 1, 1)) * iW
  const Y = (v: number) => PT + (1 - v / total) * iH

  const rPath = data.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.real).toFixed(1)}`).join('')
  const iPath = data.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.ideal).toFixed(1)}`).join('')

  const last = data[data.length - 1]
  const ok   = last.real <= last.ideal + 1
  const rc   = ok ? T.green : T.red
  const rcLt = ok ? T.greenLt : T.redLt

  const ticks  = [0, Math.round(total * 0.25), Math.round(total * 0.5), Math.round(total * 0.75), total]
  const xStep  = Math.max(1, Math.floor(n / 7))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 170 }}>
      <defs>
        <linearGradient id="burnArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={rc} stopOpacity={0.18} />
          <stop offset="100%" stopColor={rc} stopOpacity={0.01} />
        </linearGradient>
      </defs>

      {ticks.map(v => (
        <g key={v}>
          <line x1={PL} y1={Y(v)} x2={W - PR} y2={Y(v)} stroke="rgba(255,255,255,0.06)" strokeWidth={0.8} />
          <text x={PL - 4} y={Y(v) + 3.5} textAnchor="end" fill="rgba(240,244,255,0.35)"
            fontSize={8.5} fontFamily="DM Mono, ui-monospace, monospace">{v}</text>
        </g>
      ))}

      {data.map((p, i) =>
        (i % xStep === 0 || i === n - 1)
          ? <text key={i} x={X(i)} y={H - 6} textAnchor="middle"
              fill="rgba(240,244,255,0.35)" fontSize={8.5} fontFamily="DM Sans, system-ui">{p.label}</text>
          : null
      )}

      <path d={iPath} stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} strokeDasharray="5 3" fill="none" />
      <path d={`${rPath}L${X(n-1).toFixed(1)},${Y(0).toFixed(1)}L${X(0).toFixed(1)},${Y(0).toFixed(1)}Z`}
        fill="url(#burnArea)" />
      <path d={rPath} stroke={rc} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />

      {data.map((p, i) =>
        (i % Math.max(1, Math.floor(n / 10)) === 0 || i === n - 1)
          ? <circle key={i} cx={X(i)} cy={Y(p.real)} r={3.5} fill={rcLt} stroke="rgba(6,8,15,0.8)" strokeWidth={1.5} />
          : null
      )}

      <line x1={PL} y1={H - 13} x2={PL + 16} y2={H - 13} stroke={rc} strokeWidth={2} strokeLinecap="round" />
      <text x={PL + 19} y={H - 10} fill={rc} fontSize={7.5} fontFamily="DM Sans, system-ui" fontWeight={600}>Real</text>
      <line x1={PL + 64} y1={H - 13} x2={PL + 80} y2={H - 13} stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} strokeDasharray="4 3" />
      <text x={PL + 83} y={H - 10} fill="rgba(240,244,255,0.35)" fontSize={7.5} fontFamily="DM Sans, system-ui">Ideal lineal</text>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────
// Logo SVG (hexagon mark)
// ─────────────────────────────────────────────────────────────
function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 300 350" width={size} height={Math.round(size * 350/300)}>
      <polygon points="150,15 260,78 260,202 150,265 40,202 40,78"
        fill="none" stroke="#1d70e8" strokeWidth="22" strokeLinejoin="round" />
      <path d="M90,85 L150,140 L210,85" fill="none" stroke="#ffffff" strokeWidth="30"
        strokeLinecap="round" strokeLinejoin="round" />
      <path d="M150,140 L150,215" fill="none" stroke="#1d70e8" strokeWidth="30" strokeLinecap="round" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────
// Shared style helpers
// ─────────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: 24,
  padding: '1.75rem',
  boxShadow: '0 4px 32px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.05) inset',
  transition: 'border-color 0.3s, box-shadow 0.3s, transform 0.3s cubic-bezier(.16,1,.3,1)',
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <p style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.blue, marginBottom: '0.25rem' }}>
        {eyebrow}
      </p>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#f0f4ff' }}>{title}</h2>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { loading, error, tasks, project, metrics, endDate } = useAnalytics()
  const [isExporting, setIsExporting] = useState(false)

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

  // ── Guards ──────────────────────────────────────────────────
  const guardStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100%', fontSize: '0.9rem', color: T.textDim, fontFamily: T.font,
  }
  if (loading) return <div style={guardStyle}>Cargando analítica…</div>
  if (error)   return <div style={{ ...guardStyle, color: T.redLt }}>{error}</div>
  if (!metrics || !endDate) return <div style={guardStyle}>Sin datos de proyecto.</div>

  const {
    done, total, inProgress, todo, pct, daysLeft, atRisk,
    velocityActual, velocityRequired, velocityWeekly,
    pending, burndown, overdue, daysElapsed, totalDays,
  } = metrics

  const timePct    = totalDays > 0 ? Math.min(100, Math.round((daysElapsed / totalDays) * 100)) : 0
  const spPct      = totalSP > 0 ? Math.round(roleStats.reduce((a, r) => a + r.spDone, 0) / totalSP * 100) : 0
  const pctClr     = pct >= 90 ? T.greenLt : pct >= 70 ? T.amberLt : T.redLt
  const velClr     = atRisk ? T.redLt : T.greenLt
  const velReq     = velocityRequired === 'N/A' ? '—' : `${velocityRequired}`
  const lastBurn   = burndown[burndown.length - 1]
  const burnOk     = lastBurn && lastBurn.real <= lastBurn.ideal + 1
  const deficit    = velocityRequired !== 'N/A'
    ? Math.max(0, parseFloat(velocityRequired) - parseFloat(velocityActual)) : 0

  const dateRange = `${
    project?.start_date
      ? new Date(project.start_date + 'T00:00:00Z').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—'
  } → ${endDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}`

  // ── Export HTML ─────────────────────────────────────────────
  async function handleExportHTML() {
    setIsExporting(true)
    try {
      const [reportRes, auditRes] = await Promise.all([
        fetch('/api/report', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ summary: {
            total, done, in_progress: inProgress, todo, overdue, daysLeft,
            deliveryDate: endDate!.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
            projectId: project?.id,
          }}),
        }),
        fetch('/api/audit', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tasks, metrics, projectName: project?.name ?? 'Proyecto' }),
        }),
      ])
      const reportJson = reportRes.ok ? await reportRes.json() as { narrative?: string } : {}
      const narrative  = reportJson.narrative ?? ''
      const auditData  = auditRes.ok ? await auditRes.json() as { audit?: string } : { audit: undefined }
      const priorityStats = [
        { key: 'high'   as const, label: 'Alta',  hex: '#ef4444', bg: '', border: '' },
        { key: 'medium' as const, label: 'Media', hex: '#f59e0b', bg: '', border: '' },
        { key: 'low'    as const, label: 'Baja',  hex: '#94a3b8', bg: '', border: '' },
      ].map(pc => {
        const ptasks  = tasks.filter(t => t.priority === pc.key)
        const pend    = ptasks.filter(t => t.status !== 'done').length
        return { ...pc, total: ptasks.length, pending: pend, done: ptasks.length - pend }
      })
      const spDoneTotal = roleStats.reduce((a, r) => a + r.spDone, 0)
      const { buildAnalyticsHTML } = await import('@/lib/analytics/html-builder')
      const html = buildAnalyticsHTML({
        projectName: project?.name ?? 'Proyecto', dateRange, narrative,
        audit: auditData.audit, pct, done, total, inProgress, todo, overdue, daysLeft,
        timePct, atRisk, pending, velocityActual, velocityRequired, velocityWeekly, burndown,
        roleStats: roleStats.map(r => ({
          label: r.label, desc: r.desc, hex: r.hex,
          done: r.done, total: r.total, pct: r.pct,
          inProgress: r.inProgress, spDone: r.spDone, spTotal: r.spTotal,
        })),
        phaseStats: phaseStats.map(p => ({
          label: p.label, sub: p.sub, hex: p.hex,
          done: p.done, total: p.total, pct: p.pct,
          inProgress: p.inProgress, todo: p.todo,
          spDone: p.spDone, spTotal: p.spTotal,
        })),
        totalSP, spDoneTotal, priorityStats,
      })
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `${(project?.name ?? 'informe').replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) { console.error('[export-html]', err) }
    finally { setIsExporting(false) }
  }

  const ROLE_ICONS = ['💾', '🧠', '📊', '🚀', '🔍']

  return (
    <div style={{ fontFamily: T.font, color: T.text }} className="p-4 sm:p-6 pb-16 max-w-5xl mx-auto space-y-6">

      {/* ════ HEADER BANNER ════ */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        borderRadius: 28, marginBottom: 0,
        background: 'linear-gradient(135deg, #07091a 0%, #0c1330 35%, #111d55 65%, #1640a8 100%)',
        border: '1px solid rgba(29,112,232,0.22)',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.05) inset, 0 32px 64px rgba(0,0,0,0.5), 0 0 50px rgba(29,112,232,0.15)',
      }}>
        {/* Grain overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.4, mixBlendMode: 'overlay',
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
        }} />
        {/* Blue radial accent */}
        <div style={{
          position: 'absolute', top: -70, right: -50, width: 360, height: 360,
          borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(29,112,232,0.28) 0%, transparent 60%)',
        }} />

        <div style={{ position: 'relative', zIndex: 1, padding: '2rem 2rem 1.75rem' }}>

          {/* Brand row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {/* Logo */}
            <div style={{
              width: 52, height: 52, borderRadius: 14, overflow: 'hidden', flexShrink: 0,
              background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 0 1px rgba(29,112,232,0.3), 0 6px 20px rgba(0,0,0,0.4)',
            }}>
              <LogoMark size={32} />
            </div>
            {/* Brand name */}
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#fff', lineHeight: 1 }}>
                MCO<span style={{ color: T.blueLt }}>Y</span>
              </div>
              <div style={{ fontSize: '0.58rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: T.textDim, marginTop: 3 }}>
                AI + Data Strategy
              </div>
            </div>
            {/* Divider */}
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(29,112,232,0.4), transparent)', minWidth: 24 }} />
            {/* Status pill */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '0.35rem 0.875rem', borderRadius: 999,
              fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
              backdropFilter: 'blur(8px)', flexShrink: 0,
              ...(atRisk
                ? { border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)', color: T.redLt }
                : { border: '1px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.1)', color: T.greenLt }),
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', background: 'currentColor',
                animation: 'mcoyPulse 2s ease-in-out infinite',
              }} />
              {atRisk ? '⚠ Riesgo' : '✓ En plazo'}
            </div>
            {/* Export button */}
            <button
              onClick={handleExportHTML}
              disabled={isExporting}
              style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                padding: '0.45rem 1rem', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, rgba(29,112,232,0.9), rgba(77,155,255,0.9))',
                color: '#fff', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em',
                boxShadow: '0 4px 16px rgba(29,112,232,0.4)',
                opacity: isExporting ? 0.6 : 1,
                transition: 'opacity 0.2s, transform 0.2s',
                fontFamily: T.font,
              }}
            >
              {isExporting
                ? <><span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'mcoySpinA 0.7s linear infinite', display: 'inline-block' }} /> Generando…</>
                : <>↓ Exportar HTML</>}
            </button>
          </div>

          {/* Title block */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.58rem', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.textMute, marginBottom: '0.4rem' }}>
              Informe Ejecutivo · TaskFlow AI
            </div>
            <h1 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.4rem)', fontWeight: 800, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1 }}>
              {project?.name ?? 'Analítica del Proyecto'}
            </h1>
            <div style={{ fontFamily: T.mono, fontSize: '0.7rem', color: T.textDim, marginTop: '0.5rem' }}>
              {dateRange}
            </div>
          </div>

          {/* KPI strip */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
            background: 'rgba(0,0,0,0.3)', borderRadius: 16,
            border: `1px solid ${T.border2}`, overflow: 'hidden', backdropFilter: 'blur(16px)',
          }}>
            {([
              { val: `${pct}%`,         lbl: 'Avance tareas',  clr: undefined },
              { val: `${spPct}%`,        lbl: 'Avance SP',      clr: undefined },
              { val: `${done}/${total}`, lbl: 'Tareas',         clr: undefined },
              { val: `${daysLeft}`,      lbl: 'Días restantes', clr: daysLeft === 0 ? T.amberLt : undefined },
              { val: velocityActual,     lbl: 'Tareas / día',   clr: undefined },
            ] as { val: string; lbl: string; clr?: string }[]).map((k, i) => (
              <div key={i} style={{
                padding: '1rem 0.625rem', textAlign: 'center',
                borderRight: i < 4 ? `1px solid ${T.border}` : 'none',
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: k.clr ?? '#fff', letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {k.val}
                </div>
                <div style={{ fontSize: '0.54rem', color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 5 }}>
                  {k.lbl}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pulse + spin keyframes */}
        <style>{`
          @keyframes mcoyPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.4)} }
          @keyframes mcoySpinA { to{transform:rotate(360deg)} }
          .mcoy-card-hover:hover { border-color: rgba(29,112,232,0.3) !important; box-shadow: 0 8px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(29,112,232,0.15) !important; transform: translateY(-2px); }
          .mcoy-role-hover:hover { transform: translateY(-6px) scale(1.012); box-shadow: 0 24px 60px rgba(0,0,0,0.4) !important; }
        `}</style>
      </div>

      {/* ════ ESTADO GENERAL ════ */}
      <section>
        <SectionHeader eyebrow="Resumen" title="Estado General del Proyecto" />
        <div className="mcoy-card-hover" style={{ ...cardStyle, transition: 'border-color 0.3s, box-shadow 0.3s, transform 0.3s' }}>

          {/* st-grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}
            className="sm:grid-cols-[auto_1fr_auto] grid-cols-1">

            {/* Ring */}
            <div style={{ position: 'relative', width: 150, height: 150, flexShrink: 0 }}>
              <ProgressRing pct={pct} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', color: pctClr, lineHeight: 1 }}>{pct}%</span>
                <span style={{ fontSize: '0.58rem', color: T.textDim, marginTop: 4, letterSpacing: '0.1em', textTransform: 'uppercase' }}>avance</span>
              </div>
            </div>

            {/* Counters */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {([
                { v: done,       lbl: 'Completadas', clr: T.greenLt,  border: 'rgba(34,197,94,0.25)' },
                { v: inProgress, lbl: 'En progreso', clr: T.amberLt,  border: 'rgba(245,158,11,0.25)' },
                { v: todo,       lbl: 'Por hacer',   clr: '#94a3b8',   border: 'rgba(148,163,184,0.2)' },
                ...(overdue > 0 ? [{ v: overdue, lbl: 'Vencidas', clr: T.redLt, border: 'rgba(239,68,68,0.25)' }] : []),
              ] as { v: number; lbl: string; clr: string; border: string }[]).map(k => (
                <div key={k.lbl} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '0.875rem 1.125rem', borderRadius: 18, minWidth: 84,
                  background: T.bg2, border: `1px solid ${k.border}`,
                  cursor: 'default',
                  transition: 'transform 0.3s, box-shadow 0.3s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 32px rgba(0,0,0,0.3)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '' }}
                >
                  <span style={{ fontSize: '1.9rem', fontWeight: 800, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', color: k.clr }}>{k.v}</span>
                  <span style={{ fontSize: '0.6rem', color: T.textDim, marginTop: 3, letterSpacing: '0.05em' }}>{k.lbl}</span>
                </div>
              ))}
            </div>

            {/* Velocity panel */}
            <div style={{
              background: T.bg2, border: `1px solid ${T.border}`,
              borderRadius: 18, padding: '1.125rem', minWidth: 210,
            }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: velClr, marginBottom: '0.75rem' }}>
                {atRisk ? '⚠ Riesgo de entrega' : '✓ Dentro del plazo'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {([
                  { lbl: 'Vel. actual',   val: `${velocityActual}`, unit: ' t/d', clr: T.text },
                  { lbl: 'Vel. req.',     val: velReq,              unit: velReq !== '—' ? ' t/d' : '', clr: velClr },
                  { lbl: 'Vel. sem.',     val: `${velocityWeekly}`, unit: ' t/s', clr: T.text },
                ] as { lbl: string; val: string; unit: string; clr: string }[]).map(v => (
                  <div key={v.lbl} style={{
                    background: T.surface2, borderRadius: 12, padding: '0.625rem',
                    border: `1px solid ${T.border}`,
                  }}>
                    <div style={{ fontSize: '0.56rem', color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{v.lbl}</div>
                    <div style={{ fontFamily: T.mono, fontSize: '0.95rem', fontWeight: 700, color: v.clr, marginTop: 3 }}>
                      {v.val}<span style={{ fontSize: '0.56rem', fontWeight: 400, color: T.textDim }}>{v.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              {deficit > 0 && (
                <div style={{ marginTop: '0.625rem', fontSize: '0.65rem', color: T.redLt, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '0.375rem 0.625rem' }}>
                  Déficit: {deficit.toFixed(2)} t/d
                </div>
              )}
            </div>
          </div>

          {/* Dual bars */}
          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {([
              { lbl: `Tareas · ${pct}%`,    w: pct,     bg: 'linear-gradient(90deg,#1d70e8,#4d9bff)' },
              { lbl: `Tiempo · ${timePct}%`, w: Math.min(timePct, 100), bg: timePct > pct + 10 ? T.red : 'linear-gradient(90deg,#1d70e8,#4d9bff)' },
            ]).map(b => (
              <div key={b.lbl} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontFamily: T.mono, fontSize: '0.7rem', color: T.textDim, width: 120, flexShrink: 0 }}>{b.lbl}</span>
                <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.07)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 999, width: `${b.w}%`, background: b.bg, transition: 'width 1.2s cubic-bezier(.16,1,.3,1)' }} />
                </div>
              </div>
            ))}
            <p style={{ fontSize: '0.68rem', color: timePct > pct + 10 ? T.amberLt : T.textDim, marginTop: 2 }}>
              {timePct > pct + 10
                ? `⚠ El tiempo avanza más rápido que las tareas — brecha del ${timePct - pct}%`
                : 'El ritmo de tareas va alineado con el tiempo transcurrido.'}
            </p>
          </div>
        </div>
      </section>

      {/* ════ POR ROLES ════ */}
      <section>
        <SectionHeader eyebrow="Equipo" title="Distribución por Rol" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: '0.875rem' }}>
          {roleStats.map((r, i) => {
            const projPct = totalSP > 0 ? Math.round(r.spTotal / totalSP * 100) : 0
            const [rr, gg, bb] = [parseInt(r.hex.slice(1,3),16), parseInt(r.hex.slice(3,5),16), parseInt(r.hex.slice(5,7),16)]
            return (
              <div key={r.id}
                className="mcoy-role-hover"
                style={{
                  background: T.surface, borderRadius: 24, padding: '1.375rem',
                  border: `1px solid rgba(${rr},${gg},${bb},0.18)`,
                  boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
                  transition: 'transform 0.35s cubic-bezier(.16,1,.3,1), box-shadow 0.35s ease, border-color 0.3s',
                  cursor: 'default',
                }}
              >
                <div style={{
                  width: 42, height: 42, borderRadius: 14,
                  background: `rgba(${rr},${gg},${bb},0.12)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '0.875rem', fontSize: '1.2rem',
                }}>{ROLE_ICONS[i] ?? '●'}</div>
                <div style={{ fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: r.hex }}>{r.label}</div>
                <div style={{ fontSize: '0.62rem', color: T.textDim, lineHeight: 1.4, marginBottom: '0.75rem' }}>{r.desc}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: '2.1rem', fontWeight: 800, letterSpacing: '-0.04em', color: r.hex, lineHeight: 1 }}>{r.done}</span>
                  <span style={{ fontSize: '0.7rem', color: T.textDim }}>/ {r.total}</span>
                </div>
                <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.08)', margin: '6px 0', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 999, width: `${r.pct}%`, background: `linear-gradient(90deg,${r.hex},${r.hex}cc)`, transition: 'width 1s cubic-bezier(.16,1,.3,1)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: r.hex }}>{r.pct}%</span>
                  {r.inProgress > 0 && <span style={{ fontSize: '0.62rem', color: T.amberLt }}>▶ {r.inProgress} activa{r.inProgress > 1 ? 's' : ''}</span>}
                  {r.pct === 100 && <span style={{ fontSize: '0.62rem', color: T.greenLt }}>✓ Completo</span>}
                </div>
                <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 8, marginTop: 8, fontSize: '0.61rem', color: T.textDim }}>
                  <span style={{ fontFamily: T.mono, fontWeight: 700, color: '#f0f4ff' }}>{r.spDone}/{r.spTotal}</span>
                  {' SP · '}
                  <span style={{ fontWeight: 600, color: r.hex }}>{projPct}% del proyecto</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ════ POR FASE ════ */}
      <section>
        <SectionHeader eyebrow="Fases" title="Progreso por Fase del Proyecto" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '1rem' }}>
          {phaseStats.map(ph => {
            const projPct = totalSP > 0 ? Math.round(ph.spTotal / totalSP * 100) : 0
            const ipPct   = ph.total > 0 ? Math.round(ph.inProgress / ph.total * 100) : 0
            const badge   = ph.pct === 100
              ? { lbl: '✓ Completa',    s: { background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: T.greenLt } }
              : ph.inProgress > 0
              ? { lbl: 'En ejecución',  s: { background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: T.amberLt } }
              : { lbl: 'Pendiente',     s: { background: 'rgba(148,163,184,0.1)',  border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8' } }
            return (
              <div key={ph.id}
                className="mcoy-card-hover"
                style={{ ...cardStyle, transition: 'border-color 0.3s, box-shadow 0.3s, transform 0.3s' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.875rem' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.93rem', fontWeight: 700 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: ph.hex, display: 'inline-block', marginRight: 7, flexShrink: 0 }} />
                      <span style={{ color: ph.hex }}>{ph.label}</span>
                    </div>
                    <div style={{ fontSize: '0.62rem', color: T.textDim, lineHeight: 1.5, marginTop: 3 }}>{ph.sub}</div>
                  </div>
                  <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '0.22rem 0.7rem', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0, letterSpacing: '0.04em', ...badge.s }}>
                    {badge.lbl}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.875rem', fontSize: '0.68rem', marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ color: T.greenLt, fontWeight: 600 }}>{ph.done} listas</span>
                  {ph.inProgress > 0 && <span style={{ color: T.amberLt, fontWeight: 600 }}>{ph.inProgress} activas</span>}
                  {ph.todo > 0        && <span style={{ color: T.textDim }}>{ph.todo} pendientes</span>}
                </div>
                <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ height: '100%', borderRadius: '999px 0 0 999px', width: `${ph.pct}%`, background: ph.hex, transition: 'width 1.2s cubic-bezier(.16,1,.3,1)' }} />
                  {ipPct > 0 && <div style={{ height: '100%', opacity: 0.4, width: `${ipPct}%`, background: ph.hex, transition: 'width 1.2s cubic-bezier(.16,1,.3,1) 0.08s' }} />}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.64rem', color: T.textDim, marginTop: 8, flexWrap: 'wrap', gap: 4 }}>
                  <span>{ph.total} tareas · <b style={{ color: '#f0f4ff', fontFamily: T.mono }}>{ph.spDone}/{ph.spTotal} SP</b></span>
                  <span style={{ fontWeight: 600, color: ph.hex }}>{projPct}% del peso</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ════ BURNDOWN ════ */}
      <section>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <p style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.blue, marginBottom: '0.2rem' }}>Burndown</p>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#f0f4ff' }}>Tareas Restantes por Semana</h2>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontFamily: T.mono, fontSize: '0.68rem', color: T.textMute }}>{pending} pendientes · {total} total</span>
            <div style={{ marginTop: 2 }}>
              <span style={{ fontFamily: T.mono, fontSize: '0.7rem', color: T.textDim }}>Días restantes: </span>
              <span style={{ fontFamily: T.mono, fontWeight: 800, fontSize: '1.1rem', color: daysLeft === 0 ? T.amberLt : atRisk ? T.amberLt : T.greenLt }}>{daysLeft}</span>
            </div>
          </div>
        </div>
        <div className="mcoy-card-hover" style={{ ...cardStyle, transition: 'border-color 0.3s, box-shadow 0.3s, transform 0.3s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.125rem', fontSize: '0.72rem', color: T.textDim }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: burnOk ? T.green : T.red, flexShrink: 0, display: 'inline-block' }} />
            {burnOk
              ? 'El equipo va por debajo del ideal — buen ritmo.'
              : 'El equipo va por encima del ideal — ritmo insuficiente.'}
          </div>
          <BurndownChart data={burndown} total={total} />
        </div>
      </section>

      {/* ════ PRIORIDAD ════ */}
      <section>
        <SectionHeader eyebrow="Prioridad" title="Tareas Pendientes por Prioridad" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {([
            { p: 'high'   as const, lbl: 'Alta',  hex: '#ef4444', border: 'rgba(239,68,68,0.25)' },
            { p: 'medium' as const, lbl: 'Media', hex: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
            { p: 'low'    as const, lbl: 'Baja',  hex: '#64748b', border: 'rgba(100,116,139,0.2)' },
          ]).map(({ p, lbl, hex, border }) => {
            const pend  = tasks.filter(t => t.priority === p && t.status !== 'done').length
            const ptot  = tasks.filter(t => t.priority === p).length
            const ppct  = ptot > 0 ? Math.round(pend / ptot * 100) : 0
            const pdone = ptot - pend
            return (
              <div key={p}
                className="mcoy-card-hover"
                style={{
                  borderRadius: 22, padding: '1.375rem',
                  background: T.surface, border: `1px solid ${border}`,
                  transition: 'border-color 0.3s, box-shadow 0.3s, transform 0.35s cubic-bezier(.16,1,.3,1)',
                  cursor: 'default',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: hex }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: hex, display: 'inline-block' }} />
                  {lbl}
                </div>
                <div style={{ fontSize: '2.7rem', fontWeight: 800, letterSpacing: '-0.04em', color: hex, lineHeight: 1, margin: '10px 0 4px' }}>{pend}</div>
                <div style={{ fontSize: '0.64rem', color: T.textDim }}>
                  pendientes de {ptot} · <b style={{ color: '#f0f4ff' }}>{pdone} listas</b>
                </div>
                <div style={{ width: '100%', height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.07)', marginTop: 14, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 999, width: `${ppct}%`, background: `linear-gradient(90deg,${hex},${hex}cc)`, transition: 'width 1.2s cubic-bezier(.16,1,.3,1)' }} />
                </div>
                <p style={{ fontSize: '0.62rem', color: T.textDim, marginTop: 6 }}>{ppct}% sin completar</p>
              </div>
            )
          })}
        </div>
      </section>

    </div>
  )
}
