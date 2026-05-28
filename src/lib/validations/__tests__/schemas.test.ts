import { describe, it, expect } from 'vitest'
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  MoveTaskSchema,
} from '../task.schema'
import { SignInSchema, SignUpSchema } from '../auth.schema'

// ── CreateTaskSchema ──────────────────────────────────────────────────────────

describe('CreateTaskSchema', () => {
  it('accepts a minimal valid input', () => {
    const r = CreateTaskSchema.safeParse({ title: 'My task', status: 'todo', priority: 'medium' })
    expect(r.success).toBe(true)
  })

  it('rejects empty title', () => {
    const r = CreateTaskSchema.safeParse({ title: '', status: 'todo', priority: 'medium' })
    expect(r.success).toBe(false)
  })

  it('rejects title longer than 200 chars', () => {
    const r = CreateTaskSchema.safeParse({ title: 'a'.repeat(201), status: 'todo', priority: 'medium' })
    expect(r.success).toBe(false)
  })

  it('rejects invalid status', () => {
    const r = CreateTaskSchema.safeParse({ title: 'T', status: 'unknown', priority: 'medium' })
    expect(r.success).toBe(false)
  })

  it('rejects invalid priority', () => {
    const r = CreateTaskSchema.safeParse({ title: 'T', status: 'todo', priority: 'urgent' })
    expect(r.success).toBe(false)
  })

  it('accepts optional description', () => {
    const r = CreateTaskSchema.safeParse({ title: 'T', status: 'todo', priority: 'high', description: 'details' })
    expect(r.success).toBe(true)
  })

  it('rejects description longer than 2000 chars', () => {
    const r = CreateTaskSchema.safeParse({ title: 'T', status: 'todo', priority: 'high', description: 'x'.repeat(2001) })
    expect(r.success).toBe(false)
  })

  it('accepts null due_date', () => {
    const r = CreateTaskSchema.safeParse({ title: 'T', status: 'todo', priority: 'low', due_date: null })
    expect(r.success).toBe(true)
  })

  it('rejects non-ISO due_date string', () => {
    const r = CreateTaskSchema.safeParse({ title: 'T', status: 'todo', priority: 'low', due_date: '2025-01-15' })
    expect(r.success).toBe(false)
  })

  it('accepts a valid ISO datetime for due_date', () => {
    const r = CreateTaskSchema.safeParse({ title: 'T', status: 'todo', priority: 'low', due_date: '2025-01-15T00:00:00.000Z' })
    expect(r.success).toBe(true)
  })

  it('applies default status=todo when omitted', () => {
    const r = CreateTaskSchema.safeParse({ title: 'T', priority: 'low' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.status).toBe('todo')
  })

  it('applies default priority=medium when omitted', () => {
    const r = CreateTaskSchema.safeParse({ title: 'T' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.priority).toBe('medium')
  })
})

// ── UpdateTaskSchema ──────────────────────────────────────────────────────────

describe('UpdateTaskSchema', () => {
  const validId = crypto.randomUUID()

  it('accepts a partial update with only id', () => {
    const r = UpdateTaskSchema.safeParse({ id: validId })
    expect(r.success).toBe(true)
  })

  it('accepts updating a single field', () => {
    const r = UpdateTaskSchema.safeParse({ id: validId, priority: 'high' })
    expect(r.success).toBe(true)
  })

  it('rejects non-UUID id', () => {
    const r = UpdateTaskSchema.safeParse({ id: 'not-a-uuid', title: 'Test' })
    expect(r.success).toBe(false)
  })

  it('rejects when id is missing', () => {
    const r = UpdateTaskSchema.safeParse({ title: 'Test' })
    expect(r.success).toBe(false)
  })

  it('rejects invalid status in partial update', () => {
    const r = UpdateTaskSchema.safeParse({ id: validId, status: 'archived' })
    expect(r.success).toBe(false)
  })
})

// ── MoveTaskSchema ────────────────────────────────────────────────────────────

describe('MoveTaskSchema', () => {
  const validId = crypto.randomUUID()

  it('accepts a valid move', () => {
    const r = MoveTaskSchema.safeParse({ id: validId, status: 'done', position: 2000 })
    expect(r.success).toBe(true)
  })

  it('rejects non-UUID id', () => {
    const r = MoveTaskSchema.safeParse({ id: 'bad', status: 'todo', position: 1000 })
    expect(r.success).toBe(false)
  })

  it('rejects negative position', () => {
    const r = MoveTaskSchema.safeParse({ id: validId, status: 'todo', position: -1 })
    expect(r.success).toBe(false)
  })

  it('rejects non-integer position', () => {
    const r = MoveTaskSchema.safeParse({ id: validId, status: 'todo', position: 1.5 })
    expect(r.success).toBe(false)
  })

  it('rejects invalid status', () => {
    const r = MoveTaskSchema.safeParse({ id: validId, status: 'wip', position: 1000 })
    expect(r.success).toBe(false)
  })
})

// ── SignInSchema ──────────────────────────────────────────────────────────────

describe('SignInSchema', () => {
  it('accepts valid credentials', () => {
    const r = SignInSchema.safeParse({ email: 'user@example.com', password: 'password123' })
    expect(r.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const r = SignInSchema.safeParse({ email: 'not-an-email', password: 'password123' })
    expect(r.success).toBe(false)
  })

  it('rejects password shorter than 8 chars', () => {
    const r = SignInSchema.safeParse({ email: 'user@example.com', password: '1234567' })
    expect(r.success).toBe(false)
  })

  it('rejects missing fields', () => {
    expect(SignInSchema.safeParse({}).success).toBe(false)
    expect(SignInSchema.safeParse({ email: 'a@b.com' }).success).toBe(false)
  })
})

// ── SignUpSchema ──────────────────────────────────────────────────────────────

describe('SignUpSchema', () => {
  const base = {
    email: 'user@example.com',
    password: 'securepassword',
    password_confirm: 'securepassword',
    full_name: 'Test User',
  }

  it('accepts a valid registration', () => {
    expect(SignUpSchema.safeParse(base).success).toBe(true)
  })

  it('rejects when passwords do not match', () => {
    const r = SignUpSchema.safeParse({ ...base, password_confirm: 'differentpass' })
    expect(r.success).toBe(false)
    if (!r.success) {
      const paths = r.error.issues.map(i => i.path[0])
      expect(paths).toContain('password_confirm')
    }
  })

  it('rejects full_name shorter than 2 chars', () => {
    const r = SignUpSchema.safeParse({ ...base, full_name: 'A' })
    expect(r.success).toBe(false)
  })

  it('rejects full_name longer than 100 chars', () => {
    const r = SignUpSchema.safeParse({ ...base, full_name: 'A'.repeat(101) })
    expect(r.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const r = SignUpSchema.safeParse({ ...base, email: 'bad-email' })
    expect(r.success).toBe(false)
  })
})
