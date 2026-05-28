import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// VOYAGE_API_KEY is set in src/test/setup.ts before this module loads

import {
  buildTaskContent,
  hashContent,
  generateEmbedding,
  generateQueryEmbedding,
  rerank,
} from '../voyage'

// ── buildTaskContent ──────────────────────────────────────────────────────────

describe('buildTaskContent', () => {
  it('returns just the title when description is absent', () => {
    expect(buildTaskContent('My task')).toBe('My task')
  })

  it('returns just the title when description is null', () => {
    expect(buildTaskContent('My task', null)).toBe('My task')
  })

  it('concatenates title and description with double newline', () => {
    expect(buildTaskContent('Title', 'Details here')).toBe('Title\n\nDetails here')
  })
})

// ── hashContent ───────────────────────────────────────────────────────────────

describe('hashContent', () => {
  it('returns a 16-char hex string', async () => {
    const h = await hashContent('test input')
    expect(h).toHaveLength(16)
    expect(h).toMatch(/^[0-9a-f]+$/)
  })

  it('is deterministic for the same input', async () => {
    const a = await hashContent('hello world')
    const b = await hashContent('hello world')
    expect(a).toBe(b)
  })

  it('produces different hashes for different inputs', async () => {
    const a = await hashContent('input A')
    const b = await hashContent('input B')
    expect(a).not.toBe(b)
  })
})

// ── generateEmbedding / generateQueryEmbedding ────────────────────────────────

const MOCK_EMBEDDING = new Array(512).fill(0.1)

function mockFetchOk(embedding = MOCK_EMBEDDING) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [{ embedding }] }),
  } as Response)
}

function mockFetchError(status = 500, body = 'Internal Server Error') {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: async () => body,
  } as unknown as Response)
}

describe('generateEmbedding', () => {
  beforeEach(() => { global.fetch = mockFetchOk() })
  afterEach(() => { vi.restoreAllMocks() })

  it('returns a numeric array', async () => {
    const emb = await generateEmbedding('hello')
    expect(Array.isArray(emb)).toBe(true)
    expect(emb).toHaveLength(512)
  })

  it('calls Voyage with input_type=document', async () => {
    await generateEmbedding('doc text')
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string)
    expect(body.input_type).toBe('document')
    expect(body.model).toBe('voyage-3-lite')
  })

  it('throws on API error', async () => {
    global.fetch = mockFetchError(429)
    await expect(generateEmbedding('text')).rejects.toThrow('Voyage embed error')
  })

  it('throws when response has unexpected shape', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),   // no embedding inside
    } as Response)
    await expect(generateEmbedding('text')).rejects.toThrow()
  })
})

describe('generateQueryEmbedding', () => {
  beforeEach(() => { global.fetch = mockFetchOk() })
  afterEach(() => { vi.restoreAllMocks() })

  it('calls Voyage with input_type=query', async () => {
    await generateQueryEmbedding('search query')
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string)
    expect(body.input_type).toBe('query')
  })
})

// ── rerank ────────────────────────────────────────────────────────────────────

describe('rerank', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('returns empty array for empty documents', async () => {
    const result = await rerank('query', [])
    expect(result).toEqual([])
    // fetch should NOT be called
  })

  it('returns ranked results from Voyage', async () => {
    const mockData = [
      { index: 2, relevance_score: 0.95 },
      { index: 0, relevance_score: 0.72 },
    ]
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockData }),
    } as Response)

    const result = await rerank('query', ['doc0', 'doc1', 'doc2'], 2)
    expect(result).toHaveLength(2)
    expect(result[0].index).toBe(2)
    expect(result[0].relevance_score).toBeCloseTo(0.95)
  })

  it('passes top_k and model to the request', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response)

    await rerank('my query', ['doc1', 'doc2'], 3)
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string)
    expect(body.top_k).toBe(3)
    expect(body.model).toBe('rerank-2-lite')
    expect(body.query).toBe('my query')
  })

  it('throws on Voyage rerank error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'error',
    } as unknown as Response)

    await expect(rerank('query', ['doc1'])).rejects.toThrow('Voyage rerank error')
  })
})
