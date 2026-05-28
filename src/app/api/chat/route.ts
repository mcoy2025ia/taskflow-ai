import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchTasksByQuery, buildContextBlock, buildSystemPrompt, getProjectSummary } from '@/lib/ai/rag'
import { ratelimit } from '@/lib/ratelimit'
import { runAgent } from '@/lib/ai/agent'
import { isBot, botBlockResponse } from '@/lib/bot-guard'
import type { ChatMessage } from '@/lib/ai/chat'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  if (isBot(request)) return botBlockResponse()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  // Rate limiting: 20 req/min por usuario
  const { limited, headers: rlHeaders } = await ratelimit.chat(user.id)
  if (limited) {
    return new Response(JSON.stringify({ error: 'Demasiadas solicitudes. Espera un momento.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', ...rlHeaders },
    })
  }

  const { message, history = [], voiceMode = false }: {
    message: string
    history: Array<{ role: 'user' | 'assistant'; content: string }>
    voiceMode?: boolean
  } = await request.json()

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: 'Mensaje vacío' }), { status: 400 })
  }

  // RAG: obtener tareas relevantes y resumen del proyecto en paralelo
  const [relevantTasks, projectSummary] = await Promise.all([
    searchTasksByQuery(message, { threshold: 0.3, limit: 5, userId: user.id }),
    getProjectSummary(user.id),
  ])

  const contextBlock  = buildContextBlock(relevantTasks)
  const systemPrompt  = buildSystemPrompt(contextBlock, voiceMode, projectSummary)

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ]

  const sources = relevantTasks.map(t => ({
    task_id:    t.task_id,
    title:      t.title,
    status:     t.status,
    similarity: t.similarity,
  }))

  const stream = runAgent({ supabase, userId: user.id, messages, voiceMode }, sources)

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
