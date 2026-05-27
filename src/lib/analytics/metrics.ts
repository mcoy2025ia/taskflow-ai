export interface TaskRow {
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  due_date: string | null
  created_at: string
  title?: string         // opcional — usado por el auditor de arquitectura
}

export interface PhaseRow {
  name: string
  total: number
  done: number
  color: string
  sort_order: number
}

export interface WeekEntry {
  label: string
  end: string
}

export interface BurndownPoint {
  label: string
  real: number
  ideal: number
}

export interface PhaseWithPct extends PhaseRow {
  pct: number
}

export interface AnalyticsMetrics {
  total: number
  done: number
  inProgress: number
  todo: number
  pct: number
  overdue: number
  pending: number
  daysElapsed: number
  daysLeft: number
  totalDays: number
  velocityActual: string
  velocityRequired: string
  velocityWeekly: string
  atRisk: boolean
  burndown: BurndownPoint[]
  phaseReal: PhaseWithPct[]
  weeks: WeekEntry[]
}

// ── Pure functions (no side-effects, fully testable) ──────────────────────────

export function buildWeeks(startDate: Date, deliveryDate: Date): WeekEntry[] {
  const weeks: WeekEntry[] = []
  const cur = new Date(startDate)
  let i = 1
  while (cur <= deliveryDate && i <= 20) {
    cur.setDate(cur.getDate() + 7)
    weeks.push({ label: `S${i++}`, end: cur.toISOString().slice(0, 10) })
  }
  return weeks
}

export function calculateBurndown(
  tasks: TaskRow[],
  weeks: WeekEntry[],
  total: number,
): BurndownPoint[] {
  return weeks.map((w, i) => {
    const endDate = new Date(w.end)
    const completedByWeek = tasks.filter(
      t => t.status === 'done' && t.due_date && new Date(t.due_date) <= endDate
    ).length
    return {
      label: w.label,
      real: total - completedByWeek,
      ideal: Math.max(0, Math.round(total - (total / weeks.length) * (i + 1))),
    }
  })
}

export function calculateVelocity(done: number, daysElapsed: number): number {
  return daysElapsed > 0 ? done / daysElapsed : 0
}

export function detectRisk(velocityActual: number, velocityRequired: number): boolean {
  return velocityRequired > 0 && velocityRequired > velocityActual
}

export function parseUTCDate(raw: string): Date {
  const [y, m, d] = raw.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function computeMetrics(
  tasks: TaskRow[],
  phases: PhaseRow[],
  startDate: Date,
  endDate: Date,
  todayUTC: Date,
): AnalyticsMetrics {
  const total = tasks.length
  const done = tasks.filter(t => t.status === 'done').length
  const inProgress = tasks.filter(t => t.status === 'in_progress').length
  const todo = tasks.filter(t => t.status === 'todo').length
  const pct = total > 0 ? Math.round(done / total * 100) : 0
  const overdue = tasks.filter(
    t => t.due_date && new Date(t.due_date) < todayUTC && t.status !== 'done'
  ).length

  const totalDays   = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000)
  // daysElapsed se capa a totalDays para evitar timePct > 100% cuando el proyecto está vencido
  const daysElapsed = Math.min(
    Math.max(totalDays, 1),
    Math.max(1, Math.floor((todayUTC.getTime() - startDate.getTime()) / 86400000))
  )
  const daysLeft = Math.max(0, Math.floor((endDate.getTime() - todayUTC.getTime()) / 86400000))
  const pending = inProgress + todo

  const velActual = calculateVelocity(done, daysElapsed)
  const velRequired = daysLeft > 0 ? pending / daysLeft : 0
  const weeksElapsed = Math.floor(daysElapsed / 7)

  const weeks = buildWeeks(startDate, endDate)
  const burndown = calculateBurndown(tasks, weeks, total)
  const phaseReal: PhaseWithPct[] = phases.map(ph => ({
    ...ph,
    pct: ph.total > 0 ? Math.round(ph.done / ph.total * 100) : 0,
  }))

  return {
    total, done, inProgress, todo, pct, overdue, pending,
    daysElapsed, daysLeft, totalDays,
    velocityActual: velActual.toFixed(2),
    velocityRequired: daysLeft > 0 ? velRequired.toFixed(2) : 'N/A',
    velocityWeekly: weeksElapsed > 0 ? (done / weeksElapsed).toFixed(1) : '0',
    atRisk: detectRisk(velActual, velRequired),
    burndown, phaseReal, weeks,
  }
}
