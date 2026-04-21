import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTask, moveTask, updateTask, deleteTask } from '../task.actions'

// ─── Next.js stubs ───────────────────────────────────────────────────────────
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

// ─── HMAC stub (triggerEmbedding dynamic import) ──────────────────────────────
vi.mock('@/lib/hmac', () => ({
  signRequest: vi.fn().mockResolvedValue({
    'x-hmac-signature': 'mock-sig',
    'x-timestamp': '0',
  }),
}))

// ─── Global fetch stub (fire-and-forget embedding trigger) ───────────────────
global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response)
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

// ─── Supabase mock ───────────────────────────────────────────────────────────
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
const mockedCreateClient = vi.mocked(createClient)

/**
 * Builds a Supabase query builder mock.
 * Every chain method returns itself so any call order is supported.
 * The chain is also thenable (await-able), resolving to `result`.
 * `single()` resolves to `result` as well.
 */
function makeChain<T>(result: T) {
  type Chain = Record<string, unknown> & PromiseLike<T>

  const chain = {
    then: (
      onFulfilled?: ((v: T) => unknown) | null,
      onRejected?: ((r: unknown) => unknown) | null
    ) => Promise.resolve(result).then(onFulfilled, onRejected ?? undefined),
    single: vi.fn().mockResolvedValue(result),
  } as Chain

  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit']) {
    ;(chain as Record<string, unknown>)[method] = vi.fn(() => chain)
  }

  return chain
}

/** Authenticated user fixture */
const USER = { id: 'user-123' }

function mockClient(fromSequence: ReturnType<typeof makeChain>[]) {
  let call = 0
  mockedCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: USER }, error: null }),
    },
    from: vi.fn(() => fromSequence[call++]),
  } as never)
}

// ─────────────────────────────────────────────────────────────────────────────

describe('createTask', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns success with the new task id', async () => {
    mockClient([
      makeChain({ data: null, error: null }),                       // max position query
      makeChain({ data: { id: 'task-abc' }, error: null }),         // insert
    ])

    const result = await createTask({ title: 'Nueva tarea', status: 'todo', priority: 'medium' })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.id).toBe('task-abc')
  })

  it('calculates position as maxPos + 1000', async () => {
    const fromMock = vi.fn()
      .mockReturnValueOnce(makeChain({ data: { position: 3000 }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { id: 'task-xyz' }, error: null }))

    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: USER }, error: null }) },
      from: fromMock,
    } as never)

    await createTask({ title: 'Tarea con posición', status: 'todo', priority: 'high' })

    // The insert chain receives position = 3000 + 1000 = 4000
    const insertArg = fromMock.mock.results[1].value
    expect(insertArg.insert).toHaveBeenCalledWith(
      expect.objectContaining({ position: 4000, user_id: USER.id })
    )
  })

  it('returns validation error when title is empty', async () => {
    const result = await createTask({ title: '', status: 'todo', priority: 'medium' })
    expect(result.success).toBe(false)
    expect((result as { success: false; error: string }).error).toBeTruthy()
    // Supabase is never called
    expect(mockedCreateClient).not.toHaveBeenCalled()
  })

  it('returns error when supabase insert fails', async () => {
    mockClient([
      makeChain({ data: null, error: null }),
      makeChain({ data: null, error: { message: 'unique violation' } }),
    ])

    const result = await createTask({ title: 'Duplicada', status: 'todo', priority: 'low' })
    expect(result.success).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('moveTask', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns success when task is moved', async () => {
    mockClient([makeChain({ error: null })])

    const result = await moveTask({ id: crypto.randomUUID(), status: 'in_progress', position: 2000 })
    expect(result.success).toBe(true)
  })

  it('returns validation error for invalid UUID', async () => {
    const result = await moveTask({ id: 'not-a-uuid', status: 'done', position: 1000 })
    expect(result.success).toBe(false)
  })

  it('returns error when supabase update fails', async () => {
    mockClient([makeChain({ error: { message: 'row not found' } })])

    const result = await moveTask({ id: crypto.randomUUID(), status: 'done', position: 1000 })
    expect(result.success).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('updateTask', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns success when task is updated', async () => {
    mockClient([makeChain({ error: null })])

    const result = await updateTask({ id: crypto.randomUUID(), priority: 'high' })
    expect(result.success).toBe(true)
  })

  it('triggers re-embedding when title changes', async () => {
    const taskId = crypto.randomUUID()
    mockClient([
      makeChain({ error: null }),                                                      // update
      makeChain({ data: { title: 'Nuevo título', description: null }, error: null }), // re-fetch
    ])

    await updateTask({ id: taskId, title: 'Nuevo título' })

    // triggerEmbedding is fire-and-forget — wait for it to settle
    await vi.waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/embed'),
        expect.objectContaining({ method: 'POST' })
      )
    }, { timeout: 2_000 })
  })

  it('returns validation error for invalid UUID', async () => {
    const result = await updateTask({ id: 'bad-id', title: 'Test' })
    expect(result.success).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('deleteTask', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns success when task is deleted', async () => {
    mockClient([makeChain({ error: null })])

    const result = await deleteTask(crypto.randomUUID())
    expect(result.success).toBe(true)
  })

  it('returns error when supabase delete fails', async () => {
    mockClient([makeChain({ error: { message: 'not found' } })])

    const result = await deleteTask(crypto.randomUUID())
    expect(result.success).toBe(false)
  })
})
