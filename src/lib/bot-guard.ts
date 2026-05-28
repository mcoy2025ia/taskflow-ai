import type { NextRequest } from 'next/server'

/**
 * Vercel BotID guard — bloquea requests identificadas como bots por la plataforma.
 *
 * Vercel inyecta `x-vercel-is-bot: 1` en requests que detecta como no-humanas
 * (crawlers, scrapers, herramientas automatizadas sin JS).
 * En desarrollo local este header no existe y la función siempre retorna false.
 *
 * Docs: https://vercel.com/docs/security/botid
 */
export function isBot(request: NextRequest): boolean {
  return request.headers.get('x-vercel-is-bot') === '1'
}

export function botBlockResponse() {
  return new Response(
    JSON.stringify({ error: 'Acceso no permitido para bots' }),
    { status: 403, headers: { 'Content-Type': 'application/json' } }
  )
}
