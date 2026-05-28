import { describe, it, expect } from 'vitest'
import {
  parseUTCDate,
  buildWeeks,
  calculateVelocity,
  detectRisk,
  calculateBurndown,
  computeMetrics,
} from '../metrics'
import type { TaskRow, PhaseRow } from '../metrics'

// ── parseUTCDate ──────────────────────────────────────────────────────────────

describe('parseUTCDate', () => {
  it('parses a YYYY-MM-DD string into a UTC midnight Date', () => {
    const d = parseUTCDate('2025-03-15')
    expect(d.getUTCFullYear()).toBe(2025)
    expect(d.getUTCMonth()).toBe(2)   // March = index 2
    expect(d.getUTCDate()).toBe(15)
    expect(d.getUTCHours()).toBe(0)
  })

  it('handles January (month 1) without off-by-one', () => {
    const d = parseUTCDate('2025-01-01')
    expect(d.getUTCMonth()).toBe(0)
    expect(d.getUTCDate()).toBe(1)
  })
})

// ── buildWeeks ────────────────────────────────────────────────────────────────

describe('buildWeeks', () => {
  it('builds one entry per week between two dates', () => {
    const start = parseUTCDate('2025-01-01')
    // Loop checks cur <= end BEFORE adding 7 days, so Jan 22 fires one more iteration (S4 ends Jan 29)
    const end   = parseUTCDate('2025-01-21')   // 3 full weeks: S1→08, S2→15, S3→22 (cur=22 > 21, stops)
    const weeks = buildWeeks(start, end)
    expect(weeks).toHaveLength(3)
    expect(weeks[0].label).toBe('S1')
    expect(weeks[2].label).toBe('S3')
  })

  it('labels are sequential (S1, S2, ...)', () => {
    const start = parseUTCDate('2025-01-01')
    const end   = parseUTCDate('2025-03-01')
    const weeks = buildWeeks(start, end)
    weeks.forEach((w, i) => expect(w.label).toBe(`S${i + 1}`))
  })

  it('caps at 20 weeks for very long projects', () => {
    const start = parseUTCDate('2025-01-01')
    const end   = parseUTCDate('2027-01-01')   // 2 years
    const weeks = buildWeeks(start, end)
    expect(weeks.length).toBeLessThanOrEqual(20)
  })

  it('returns exactly one week when deliveryDate equals startDate (loop fires once)', () => {
    const d = parseUTCDate('2025-01-01')
    const weeks = buildWeeks(d, d)
    expect(weeks).toHaveLength(1)
  })

  it('each week.end is the ISO date at the end of that week', () => {
    const start = parseUTCDate('2025-01-01')
    const end   = parseUTCDate('2025-01-08')
    const [week1] = buildWeeks(start, end)
    expect(week1.end).toBe('2025-01-08')
  })
})

// ── calculateVelocity ─────────────────────────────────────────────────────────

describe('calculateVelocity', () => {
  it('returns done / daysElapsed', () => {
    expect(calculateVelocity(20, 10)).toBeCloseTo(2)
  })

  it('returns 0 when daysElapsed is 0', () => {
    expect(calculateVelocity(5, 0)).toBe(0)
  })

  it('returns 0 when done is 0', () => {
    expect(calculateVelocity(0, 30)).toBe(0)
  })
})

// ── detectRisk ────────────────────────────────────────────────────────────────

describe('detectRisk', () => {
  it('is at risk when required velocity > actual', () => {
    expect(detectRisk(1.0, 2.0)).toBe(true)
  })

  it('is not at risk when actual >= required', () => {
    expect(detectRisk(2.0, 1.0)).toBe(false)
    expect(detectRisk(1.5, 1.5)).toBe(false)
  })

  it('is not at risk when required velocity is 0', () => {
    expect(detectRisk(0, 0)).toBe(false)
  })

  it('is not at risk when actual is also 0 but required is 0', () => {
    expect(detectRisk(0, 0)).toBe(false)
  })
})

// ── calculateBurndown ─────────────────────────────────────────────────────────

describe('calculateBurndown', () => {
  const total = 10
  const weeks = [
    { label: 'S1', end: '2025-01-08' },
    { label: 'S2', end: '2025-01-15' },
    { label: 'S3', end: '2025-01-22' },
  ]

  const makeTasks = (count: number, dueDate: string): TaskRow[] =>
    Array.from({ length: count }, () => ({
      status: 'done' as const,
      priority: 'medium' as const,
      due_date: dueDate,
      created_at: '2025-01-01T00:00:00Z',
    }))

  it('returns one point per week', () => {
    const bd = calculateBurndown([], weeks, total)
    expect(bd).toHaveLength(3)
  })

  it('real starts at total when nothing is done', () => {
    const bd = calculateBurndown([], weeks, total)
    expect(bd[0].real).toBe(total)
  })

  it('real decreases as tasks are completed', () => {
    const tasks: TaskRow[] = [
      ...makeTasks(3, '2025-01-07'),   // done before S1
      ...makeTasks(2, '2025-01-14'),   // done before S2
    ]
    const bd = calculateBurndown(tasks, weeks, total)
    expect(bd[0].real).toBe(7)   // 10 - 3
    expect(bd[1].real).toBe(5)   // 10 - 5
    expect(bd[2].real).toBe(5)   // no change in S3
  })

  it('ideal is never negative', () => {
    const bd = calculateBurndown([], weeks, total)
    bd.forEach(p => expect(p.ideal).toBeGreaterThanOrEqual(0))
  })

  it('ideal follows a linear decay from total to 0', () => {
    const bd = calculateBurndown([], weeks, total)
    expect(bd[2].ideal).toBe(0)     // last week should reach 0
    expect(bd[0].ideal).toBeGreaterThan(bd[1].ideal)
  })

  it('tasks without due_date are not counted as completed', () => {
    const tasks: TaskRow[] = [{ status: 'done', priority: 'medium', due_date: null, created_at: '2025-01-01T00:00:00Z' }]
    const bd = calculateBurndown(tasks, weeks, total)
    expect(bd[0].real).toBe(total)
  })
})

// ── computeMetrics ────────────────────────────────────────────────────────────

describe('computeMetrics', () => {
  const startDate  = parseUTCDate('2025-01-01')
  const endDate    = parseUTCDate('2025-04-01')
  const todayUTC   = parseUTCDate('2025-02-01')  // 31 days elapsed, ~59 days left

  const tasks: TaskRow[] = [
    { status: 'done',        priority: 'high',   due_date: '2025-01-20', created_at: '2025-01-01T00:00:00Z' },
    { status: 'done',        priority: 'medium', due_date: '2025-01-25', created_at: '2025-01-01T00:00:00Z' },
    { status: 'in_progress', priority: 'high',   due_date: '2025-01-15', created_at: '2025-01-01T00:00:00Z' },
    { status: 'todo',        priority: 'low',    due_date: null,         created_at: '2025-01-01T00:00:00Z' },
    { status: 'todo',        priority: 'medium', due_date: '2025-03-01', created_at: '2025-01-01T00:00:00Z' },
  ]

  const phases: PhaseRow[] = [
    { name: 'Bronze', total: 6, done: 6, color: '#cd7f32', sort_order: 1 },
    { name: 'Silver', total: 6, done: 3, color: '#94a3b8', sort_order: 2 },
  ]

  it('counts task statuses correctly', () => {
    const m = computeMetrics(tasks, phases, startDate, endDate, todayUTC)
    expect(m.total).toBe(5)
    expect(m.done).toBe(2)
    expect(m.inProgress).toBe(1)
    expect(m.todo).toBe(2)
  })

  it('computes pct as done/total * 100 rounded', () => {
    const m = computeMetrics(tasks, phases, startDate, endDate, todayUTC)
    expect(m.pct).toBe(40)   // 2/5 = 40%
  })

  it('counts overdue tasks (due past today, not done)', () => {
    const m = computeMetrics(tasks, phases, startDate, endDate, todayUTC)
    // in_progress task due 2025-01-15 is past todayUTC 2025-02-01
    expect(m.overdue).toBe(1)
  })

  it('daysElapsed is at least 1', () => {
    const m = computeMetrics(tasks, phases, startDate, endDate, todayUTC)
    expect(m.daysElapsed).toBeGreaterThanOrEqual(1)
  })

  it('daysLeft is 0 when past the deadline', () => {
    const past = parseUTCDate('2026-01-01')
    const m = computeMetrics(tasks, phases, startDate, endDate, past)
    expect(m.daysLeft).toBe(0)
  })

  it('velocityRequired is N/A when daysLeft is 0', () => {
    const past = parseUTCDate('2026-01-01')
    const m = computeMetrics(tasks, phases, startDate, endDate, past)
    expect(m.velocityRequired).toBe('N/A')
  })

  it('velocityWeekly is 0 when less than one week has elapsed', () => {
    const almostOneWeek = parseUTCDate('2025-01-05')
    const m = computeMetrics(tasks, phases, startDate, endDate, almostOneWeek)
    expect(m.velocityWeekly).toBe('0')
  })

  it('phaseReal adds pct to each phase', () => {
    const m = computeMetrics(tasks, phases, startDate, endDate, todayUTC)
    expect(m.phaseReal[0].pct).toBe(100)  // 6/6
    expect(m.phaseReal[1].pct).toBe(50)   // 3/6
  })

  it('phaseReal pct is 0 when phase.total is 0', () => {
    const emptyPhases: PhaseRow[] = [{ name: 'Empty', total: 0, done: 0, color: '#000', sort_order: 1 }]
    const m = computeMetrics([], emptyPhases, startDate, endDate, todayUTC)
    expect(m.phaseReal[0].pct).toBe(0)
  })

  it('builds burndown with one point per week', () => {
    const m = computeMetrics(tasks, phases, startDate, endDate, todayUTC)
    expect(m.burndown.length).toBeGreaterThan(0)
    expect(m.burndown[0]).toHaveProperty('label')
    expect(m.burndown[0]).toHaveProperty('real')
    expect(m.burndown[0]).toHaveProperty('ideal')
  })

  it('pct is 0 when there are no tasks', () => {
    const m = computeMetrics([], [], startDate, endDate, todayUTC)
    expect(m.pct).toBe(0)
    expect(m.total).toBe(0)
  })
})
