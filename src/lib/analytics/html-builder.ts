/**
 * Generador de informe HTML autocontenido — MCOY Dark Premium Edition
 * Inspirado en pipeline-olist-mcoy-premium.html
 * Sin dependencias externas · Responsive · Animaciones premium · Print-friendly
 */

// ── Tipos ─────────────────────────────────────────────────────────────────────
export interface RoleStat {
  label: string; desc: string; hex: string
  done: number; total: number; pct: number; inProgress: number
  spDone: number; spTotal: number
}

export interface PhaseStat {
  label: string; sub: string; hex: string
  done: number; total: number; pct: number; inProgress: number; todo: number
  spDone: number; spTotal: number
}

export interface PriorityStat {
  key: 'high' | 'medium' | 'low'
  label: string; hex: string; bg: string; border: string
  pending: number; total: number; done: number
}

export interface HTMLReportData {
  projectName: string; dateRange: string; narrative: string; audit?: string
  pct: number; done: number; total: number; inProgress: number; todo: number
  overdue: number; daysLeft: number; timePct: number; atRisk: boolean
  velocityActual: string; velocityRequired: string; velocityWeekly: string
  pending: number
  burndown: { label: string; real: number; ideal: number }[]
  roleStats: RoleStat[]; phaseStats: PhaseStat[]
  totalSP: number; spDoneTotal: number; priorityStats?: PriorityStat[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
          .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// ── Ring SVG animado (dark mode) ──────────────────────────────────────────────
function buildRingSVG(pct: number): string {
  const r = 60, cx = 75, cy = 75, c = +(2 * Math.PI * r).toFixed(2)
  const off = +(c - (pct / 100) * c).toFixed(2)
  const clr = pct >= 90 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444'
  const ltClr = pct >= 90 ? '#4ade80' : pct >= 70 ? '#fbbf24' : '#f87171'
  const gradId = `ringGrad${pct}`
  return `<svg width="150" height="150" viewBox="0 0 150 150" style="display:block;transform:rotate(-90deg)">
  <circle cx="${cx}" cy="${cy}" r="${r}" stroke-width="10" fill="none" stroke="rgba(255,255,255,0.06)"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" stroke-width="10" fill="none"
    stroke="url(#${gradId})" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-off="${off}"
    stroke-linecap="round" style="transition:stroke-dashoffset 1.6s cubic-bezier(0.16,1,0.3,1)"/>
  <defs>
    <linearGradient id="${gradId}" x1="1" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${clr}"/>
      <stop offset="100%" stop-color="${ltClr}"/>
    </linearGradient>
  </defs>
</svg>`
}

// ── Burndown SVG animado (dark mode) ─────────────────────────────────────────
function buildBurndownSVG(
  data: { label: string; real: number; ideal: number }[],
  total: number,
): string {
  if (data.length < 2 || total === 0)
    return '<p style="color:rgba(240,244,255,0.35);text-align:center;padding:3rem 0;font-size:0.85rem">Sin datos suficientes.</p>'

  const W = 820, H = 260, PL = 48, PB = 44, PT = 18, PR = 18
  const iW = W - PL - PR, iH = H - PT - PB, n = data.length
  const X = (i: number) => PL + (i / Math.max(n - 1, 1)) * iW
  const Y = (v: number) => PT + (1 - v / total) * iH

  const rPath = data.map((p,i) => `${i?'L':'M'}${X(i).toFixed(1)},${Y(p.real).toFixed(1)}`).join('')
  const iPath = data.map((p,i) => `${i?'L':'M'}${X(i).toFixed(1)},${Y(p.ideal).toFixed(1)}`).join('')

  const last = data[data.length - 1]
  const ok   = last.real <= last.ideal + 1
  const rc   = ok ? '#22c55e' : '#ef4444'
  const rcLt = ok ? '#4ade80' : '#f87171'
  const ticks = [0, Math.round(total*.25), Math.round(total*.5), Math.round(total*.75), total]
  const step  = Math.max(1, Math.floor(n / 8))

  let s = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block;overflow:visible">`
  s += `<defs>
    <linearGradient id="burnGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${rc}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${rc}" stop-opacity="0.01"/>
    </linearGradient>
  </defs>`

  for (const v of ticks) {
    const y = Y(v).toFixed(1)
    s += `<line x1="${PL}" y1="${y}" x2="${W-PR}" y2="${y}" class="chart-grid" stroke-width="1"/>`
    s += `<text x="${PL-8}" y="${(Y(v)+4).toFixed(1)}" text-anchor="end" class="chart-label" font-size="12">${v}</text>`
  }
  for (let i = 0; i < n; i++) {
    if (i % step === 0 || i === n-1)
      s += `<text x="${X(i).toFixed(1)}" y="${H-10}" text-anchor="middle" class="chart-label" font-size="12">${esc(data[i].label)}</text>`
  }

  // ideal dashed
  s += `<path d="${iPath}" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" stroke-dasharray="8 5" fill="none" opacity="0.7"/>`
  // área relleno
  s += `<path d="${rPath}L${X(n-1).toFixed(1)},${(PT+iH).toFixed(1)}L${X(0).toFixed(1)},${(PT+iH).toFixed(1)}Z" fill="url(#burnGrad)"/>`
  // línea real — animada
  s += `<path d="${rPath}" stroke="${rc}" stroke-width="3" fill="none"
    stroke-linejoin="round" stroke-linecap="round"
    data-off="0"
    style="stroke-dasharray:3000;stroke-dashoffset:3000;transition:stroke-dashoffset 1.9s cubic-bezier(0.16,1,0.3,1) 0.25s"/>`
  // puntos
  for (let i = 0; i < n; i++) {
    if (i % Math.max(1,Math.floor(n/10)) === 0 || i === n-1)
      s += `<circle cx="${X(i).toFixed(1)}" cy="${Y(data[i].real).toFixed(1)}" r="5" fill="${rcLt}" stroke="rgba(6,8,15,0.8)" stroke-width="2"/>`
  }
  // leyenda
  const ly = H - 20
  s += `<line x1="${PL}" y1="${ly}" x2="${PL+24}" y2="${ly}" stroke="${rc}" stroke-width="2.5" stroke-linecap="round"/>`
  s += `<text x="${PL+30}" y="${ly+4}" fill="${rc}" font-size="12" font-family="'DM Sans',sans-serif" font-weight="600">Real</text>`
  s += `<line x1="${PL+74}" y1="${ly}" x2="${PL+98}" y2="${ly}" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" stroke-dasharray="6 4"/>`
  s += `<text x="${PL+104}" y="${ly+4}" fill="rgba(240,244,255,0.35)" font-size="12" font-family="'DM Sans',sans-serif">Ideal lineal</text>`
  s += '</svg>'
  return s
}

// ── Parser de auditoría (dark mode) ──────────────────────────────────────────
interface AuditSection { heading: string; body: string; color: string }

const AUDIT_SECTIONS = [
  { re: /^DIAGNOSTICO ARQUITECTONICO:/i, color: '#818cf8' },
  { re: /^ALERTAS CRITICAS/i,            color: '#f87171' },
  { re: /^RIESGOS OPERATIVOS/i,          color: '#fbbf24' },
  { re: /^INTERROGATORIO TECNICO:/i,     color: '#60a5fa' },
  { re: /^VEREDICTO DE MADUREZ:/i,       color: '#34d399' },
]

function parseAuditSections(text: string): AuditSection[] {
  const lines = text.replace(/\r\n/g,'\n').split('\n')
  const result: AuditSection[] = []
  let current: AuditSection | null = null
  for (const line of lines) {
    const t   = line.trim()
    const def = AUDIT_SECTIONS.find(s => s.re.test(t))
    if (def) {
      if (current) result.push(current)
      const ci = t.indexOf(':')
      current = { heading: ci !== -1 ? t.slice(0,ci).trim() : t,
                  body: ci !== -1 ? t.slice(ci+1).trim() : '',
                  color: def.color }
    } else if (current && t) {
      current.body += (current.body ? ' ' : '') + t
    }
  }
  if (current) result.push(current)
  return result
}

// ── CSS dark mode ─────────────────────────────────────────────────────────────
const CSS = `
:root {
  --bg:        #06080f;
  --bg2:       #0b0e1a;
  --bg3:       #101425;
  --surface:   #131729;
  --surface2:  #1a1f38;
  --border:    rgba(255,255,255,0.07);
  --border2:   rgba(255,255,255,0.12);
  --blue:      #1d70e8;
  --blue-glow: rgba(29,112,232,0.35);
  --blue-dim:  rgba(29,112,232,0.15);
  --blue-lt:   #4d9bff;
  --silver:    #8a96b8;
  --white:     #f0f4ff;
  --text:      rgba(240,244,255,0.88);
  --text-dim:  rgba(240,244,255,0.45);
  --text-mute: rgba(240,244,255,0.28);
  --green:     #22c55e;
  --amber:     #f59e0b;
  --red:       #ef4444;
  --purple:    #8b5cf6;
  --font:      'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --mono:      'DM Mono', 'SF Mono', ui-monospace, 'Cascadia Code', monospace;
}

*,*::before,*::after { box-sizing:border-box; margin:0; padding:0 }
html { scroll-behavior:smooth }
body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  font-size: 15px;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
  overflow-x: hidden;
}

/* Ambient background glow */
body::before {
  content: '';
  position: fixed;
  top: -20vh; left: -10vw;
  width: 60vw; height: 60vh;
  background: radial-gradient(ellipse, rgba(29,112,232,0.08) 0%, transparent 65%);
  pointer-events: none;
  z-index: 0;
}
body::after {
  content: '';
  position: fixed;
  bottom: -10vh; right: -10vw;
  width: 50vw; height: 50vh;
  background: radial-gradient(ellipse, rgba(139,92,246,0.05) 0%, transparent 65%);
  pointer-events: none;
  z-index: 0;
}

.wrap { max-width: 1080px; margin: 0 auto; padding: 2rem 1.5rem 6rem; position: relative; z-index: 1; }

/* ── HEADER ── */
.header {
  position: relative;
  border-radius: 28px;
  overflow: hidden;
  margin-bottom: 2rem;
  background: linear-gradient(135deg, #07091a 0%, #0c1330 35%, #111d55 65%, #1640a8 100%);
  border: 1px solid rgba(29,112,232,0.22);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.05) inset,
              0 40px 80px rgba(0,0,0,0.5),
              0 0 60px rgba(29,112,232,0.15);
}
.header::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
  pointer-events: none;
  opacity: 0.4;
  mix-blend-mode: overlay;
}
.header::after {
  content: '';
  position: absolute;
  top: -80px; right: -60px;
  width: 400px; height: 400px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(29,112,232,0.3) 0%, transparent 60%);
  pointer-events: none;
}
.header-inner {
  position: relative;
  z-index: 1;
  padding: 2.5rem 2.5rem 2rem;
}

/* Brand row */
.brand-row {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  margin-bottom: 2rem;
}
.logo-mark {
  width: 56px; height: 56px;
  border-radius: 14px;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 0 0 1px rgba(29,112,232,0.3), 0 8px 24px rgba(0,0,0,0.4);
  background: #000;
  display: flex; align-items: center; justify-content: center;
}
.logo-svg { width: 36px; height: 42px; }
.brand-name {
  font-size: 1.1rem; font-weight: 800;
  letter-spacing: 0.15em; text-transform: uppercase;
  color: #fff; line-height: 1;
}
.brand-name span { color: var(--blue-lt); }
.brand-sub {
  font-size: 0.6rem; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--text-dim); margin-top: 4px;
}
.brand-divider {
  flex: 1; height: 1px;
  background: linear-gradient(90deg, rgba(29,112,232,0.4), transparent);
}
.status-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 0.4rem 1rem; border-radius: 999px;
  font-size: 0.68rem; font-weight: 700;
  letter-spacing: 0.04em; text-transform: uppercase;
  backdrop-filter: blur(8px); flex-shrink: 0;
}
.pill-ok   { border: 1px solid rgba(34,197,94,0.4); background: rgba(34,197,94,0.1); color: #4ade80; }
.pill-risk { border: 1px solid rgba(239,68,68,0.4);  background: rgba(239,68,68,0.1);  color: #f87171; }
.status-pill-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: currentColor;
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse {
  0%,100% { opacity:1; transform:scale(1); }
  50%      { opacity:0.5; transform:scale(1.4); }
}

/* Title block */
.report-eyebrow {
  font-size: 0.62rem; font-weight: 600; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--text-mute); margin-bottom: 0.5rem;
}
.report-title {
  font-size: clamp(1.8rem,4vw,2.8rem); font-weight: 800;
  letter-spacing: -0.04em; color: #fff; line-height: 1;
}
.report-date {
  font-size: 0.72rem; color: var(--text-dim);
  margin-top: 0.5rem; font-family: var(--mono);
}

/* KPI strip */
.kpi-strip {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  background: rgba(0,0,0,0.3);
  border-radius: 18px;
  border: 1px solid var(--border2);
  overflow: hidden;
  backdrop-filter: blur(16px);
  margin-top: 1.75rem;
}
.kpi-cell {
  padding: 1.1rem 0.75rem; text-align: center;
  border-right: 1px solid var(--border);
  transition: background 0.2s;
}
.kpi-cell:last-child { border-right: none; }
.kpi-cell:hover { background: rgba(29,112,232,0.1); }
.kpi-val {
  font-size: 1.6rem; font-weight: 800; color: #fff;
  letter-spacing: -0.04em; line-height: 1;
  font-variant-numeric: tabular-nums;
}
.kpi-lbl {
  font-size: 0.56rem; color: var(--text-dim);
  text-transform: uppercase; letter-spacing: 0.12em; margin-top: 5px;
}
@media(max-width:600px) {
  .kpi-strip { grid-template-columns: repeat(3,1fr); }
  .kpi-cell:nth-child(3) { border-right: none; }
  .kpi-cell { border-bottom: 1px solid var(--border); }
}

/* ── SECTIONS ── */
section { margin-bottom: 2.5rem; }
.sec-eyebrow {
  font-size: 0.6rem; font-weight: 700; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--blue); margin-bottom: 0.25rem;
}
.sec-title {
  font-size: 1rem; font-weight: 700;
  color: var(--white); margin-bottom: 1rem;
}
.sec-row {
  display: flex; align-items: baseline;
  justify-content: space-between; margin-bottom: 1rem;
  flex-wrap: wrap; gap: 0.5rem;
}
.sec-aside { font-size: 0.7rem; color: var(--text-mute); font-family: var(--mono); }

/* ── CARD ── */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 1.75rem;
  box-shadow: 0 4px 32px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.05) inset;
  transition: border-color 0.35s ease, box-shadow 0.35s ease, transform 0.35s cubic-bezier(.16,1,.3,1);
}
.card:hover {
  border-color: rgba(29,112,232,0.3);
  box-shadow: 0 8px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(29,112,232,0.15), 0 1px 0 rgba(255,255,255,0.05) inset;
  transform: translateY(-2px);
}

/* ── STATUS ── */
.st-grid {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 2.5rem;
}
@media(max-width:680px) { .st-grid { grid-template-columns: 1fr; } }

.ring-wrap { position:relative; width:150px; height:150px; flex-shrink:0; }
.ring-label {
  position:absolute; inset:0;
  display:flex; flex-direction:column;
  align-items:center; justify-content:center;
}
.ring-num { font-size:2rem; font-weight:800; letter-spacing:-0.04em; line-height:1; }
.ring-sub { font-size:0.58rem; color:var(--text-dim); margin-top:4px; letter-spacing:0.1em; text-transform:uppercase; }

.counters { display:flex; flex-wrap:wrap; gap:0.75rem; }
.counter {
  display:flex; flex-direction:column; align-items:center;
  padding:1rem 1.25rem; border-radius:18px;
  min-width:90px; border:1px solid;
  background: var(--bg2);
  transition:transform 0.3s cubic-bezier(.16,1,.3,1), box-shadow 0.3s ease;
}
.counter:hover { transform:translateY(-3px); box-shadow:0 12px 32px rgba(0,0,0,0.3); }
.counter-val { font-size:2rem; font-weight:800; line-height:1.1; font-variant-numeric:tabular-nums; }
.counter-lbl { font-size:0.6rem; color:var(--text-dim); margin-top:3px; letter-spacing:0.05em; }
.c-green { border-color:rgba(34,197,94,0.25); color:#4ade80; }
.c-amber { border-color:rgba(245,158,11,0.25); color:#fbbf24; }
.c-slate { border-color:rgba(148,163,184,0.2); color:#94a3b8; }
.c-red   { border-color:rgba(239,68,68,0.25);  color:#f87171; }

.vel-panel {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 1.25rem;
  min-width: 220px;
}
.vel-title { font-size:0.6rem; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; margin-bottom:0.875rem; }
.vel-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:0.625rem; }
.vel-item {
  background: var(--surface2);
  border-radius:12px; padding:0.75rem;
  border:1px solid var(--border);
  transition:transform 0.25s ease;
}
.vel-item:hover { transform:translateY(-2px); }
.vel-lbl { font-size:0.56rem; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.07em; }
.vel-val { font-size:1rem; font-weight:700; font-family:var(--mono); margin-top:3px; color:var(--white); }
.vel-unit { font-size:0.58rem; font-weight:400; color:var(--text-dim); }

.dbar { margin-top:1.5rem; display:flex; flex-direction:column; gap:0.75rem; }
.dbar-row { display:flex; align-items:center; gap:1rem; }
.dbar-lbl { font-size:0.72rem; color:var(--text-dim); width:120px; flex-shrink:0; font-family:var(--mono); }
.dbar-track { flex:1; height:8px; background:rgba(255,255,255,0.07); border-radius:999px; overflow:hidden; }
.dbar-fill { height:100%; border-radius:999px; width:0; transition:width 1.2s cubic-bezier(.16,1,.3,1); }
.dbar-note { font-size:0.7rem; color:var(--amber); margin-top:6px; display:flex; align-items:center; gap:6px; }

/* ── NARRATIVE ── */
.narr-sec { margin-bottom:1.25rem; }
.narr-head {
  font-size:0.62rem; font-weight:700; text-transform:uppercase;
  letter-spacing:0.12em; margin-bottom:0.5rem;
  display:flex; align-items:center; gap:8px;
}
.narr-stripe { display:block; width:3px; height:14px; border-radius:2px; flex-shrink:0; }
.narr-body { font-size:0.85rem; line-height:1.85; color:var(--text-dim); padding-left:11px; }

/* ── ROLES ── */
.roles-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(185px,1fr)); gap:1rem; }
.role-card {
  background: var(--surface);
  border-radius:24px; padding:1.5rem;
  border:1px solid var(--border);
  box-shadow: 0 4px 24px rgba(0,0,0,0.25);
  transition:transform 0.35s cubic-bezier(.16,1,.3,1), box-shadow 0.35s ease, border-color 0.3s;
  cursor:default;
}
.role-card:hover {
  transform:translateY(-6px) scale(1.012);
  box-shadow:0 24px 60px rgba(0,0,0,0.4);
}
.role-icon {
  width:44px; height:44px; border-radius:14px;
  display:flex; align-items:center; justify-content:center;
  margin-bottom:1rem; font-size:1.3rem;
}
.role-label { font-size:0.68rem; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; }
.role-desc { font-size:0.64rem; color:var(--text-dim); line-height:1.4; margin-bottom:0.875rem; }
.role-num { font-size:2.2rem; font-weight:800; letter-spacing:-0.04em; line-height:1; }
.role-bar { height:4px; border-radius:999px; background:rgba(255,255,255,0.08); margin:8px 0; overflow:hidden; }
.role-bar-fill { height:100%; border-radius:999px; width:0; transition:width 1s cubic-bezier(.16,1,.3,1); }
.role-pct { font-size:0.85rem; font-weight:700; }
.role-ip { font-size:0.64rem; color:var(--amber); }
.sp-row { font-size:0.63rem; color:var(--text-dim); border-top:1px solid var(--border); padding-top:8px; margin-top:8px; }
.sp-val { font-weight:700; color:var(--white); font-family:var(--mono); }

/* ── PHASES ── */
.phases-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(440px,1fr)); gap:1rem; }
@media(max-width:560px) { .phases-grid { grid-template-columns:1fr; } }
.phase-card {
  background: var(--surface);
  border-radius:24px; padding:1.5rem;
  border:1px solid var(--border);
  box-shadow: 0 4px 24px rgba(0,0,0,0.25);
  transition:transform 0.35s cubic-bezier(.16,1,.3,1), box-shadow 0.35s ease;
}
.phase-card:hover { transform:translateY(-3px); box-shadow:0 16px 48px rgba(0,0,0,0.35); }
.ph-header { display:flex; align-items:flex-start; justify-content:space-between; gap:0.75rem; margin-bottom:1rem; }
.ph-dot { width:9px; height:9px; border-radius:50%; display:inline-block; margin-right:6px; flex-shrink:0; }
.ph-name { font-size:0.95rem; font-weight:700; display:flex; align-items:center; }
.ph-sub { font-size:0.63rem; color:var(--text-dim); line-height:1.5; margin-top:3px; }
.ph-badge { font-size:0.58rem; font-weight:700; padding:0.25rem 0.75rem; border-radius:999px; border:1px solid; white-space:nowrap; flex-shrink:0; letter-spacing:0.04em; }
.ph-badge-ok   { background:rgba(34,197,94,0.12); border-color:rgba(34,197,94,0.3); color:#4ade80; }
.ph-badge-wip  { background:rgba(245,158,11,0.12); border-color:rgba(245,158,11,0.3); color:#fbbf24; }
.ph-badge-todo { background:rgba(148,163,184,0.1);  border-color:rgba(148,163,184,0.2); color:#94a3b8; }
.ph-counts { display:flex; gap:1rem; font-size:0.7rem; margin-bottom:8px; flex-wrap:wrap; }
.ph-bar { height:10px; border-radius:999px; background:rgba(255,255,255,0.07); overflow:hidden; display:flex; }
.ph-bar-done { height:100%; border-radius:999px 0 0 999px; width:0; transition:width 1.2s cubic-bezier(.16,1,.3,1); }
.ph-bar-ip { height:100%; opacity:0.4; width:0; transition:width 1.2s cubic-bezier(.16,1,.3,1) 0.08s; }
.ph-footer { display:flex; justify-content:space-between; font-size:0.66rem; color:var(--text-dim); margin-top:8px; flex-wrap:wrap; gap:4px; }
.ph-footer b { color:var(--white); font-family:var(--mono); }

/* ── BURNDOWN ── */
.burndown-note { font-size:0.75rem; color:var(--text-dim); margin-bottom:1.25rem; display:flex; align-items:center; gap:8px; }
.burndown-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }

/* SVG charts: dark mode */
.chart-grid { stroke:rgba(255,255,255,0.06); }
.chart-label { fill:rgba(240,244,255,0.35); font-family:'DM Sans',sans-serif; }

/* ── PRIORITY ── */
.prio-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; }
@media(max-width:500px) { .prio-grid { grid-template-columns:1fr; } }
.prio-card {
  border-radius:22px; padding:1.5rem; border:1px solid;
  background: var(--surface);
  transition:transform 0.35s cubic-bezier(.16,1,.3,1), box-shadow 0.35s ease;
}
.prio-card:hover { transform:translateY(-4px); box-shadow:0 16px 48px rgba(0,0,0,0.35); }
.prio-tag { font-size:0.6rem; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; display:flex; align-items:center; gap:6px; }
.prio-dot { width:7px; height:7px; border-radius:50%; display:inline-block; }
.prio-num { font-size:2.8rem; font-weight:800; letter-spacing:-0.04em; line-height:1; margin:12px 0 4px; }
.prio-of { font-size:0.66rem; color:var(--text-dim); }
.prio-bar { width:100%; height:4px; border-radius:999px; background:rgba(255,255,255,0.07); margin-top:14px; overflow:hidden; }
.prio-fill { height:100%; border-radius:999px; width:0; transition:width 1.2s cubic-bezier(.16,1,.3,1); }

/* ── RISK (audit) ── */
.risk-card {
  border-radius:24px; overflow:hidden;
  border:1px solid rgba(239,68,68,0.25);
  box-shadow:0 8px 40px rgba(239,68,68,0.1);
}
.risk-header {
  background:linear-gradient(135deg,#1a0303 0%,#3d0606 40%,#7f1d1d 100%);
  padding:1.5rem 1.75rem;
  display:flex; align-items:flex-start; gap:1rem;
}
.risk-icon {
  width:48px; height:48px; background:rgba(255,255,255,0.1);
  border-radius:14px; display:flex; align-items:center; justify-content:center;
  font-size:1.4rem; flex-shrink:0;
}
.risk-title { font-size:1.05rem; font-weight:800; color:#fff; letter-spacing:-0.01em; }
.risk-sub { font-size:0.68rem; color:rgba(255,255,255,0.5); margin-top:4px; }
.risk-body { background:rgba(30,5,5,0.8); border-top:1px solid rgba(239,68,68,0.2); }
.risk-sec { padding:1.25rem 1.75rem; border-bottom:1px solid rgba(255,255,255,0.04); transition:background 0.2s; }
.risk-sec:last-child { border-bottom:none; }
.risk-sec:hover { background:rgba(239,68,68,0.04); }
.risk-hd {
  font-size:0.62rem; font-weight:800; text-transform:uppercase;
  letter-spacing:0.12em; margin-bottom:0.625rem;
  display:flex; align-items:center; gap:10px;
}
.risk-mk { width:4px; height:18px; border-radius:3px; flex-shrink:0; }
.risk-txt { font-size:0.84rem; line-height:1.85; color:var(--text-dim); padding-left:14px; }

/* ── FOOTER ── */
.footer {
  margin-top:4rem; padding:1.5rem 0 0;
  border-top:1px solid var(--border);
  display:flex; justify-content:space-between; align-items:center;
  flex-wrap:wrap; gap:0.75rem;
  font-size:0.65rem; color:var(--text-mute);
}
.footer-logo { display:flex; align-items:center; gap:0.625rem; }
.footer-brand {
  font-weight:800; letter-spacing:0.1em; text-transform:uppercase; font-size:0.7rem;
  background:linear-gradient(90deg,var(--blue),var(--blue-lt));
  -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
}
.footer-meta { font-family:var(--mono); }

/* ── ANIMATE ON OBSERVE ── */
.ao { opacity:0; transform:translateY(24px); }

/* ── UTILITY ── */
.text-green { color:#4ade80; }
.text-amber { color:#fbbf24; }
.text-red   { color:#f87171; }
.text-blue  { color:var(--blue-lt); }

@media print {
  body { background:#0b0e1a; color:var(--text); -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .wrap { padding:0; }
  .card,.role-card,.phase-card,.prio-card { box-shadow:none!important; transform:none!important; break-inside:avoid; }
  .header { border-radius:8px; }
  section { break-inside:avoid; }
  [data-off],[data-w] { transition:none!important; }
}
`

// ── Logo SVG inline ───────────────────────────────────────────────────────────
const LOGO_SVG = `<svg viewBox="0 0 300 350" class="logo-svg">
  <polygon points="150,15 260,78 260,202 150,265 40,202 40,78" fill="none" stroke="#1d70e8" stroke-width="18" stroke-linejoin="round"/>
  <path d="M90,85 L150,140 L210,85" fill="none" stroke="#ffffff" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M150,140 L150,215" fill="none" stroke="#1d70e8" stroke-width="28" stroke-linecap="round"/>
</svg>`

// ── Generador principal ───────────────────────────────────────────────────────
export function buildAnalyticsHTML(d: HTMLReportData): string {
  const today = new Date().toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  const pctClr  = d.pct >= 90 ? '#4ade80' : d.pct >= 70 ? '#fbbf24' : '#f87171'
  const velClr  = d.atRisk ? '#f87171' : '#4ade80'
  const velReq  = d.velocityRequired === 'N/A' ? '—' : `${d.velocityRequired} t/d`
  const spPct   = d.totalSP > 0 ? Math.round(d.spDoneTotal / d.totalSP * 100) : 0
  const pillCls = d.atRisk ? 'status-pill pill-risk' : 'status-pill pill-ok'
  const pillTxt = d.atRisk ? '⚠ Riesgo de entrega' : '✓ En plazo'

  // ── Narrativa ──
  const narrativeLines = (d.narrative ?? '').split('\n').filter(Boolean)
  let narrativeHTML = ''
  const NARR_COLORS = ['var(--blue-lt)', 'var(--amber)', 'var(--green)', 'var(--purple)', '#f87171']
  let narri = 0
  for (const line of narrativeLines) {
    const ci = line.indexOf(':')
    if (ci > 0 && ci < 40 && line.slice(0, ci) === line.slice(0, ci).toUpperCase()) {
      const nc = NARR_COLORS[narri % NARR_COLORS.length]
      narri++
      narrativeHTML += `<div class="narr-sec">
        <div class="narr-head" style="color:${nc}">
          <span class="narr-stripe" style="background:linear-gradient(180deg,${nc},rgba(240,244,255,0.15))"></span>
          ${esc(line.slice(0, ci))}
        </div>
        <div class="narr-body">${esc(line.slice(ci+1).trim())}</div>
      </div>`
    } else {
      narrativeHTML += `<p style="margin-bottom:.75rem;color:var(--text-dim);font-size:.85rem;line-height:1.85">${esc(line)}</p>`
    }
  }
  if (!narrativeHTML) {
    narrativeHTML = `<p style="color:var(--text-dim);font-size:.85rem">Sin análisis narrativo disponible.</p>`
  }

  // ── Roles ──
  const ROLE_ICONS = ['💾','🧠','📊','🚀','🔍','⚙️']
  let rolesHTML = ''
  d.roleStats.forEach((r, i) => {
    const projPct = d.totalSP > 0 ? Math.round(r.spTotal / d.totalSP * 100) : 0
    rolesHTML += `
    <div class="role-card ao" style="border-color:rgba(${_rgba(r.hex)},0.2)">
      <div class="role-icon" style="background:rgba(${_rgba(r.hex)},0.12)">${ROLE_ICONS[i] ?? '●'}</div>
      <div class="role-label" style="color:${r.hex}">${esc(r.label)}</div>
      <div class="role-desc">${esc(r.desc)}</div>
      <div style="display:flex;align-items:baseline;gap:4px;margin:.75rem 0 0">
        <span class="role-num" style="color:${r.hex}">${r.done}</span>
        <span style="font-size:.72rem;color:var(--text-dim)">/ ${r.total}</span>
      </div>
      <div class="role-bar">
        <div class="role-bar-fill" data-w="${r.pct}%" style="background:linear-gradient(90deg,${r.hex},${r.hex}cc)"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="role-pct" style="color:${r.hex}">${r.pct}%</span>
        ${r.inProgress > 0 ? `<span class="role-ip">▶ ${r.inProgress} activa${r.inProgress>1?'s':''}</span>` : ''}
        ${r.pct === 100 ? '<span style="font-size:.68rem;color:#4ade80">✓ Completo</span>' : ''}
      </div>
      <div class="sp-row">
        <span class="sp-val">${r.spDone}/${r.spTotal}</span> SP ·
        <span style="font-weight:600;color:${r.hex}">${projPct}% del proyecto</span>
      </div>
    </div>`
  })

  // ── Fases ──
  let phasesHTML = ''
  d.phaseStats.forEach(ph => {
    const projPct = d.totalSP > 0 ? Math.round(ph.spTotal / d.totalSP * 100) : 0
    const ipPct   = ph.total > 0 ? Math.round(ph.inProgress / ph.total * 100) : 0
    const badgeCls = ph.pct === 100 ? 'ph-badge ph-badge-ok'
      : ph.inProgress > 0 ? 'ph-badge ph-badge-wip' : 'ph-badge ph-badge-todo'
    const badgeLbl = ph.pct === 100 ? '✓ Completa' : ph.inProgress > 0 ? 'En ejecución' : 'Pendiente'
    phasesHTML += `
    <div class="phase-card ao">
      <div class="ph-header">
        <div>
          <div class="ph-name">
            <span class="ph-dot" style="background:${ph.hex}"></span>
            <span style="color:${ph.hex}">${esc(ph.label)}</span>
          </div>
          <div class="ph-sub">${esc(ph.sub)}</div>
        </div>
        <span class="${badgeCls}">${badgeLbl}</span>
      </div>
      <div class="ph-counts">
        <span style="color:#4ade80;font-weight:600">${ph.done} listas</span>
        ${ph.inProgress > 0 ? `<span style="color:#fbbf24;font-weight:600">${ph.inProgress} activas</span>` : ''}
        ${ph.todo > 0 ? `<span style="color:var(--text-dim)">${ph.todo} pendientes</span>` : ''}
      </div>
      <div class="ph-bar">
        <div class="ph-bar-done" data-w="${ph.pct}%" style="background:${ph.hex}"></div>
        ${ipPct > 0 ? `<div class="ph-bar-ip" data-w="${ipPct}%" style="background:${ph.hex}"></div>` : ''}
      </div>
      <div class="ph-footer">
        <span>${ph.total} tareas · <b>${ph.spDone}/${ph.spTotal} SP</b></span>
        <span style="color:${ph.hex};font-weight:600">${projPct}% del peso</span>
      </div>
    </div>`
  })

  // ── Prioridades ──
  const PRIO_CFG = [
    { hex:'#ef4444', border:'rgba(239,68,68,0.25)' },
    { hex:'#f59e0b', border:'rgba(245,158,11,0.25)' },
    { hex:'#64748b', border:'rgba(100,116,139,0.2)' },
  ]
  let prioHTML = ''
  if (d.priorityStats && d.priorityStats.length > 0) {
    d.priorityStats.forEach((ps, i) => {
      const ppct = ps.total > 0 ? Math.round(ps.pending / ps.total * 100) : 0
      const cfg  = PRIO_CFG[i] ?? PRIO_CFG[2]
      prioHTML += `
      <div class="prio-card ao" style="border-color:${cfg.border}">
        <div class="prio-tag">
          <span class="prio-dot" style="background:${cfg.hex}"></span>
          <span style="color:${cfg.hex}">${esc(ps.label)}</span>
        </div>
        <div class="prio-num" style="color:${cfg.hex}">${ps.pending}</div>
        <div class="prio-of">pendientes de ${ps.total} · <b style="color:var(--white)">${ps.done} listas</b></div>
        <div class="prio-bar">
          <div class="prio-fill" data-w="${ppct}%" style="background:linear-gradient(90deg,${cfg.hex},${cfg.hex}cc)"></div>
        </div>
      </div>`
    })
  } else {
    PRIO_CFG.forEach((cfg, i) => {
      const labels = ['Alta','Media','Baja']
      prioHTML += `
      <div class="prio-card ao" style="border-color:${cfg.border}">
        <div class="prio-tag">
          <span class="prio-dot" style="background:${cfg.hex}"></span>
          <span style="color:${cfg.hex}">${labels[i]}</span>
        </div>
        <div class="prio-num" style="color:${cfg.hex}">—</div>
        <div class="prio-of">Ver tablero para detalle</div>
      </div>`
    })
  }

  // ── Auditoría ──
  let auditHTML = ''
  if (d.audit?.trim()) {
    const sections = parseAuditSections(d.audit)
    let secItems = ''
    for (const s of sections) {
      secItems += `
      <div class="risk-sec">
        <div class="risk-hd" style="color:${s.color}">
          <span class="risk-mk" style="background:${s.color}"></span>${esc(s.heading)}
        </div>
        <div class="risk-txt">${esc(s.body)}</div>
      </div>`
    }
    auditHTML = `
    <section class="ao">
      <div class="sec-eyebrow">Evaluación técnica</div>
      <div class="sec-title">Auditoría de Arquitectura y MLOps</div>
      <div class="risk-card">
        <div class="risk-header">
          <div class="risk-icon">🔬</div>
          <div>
            <div class="risk-title">Informe de Auditoría Técnica</div>
            <div class="risk-sub">Principal Data Architect &amp; MLOps Tech Lead · Documento confidencial</div>
          </div>
        </div>
        <div class="risk-body">${secItems}</div>
      </div>
    </section>`
  }

  // ── Burndown status ──
  const lastPt  = d.burndown[d.burndown.length - 1]
  const burnOk  = lastPt && lastPt.real <= (lastPt.ideal ?? 0) + 1
  const burnDotClr = burnOk ? '#22c55e' : '#ef4444'
  const burnMsg = burnOk
    ? 'El equipo va por debajo del ideal — buen ritmo.'
    : 'El equipo va por encima del ideal — ritmo insuficiente.'

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Informe — ${esc(d.projectName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>${CSS}</style>
</head>
<body>
<div class="wrap">

<!-- ════ HEADER ════ -->
<div class="header ao" style="transition-delay:0s">
  <div class="header-inner">

    <div class="brand-row">
      <div class="logo-mark">${LOGO_SVG}</div>
      <div>
        <div class="brand-name">MCO<span>Y</span></div>
        <div class="brand-sub">AI + Data Strategy</div>
      </div>
      <div class="brand-divider"></div>
      <div class="${pillCls}">
        <span class="status-pill-dot"></span>
        ${pillTxt}
      </div>
    </div>

    <div>
      <div class="report-eyebrow">Informe Ejecutivo · TaskFlow AI</div>
      <div class="report-title">${esc(d.projectName)}</div>
      <div class="report-date">${esc(d.dateRange)} &nbsp;·&nbsp; Generado: ${esc(today)}</div>
    </div>

    <div class="kpi-strip">
      <div class="kpi-cell">
        <div class="kpi-val">${d.pct}%</div>
        <div class="kpi-lbl">Avance tareas</div>
      </div>
      <div class="kpi-cell">
        <div class="kpi-val">${spPct}%</div>
        <div class="kpi-lbl">Avance SP</div>
      </div>
      <div class="kpi-cell">
        <div class="kpi-val">${d.done}/${d.total}</div>
        <div class="kpi-lbl">Tareas</div>
      </div>
      <div class="kpi-cell">
        <div class="kpi-val" style="color:${d.daysLeft === 0 ? 'var(--amber)' : 'inherit'}">${d.daysLeft}</div>
        <div class="kpi-lbl">Días restantes</div>
      </div>
      <div class="kpi-cell">
        <div class="kpi-val">${d.velocityActual}</div>
        <div class="kpi-lbl">Tareas / día</div>
      </div>
    </div>

  </div>
</div>

<!-- ════ ESTADO GENERAL ════ -->
<section class="ao">
  <div class="sec-eyebrow">Resumen</div>
  <div class="sec-title">Estado General del Proyecto</div>
  <div class="card">
    <div class="st-grid">

      <!-- Ring animado -->
      <div class="ring-wrap">
        ${buildRingSVG(d.pct)}
        <div class="ring-label">
          <span class="ring-num" style="color:${pctClr}">${d.pct}%</span>
          <span class="ring-sub">avance</span>
        </div>
      </div>

      <!-- Contadores -->
      <div class="counters">
        <div class="counter c-green">
          <span class="counter-val" data-n="${d.done}">${d.done}</span>
          <span class="counter-lbl">Completadas</span>
        </div>
        <div class="counter c-amber">
          <span class="counter-val" data-n="${d.inProgress}">${d.inProgress}</span>
          <span class="counter-lbl">En progreso</span>
        </div>
        <div class="counter c-slate">
          <span class="counter-val" data-n="${d.todo}">${d.todo}</span>
          <span class="counter-lbl">Por hacer</span>
        </div>
        ${d.overdue > 0 ? `<div class="counter c-red"><span class="counter-val" data-n="${d.overdue}">${d.overdue}</span><span class="counter-lbl">Vencidas</span></div>` : ''}
      </div>

      <!-- Velocidad -->
      <div class="vel-panel">
        <div class="vel-title" style="color:${velClr}">
          ${d.atRisk ? '⚠ Riesgo de entrega' : '✓ Dentro del plazo'}
        </div>
        <div class="vel-grid">
          <div class="vel-item">
            <div class="vel-lbl">Vel. actual</div>
            <div class="vel-val">${d.velocityActual}<span class="vel-unit"> t/d</span></div>
          </div>
          <div class="vel-item">
            <div class="vel-lbl">Vel. req.</div>
            <div class="vel-val" style="color:${velClr}">${velReq}</div>
          </div>
          <div class="vel-item">
            <div class="vel-lbl">Vel. sem.</div>
            <div class="vel-val">${d.velocityWeekly}<span class="vel-unit"> t/s</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Barras duales -->
    <div class="dbar">
      <div class="dbar-row">
        <span class="dbar-lbl">Tareas · ${d.pct}%</span>
        <div class="dbar-track">
          <div class="dbar-fill" data-w="${d.pct}%" style="background:linear-gradient(90deg,var(--blue),var(--blue-lt))"></div>
        </div>
      </div>
      <div class="dbar-row">
        <span class="dbar-lbl">Tiempo · ${d.timePct}%</span>
        <div class="dbar-track">
          <div class="dbar-fill" data-w="${Math.min(d.timePct, 100)}%"
            style="background:${d.timePct > d.pct + 10 ? 'var(--red)' : 'linear-gradient(90deg,var(--blue),var(--blue-lt))'}"></div>
        </div>
      </div>
      <p class="dbar-note">${d.timePct > d.pct + 10
        ? `El tiempo avanza más rápido que las tareas — brecha del ${d.timePct - d.pct}%`
        : 'El ritmo de tareas va alineado con el tiempo transcurrido.'}</p>
    </div>
  </div>
</section>

<!-- ════ ANÁLISIS EJECUTIVO ════ -->
<section class="ao">
  <div class="sec-eyebrow">Narrativa</div>
  <div class="sec-title">Análisis Ejecutivo</div>
  <div class="card">
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1.5rem">
      ${narrativeHTML}
    </div>
  </div>
</section>

<!-- ════ POR ROLES ════ -->
<section class="ao">
  <div class="sec-eyebrow">Equipo</div>
  <div class="sec-title">Distribución por Rol</div>
  <div class="roles-grid">${rolesHTML}</div>
</section>

<!-- ════ POR FASE ════ -->
<section class="ao">
  <div class="sec-eyebrow">Fases</div>
  <div class="sec-title">Progreso por Fase del Proyecto</div>
  <div class="phases-grid">${phasesHTML}</div>
</section>

<!-- ════ BURNDOWN ════ -->
<section class="ao">
  <div class="sec-row">
    <div>
      <div class="sec-eyebrow">Burndown</div>
      <div class="sec-title" style="margin-bottom:0">Tareas Restantes por Semana</div>
    </div>
    <span class="sec-aside">${d.pending} pendientes · ${d.total} total</span>
  </div>
  <div class="card">
    <div class="burndown-note">
      <span class="burndown-dot" style="background:${burnDotClr}"></span>
      ${esc(burnMsg)}
    </div>
    ${buildBurndownSVG(d.burndown, d.total)}
  </div>
</section>

<!-- ════ PRIORIDAD ════ -->
<section class="ao">
  <div class="sec-eyebrow">Prioridad</div>
  <div class="sec-title">Tareas Pendientes por Prioridad</div>
  <div class="prio-grid">${prioHTML}</div>
</section>

${auditHTML}

<!-- ════ FOOTER ════ -->
<div class="footer">
  <div class="footer-logo">
    <div class="logo-mark" style="width:28px;height:28px;border-radius:7px;opacity:0.85">
      <svg viewBox="0 0 300 350" style="width:18px;height:21px">
        <polygon points="150,15 260,78 260,202 150,265 40,202 40,78" fill="none" stroke="#1d70e8" stroke-width="22" stroke-linejoin="round"/>
        <path d="M90,85 L150,140 L210,85" fill="none" stroke="#ffffff" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M150,140 L150,215" fill="none" stroke="#1d70e8" stroke-width="30" stroke-linecap="round"/>
      </svg>
    </div>
    <span class="footer-brand">TaskFlow AI</span>
  </div>
  <span class="footer-meta">${esc(d.projectName)} · ${esc(d.dateRange)}</span>
</div>

</div><!-- /wrap -->

<script>
(function(){
  'use strict';

  function run(){
    /* ── 1. Fade-in-up con IntersectionObserver ── */
    if('IntersectionObserver' in window){
      var fIO=new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          if(e.isIntersecting){
            e.target.style.opacity='1';
            e.target.style.transform='translateY(0)';
            fIO.unobserve(e.target);
          }
        });
      },{threshold:0.07,rootMargin:'0px 0px -20px 0px'});

      document.querySelectorAll('.ao').forEach(function(el,i){
        el.style.opacity='0';
        el.style.transform='translateY(24px)';
        var dd=Math.min(i*0.04,0.32);
        el.style.transition='opacity .7s cubic-bezier(.16,1,.3,1) '+dd+'s,transform .7s cubic-bezier(.16,1,.3,1) '+dd+'s';
        fIO.observe(el);
      });

      /* ── 2. Barras + Ring + Burndown path ── */
      var bIO=new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          if(e.isIntersecting){
            var el=e.target;
            setTimeout(function(){
              el.querySelectorAll('[data-w]').forEach(function(b,j){
                setTimeout(function(){b.style.width=b.getAttribute('data-w');},j*60);
              });
              el.querySelectorAll('[data-off]').forEach(function(b){
                b.style.strokeDashoffset=b.getAttribute('data-off');
              });
            },130);
            bIO.unobserve(el);
          }
        });
      },{threshold:0.15});
      document.querySelectorAll('.card,.role-card,.phase-card,.prio-card,section').forEach(function(el){
        bIO.observe(el);
      });

      /* ── 3. Count-up ── */
      function easeOut(t){return 1-Math.pow(1-t,3);}
      function cUp(el){
        var raw=el.getAttribute('data-n');
        if(raw===null)return;
        var target=parseFloat(raw),isDot=raw.indexOf('.')>-1;
        if(isNaN(target))return;
        if(target===0){el.textContent=isDot?'0.00':'0';return;}
        var dur=900,t0=null;
        function tick(ts){
          if(!t0)t0=ts;
          var p=Math.min(1,(ts-t0)/dur),v=target*easeOut(p);
          el.textContent=isDot?v.toFixed(2):Math.round(v);
          if(p<1)requestAnimationFrame(tick);
          else el.textContent=isDot?target.toFixed(2):String(Math.round(target));
        }
        requestAnimationFrame(tick);
      }
      var nIO=new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          if(e.isIntersecting){
            e.target.querySelectorAll('[data-n]').forEach(cUp);
            nIO.unobserve(e.target);
          }
        });
      },{threshold:0.3});
      document.querySelectorAll('.card,.counters').forEach(function(el){nIO.observe(el);});
    }

    /* ── Fallback inmediato para elementos ya visibles ── */
    setTimeout(function(){
      document.querySelectorAll('[data-w]').forEach(function(el){
        if(el.style.width===''||el.style.width==='0px')
          el.style.width=el.getAttribute('data-w');
      });
      document.querySelectorAll('[data-off]').forEach(function(el){
        if(el.style.strokeDashoffset===''||el.style.strokeDashoffset==='3000')
          el.style.strokeDashoffset=el.getAttribute('data-off');
      });
      document.querySelectorAll('.ao').forEach(function(el){
        if(el.style.opacity==='0'){el.style.opacity='1';el.style.transform='translateY(0)';}
      });
    },380);
  }

  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',run);
  else run();
})();
</script>
</body>
</html>`
}

// ── Utility: hex → "r,g,b" ────────────────────────────────────────────────────
function _rgba(hex: string): string {
  const h = hex.replace('#','')
  if (h.length === 3) {
    return [0,1,2].map(i => parseInt(h[i]+h[i],16)).join(',')
  }
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`
}
