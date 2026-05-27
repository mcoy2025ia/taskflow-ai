import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

function createRedis() {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
}

// Lazy singletons — sólo se crean si las vars están presentes
let _chatLimiter: Ratelimit | null = null
let _reportLimiter: Ratelimit | null = null
let _embedLimiter: Ratelimit | null = null
let _auditLimiter: Ratelimit | null = null

function isConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

function getChatLimiter(): Ratelimit {
  if (!_chatLimiter) {
    _chatLimiter = new Ratelimit({
      redis: createRedis(),
      limiter: Ratelimit.slidingWindow(20, '1 m'),
      prefix: 'rl:chat',
    })
  }
  return _chatLimiter
}

function getReportLimiter(): Ratelimit {
  if (!_reportLimiter) {
    _reportLimiter = new Ratelimit({
      redis: createRedis(),
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      prefix: 'rl:report',
    })
  }
  return _reportLimiter
}

function getAuditLimiter(): Ratelimit {
  if (!_auditLimiter) {
    _auditLimiter = new Ratelimit({
      redis: createRedis(),
      limiter: Ratelimit.slidingWindow(3, '1 m'),
      prefix: 'rl:audit',
    })
  }
  return _auditLimiter
}

function getEmbedLimiter(): Ratelimit {
  if (!_embedLimiter) {
    _embedLimiter = new Ratelimit({
      redis: createRedis(),
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      prefix: 'rl:embed',
    })
  }
  return _embedLimiter
}

export interface RateLimitResult {
  limited: boolean
  headers: Record<string, string>
}

async function check(
  getLimiter: () => Ratelimit,
  identifier: string
): Promise<RateLimitResult> {
  if (!isConfigured()) {
    // Sin Upstash configurado (dev local) → sin límite
    return { limited: false, headers: {} }
  }

  const { success, limit, remaining, reset } = await getLimiter().limit(identifier)
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(reset),
  }
  return { limited: !success, headers }
}

export const ratelimit = {
  chat:   (userId: string) => check(getChatLimiter,   `chat:${userId}`),
  report: (userId: string) => check(getReportLimiter, `report:${userId}`),
  embed:  (origin: string) => check(getEmbedLimiter,  `embed:${origin}`),
  audit:  (userId: string) => check(getAuditLimiter,  `audit:${userId}`),
}
