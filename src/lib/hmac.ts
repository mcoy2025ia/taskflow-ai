async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const aBytes = new TextEncoder().encode(a)
  const bBytes = new TextEncoder().encode(b)
  let diff = 0
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i]
  return diff === 0
}

async function hmacSign(payload: string): Promise<string> {
  const { env } = await import('@/lib/env')
  const secret = env.EMBED_INTERNAL_SECRET
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function signRequest(path: string, body: string): Promise<Record<string, string>> {
  const timestamp = Date.now().toString()
  const bodyHash = await sha256Hex(body)
  const payload = `${timestamp}.${path}.${bodyHash}`
  const signature = await hmacSign(payload)
  return {
    'x-taskflow-signature': signature,
    'x-taskflow-timestamp': timestamp,
  }
}

export async function verifyHmacRequest(request: Request): Promise<boolean> {
  const signature = request.headers.get('x-taskflow-signature')
  const timestamp = request.headers.get('x-taskflow-timestamp')
  if (!signature || !timestamp) return false

  const age = Date.now() - parseInt(timestamp, 10)
  if (age > 5 * 60 * 1000 || age < 0) return false

  const rawBody = await request.text()
  const bodyHash = await sha256Hex(rawBody)
  const payload = `${timestamp}.${new URL(request.url).pathname}.${bodyHash}`
  const expected = await hmacSign(payload)

  return timingSafeEqual(expected, signature)
}
