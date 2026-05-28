import { describe, it, expect, vi } from 'vitest'

const SECRET = 'test-embed-secret-that-is-at-least-32-chars!!'

vi.mock('@/lib/env', () => ({
  env: { EMBED_INTERNAL_SECRET: SECRET },
}))

import { signRequest, verifyHmacRequest } from '../hmac'

const BASE_URL = 'http://localhost:3000'

// ── signRequest ───────────────────────────────────────────────────────────────

describe('signRequest', () => {
  it('returns x-taskflow-signature and x-taskflow-timestamp headers', async () => {
    const headers = await signRequest('/api/embed', '{"task_id":"abc"}')
    expect(headers).toHaveProperty('x-taskflow-signature')
    expect(headers).toHaveProperty('x-taskflow-timestamp')
  })

  it('signature is a non-empty hex string', async () => {
    const { 'x-taskflow-signature': sig } = await signRequest('/api/embed', 'body')
    expect(sig).toMatch(/^[0-9a-f]+$/)
    expect(sig.length).toBeGreaterThan(0)
  })

  it('timestamp is a numeric string close to now', async () => {
    const before = Date.now()
    const { 'x-taskflow-timestamp': ts } = await signRequest('/api/embed', 'body')
    const after = Date.now()
    const t = parseInt(ts, 10)
    expect(t).toBeGreaterThanOrEqual(before)
    expect(t).toBeLessThanOrEqual(after)
  })

  it('produces different signatures for different paths', async () => {
    const h1 = await signRequest('/api/embed', 'body')
    const h2 = await signRequest('/api/other', 'body')
    expect(h1['x-taskflow-signature']).not.toBe(h2['x-taskflow-signature'])
  })

  it('produces different signatures for different bodies', async () => {
    const h1 = await signRequest('/api/embed', 'body-A')
    const h2 = await signRequest('/api/embed', 'body-B')
    expect(h1['x-taskflow-signature']).not.toBe(h2['x-taskflow-signature'])
  })
})

// ── verifyHmacRequest ─────────────────────────────────────────────────────────

async function buildSignedRequest(path: string, body: string, overrides?: Record<string, string>) {
  const headers = await signRequest(path, body)
  const merged: Record<string, string> = { ...headers, ...overrides }
  return new Request(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: merged,
    body,
  })
}

describe('verifyHmacRequest', () => {
  it('accepts a properly signed request', async () => {
    const req = await buildSignedRequest('/api/embed', '{"data":true}')
    expect(await verifyHmacRequest(req)).toBe(true)
  })

  it('rejects request with missing signature header', async () => {
    const headers = await signRequest('/api/embed', 'body')
    const req = new Request(`${BASE_URL}/api/embed`, {
      method: 'POST',
      headers: { 'x-taskflow-timestamp': headers['x-taskflow-timestamp'] },
      body: 'body',
    })
    expect(await verifyHmacRequest(req)).toBe(false)
  })

  it('rejects request with missing timestamp header', async () => {
    const headers = await signRequest('/api/embed', 'body')
    const req = new Request(`${BASE_URL}/api/embed`, {
      method: 'POST',
      headers: { 'x-taskflow-signature': headers['x-taskflow-signature'] },
      body: 'body',
    })
    expect(await verifyHmacRequest(req)).toBe(false)
  })

  it('rejects a tampered body', async () => {
    const headers = await signRequest('/api/embed', 'original body')
    const req = new Request(`${BASE_URL}/api/embed`, {
      method: 'POST',
      headers,
      body: 'tampered body',
    })
    expect(await verifyHmacRequest(req)).toBe(false)
  })

  it('rejects an expired timestamp (> 5 min old)', async () => {
    const oldTimestamp = (Date.now() - 6 * 60 * 1000).toString()
    const req = await buildSignedRequest('/api/embed', 'body', {
      'x-taskflow-timestamp': oldTimestamp,
    })
    expect(await verifyHmacRequest(req)).toBe(false)
  })

  it('rejects a future timestamp', async () => {
    const futureTimestamp = (Date.now() + 10 * 60 * 1000).toString()
    const req = await buildSignedRequest('/api/embed', 'body', {
      'x-taskflow-timestamp': futureTimestamp,
    })
    expect(await verifyHmacRequest(req)).toBe(false)
  })

  it('rejects a tampered signature', async () => {
    const req = await buildSignedRequest('/api/embed', 'body', {
      'x-taskflow-signature': 'deadbeef'.repeat(8),
    })
    expect(await verifyHmacRequest(req)).toBe(false)
  })
})
