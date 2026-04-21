export async function verifyHmacRequest(request: Request): Promise<boolean> {
  const signature = request.headers.get("x-taskflow-signature")
  const timestamp = request.headers.get("x-taskflow-timestamp")
  if (!signature || !timestamp) return false
  const age = Date.now() - parseInt(timestamp, 10)
  if (age > 5 * 60 * 1000 || age < 0) return false
  const secret = process.env.EMBED_INTERNAL_SECRET!
  const payload = `${timestamp}.${new URL(request.url).pathname}`
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))
  const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, "0")).join("")
  return expected === signature
}

export async function signRequest(path: string): Promise<Record<string, string>> {
  const secret = process.env.EMBED_INTERNAL_SECRET!
  const timestamp = Date.now().toString()
  const payload = `${timestamp}.${path}`
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))
  const signature = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, "0")).join("")
  return { "x-taskflow-signature": signature, "x-taskflow-timestamp": timestamp }
}
