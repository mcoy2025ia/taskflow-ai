import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/ai/voyage', () => ({
  generateQueryEmbedding: vi.fn().mockResolvedValue(new Array(512).fill(0.1)),
  rerank: vi.fn(),
  buildTaskContent: vi.fn((title: string, desc?: string | null) => desc ? `${title}\n\n${desc}` : title),
}))

import {
  buildContextBlock,
  buildSystemPrompt,
  searchTasksByQuery,
  type TaskSearchResult,
} from '../rag'
import { createClient } from '@/lib/supabase/server'
import { rerank } from '@/lib/ai/voyage'

const mockedCreateClient = vi.mocked(createClient)
const mockedRerank       = vi.mocked(rerank)

// ── helpers ───────────────────────────────────────────────────────────────────

function makeResult(overrides: Partial<TaskSearchResult> = {}): TaskSearchResult {
  return {
    task_id:     'task-1',
    title:       'Build API endpoint',
    description: null,
    status:      'todo',
    priority:    'medium',
    similarity:  0.85,
    ...overrides,
  }
}

type ChainResult = { data: unknown; error: unknown }
function makeChain(result: ChainResult) {
  const chain: Record<string, unknown> = {
    then: (onFulfilled?: (v: ChainResult) => unknown) =>
      Promise.resolve(result).then(onFulfilled),
    single: vi.fn().mockResolvedValue(result),
  }
  for (const m of ['select', 'eq', 'is', 'in', 'order', 'limit', 'rpc']) {
    chain[m] = vi.fn(() => chain)
  }
  return chain
}

function mockSupabase(fromResults: ReturnType<typeof makeChain>[], rpcResult?: ChainResult) {
  let call = 0
  mockedCreateClient.mockResolvedValue({
    from: vi.fn(() => fromResults[call++]),
    rpc: rpcResult
      ? vi.fn().mockResolvedValue(rpcResult)
      : vi.fn().mockResolvedValue({ data: [], error: null }),
  } as never)
}

// ── buildContextBlock ─────────────────────────────────────────────────────────

describe('buildContextBlock', () => {
  it('returns a no-results message when the array is empty', () => {
    const block = buildContextBlock([])
    expect(block).toContain('No encontré tareas')
  })

  it('includes the task title and number prefix', () => {
    const block = buildContextBlock([makeResult({ title: 'Fix login bug' })])
    expect(block).toContain('[1]')
    expect(block).toContain('Fix login bug')
  })

  it('shows status and priority labels in Spanish', () => {
    const block = buildContextBlock([makeResult({ status: 'in_progress', priority: 'high' })])
    expect(block).toContain('En progreso')
    expect(block).toContain('alta')
  })

  it('includes description when present', () => {
    const block = buildContextBlock([makeResult({ description: 'Fix the auth flow' })])
    expect(block).toContain('Fix the auth flow')
  })

  it('includes relevance percentage', () => {
    const block = buildContextBlock([makeResult({ similarity: 0.9 })])
    expect(block).toContain('90%')
  })

  it('numbers multiple tasks sequentially', () => {
    const tasks = [makeResult({ task_id: '1' }), makeResult({ task_id: '2', title: 'Second task' })]
    const block = buildContextBlock(tasks)
    expect(block).toContain('[1]')
    expect(block).toContain('[2]')
    expect(block).toContain('Second task')
  })

  it('truncates description at 200 chars', () => {
    const block = buildContextBlock([makeResult({ description: 'x'.repeat(300) })])
    expect(block).toContain('x'.repeat(200))
    expect(block).not.toContain('x'.repeat(201))
  })
})

// ── buildSystemPrompt ─────────────────────────────────────────────────────────

describe('buildSystemPrompt', () => {
  it('returns a string containing the context block', () => {
    const prompt = buildSystemPrompt('Context: task 1')
    expect(prompt).toContain('Context: task 1')
  })

  it('text mode includes markdown and PM instructions', () => {
    const prompt = buildSystemPrompt('ctx', false)
    expect(prompt).toContain('MODO TEXTO')
    expect(prompt).toContain('[1]')
  })

  it('voice mode forbids markdown and limits response length', () => {
    const prompt = buildSystemPrompt('ctx', true)
    expect(prompt).toContain('MODO VOZ')
    expect(prompt).toContain('2-3 oraciones')
  })

  it('includes project summary when provided', () => {
    const project = {
      total: 50, done: 25, in_progress: 5, todo: 20, overdue: 3,
      daysLeft: 30, deliveryDate: '15 de mayo de 2025',
    }
    const prompt = buildSystemPrompt('ctx', false, project)
    expect(prompt).toContain('50')
    expect(prompt).toContain('30')
    expect(prompt).toContain('15 de mayo de 2025')
  })

  it('omits RESUMEN section when project is undefined', () => {
    const prompt = buildSystemPrompt('ctx')
    expect(prompt).not.toContain('RESUMEN DEL PROYECTO')
  })
})

// ── searchTasksByQuery ────────────────────────────────────────────────────────

describe('searchTasksByQuery', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns empty array when userId is missing', async () => {
    const result = await searchTasksByQuery('query', {})
    expect(result).toEqual([])
  })

  it('runs pure semantic search when there is no structural intent', async () => {
    const semanticTasks = [makeResult({ task_id: 'sem-1' })]
    mockSupabase(
      [makeChain({ data: [{ id: 'sem-1' }], error: null })],
      { data: semanticTasks, error: null }
    )
    mockedRerank.mockResolvedValue([{ index: 0, relevance_score: 0.9 }])

    const result = await searchTasksByQuery('how is the project going', { userId: 'u1' })
    expect(result).toHaveLength(1)
    expect(result[0].task_id).toBe('sem-1')
  })

  it('runs hybrid search when a status intent is detected (en progreso)', async () => {
    // searchTasksByFilter maps t.id (DB row shape), not t.task_id
    const dbRows = [{ id: 'str-1', title: 'En progreso task', description: null, status: 'in_progress', priority: 'medium' }]
    mockedCreateClient
      .mockResolvedValueOnce({
        from: vi.fn(() => makeChain({ data: dbRows, error: null })),
        rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as never)
      .mockResolvedValueOnce({
        from: vi.fn(() => makeChain({ data: [], error: null })),
        rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as never)

    const result = await searchTasksByQuery('tareas en progreso', { userId: 'u1' })
    expect(result.some(t => t.task_id === 'str-1')).toBe(true)
  })

  it('returns candidates directly when there are <= RERANK_FINAL (5) results', async () => {
    const tasks = [makeResult({ task_id: 'only-one' })]
    mockSupabase(
      [makeChain({ data: [{ id: 'only-one' }], error: null })],
      { data: tasks, error: null }
    )
    // rerank should NOT be called

    await searchTasksByQuery('anything', { userId: 'u1' })
    expect(mockedRerank).not.toHaveBeenCalled()
  })

  it('falls back gracefully when rerank throws', async () => {
    // Return 6+ candidates so rerank is attempted
    const manyTasks = Array.from({ length: 6 }, (_, i) => makeResult({ task_id: `t${i}` }))
    mockSupabase(
      [makeChain({ data: manyTasks.map(task => ({ id: task.task_id })), error: null })],
      { data: manyTasks, error: null }
    )
    mockedRerank.mockRejectedValue(new Error('Voyage unavailable'))

    const result = await searchTasksByQuery('query', { userId: 'u1' })
    expect(result).toHaveLength(5)   // fallback slice(0,5)
  })
})
