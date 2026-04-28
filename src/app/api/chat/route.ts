import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getChatProvider } from '@/lib/ai/chat'
import { searchTasksByQuery, buildContextBlock, buildSystemPrompt, getProjectSummary } from '@/lib/ai/rag'
import type { ChatMessage } from '@/lib/ai/chat'

export const runtime = 'nodejs' // Ollama requiere Node.js runtime (no edge)

export async function POST(request: NextRequest) {
  // Auth: verificar sesión
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const { message, history = [], voiceMode = false }: {
    message: string
    history: Array<{ role: 'user' | 'assistant'; content: string }>
    voiceMode?: boolean
  } = await request.json()

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: 'Mensaje vacío' }), { status: 400 })
  }

  // 1. Búsqueda RAG: obtener tareas relevantes
  const relevantTasks = await searchTasksByQuery(message, {
    threshold: 0.3,
    limit: 5,
    userId: user.id,
  })

  const [contextBlock, projectSummary] = await Promise.all([
    Promise.resolve(buildContextBlock(relevantTasks)),
    getProjectSummary(user.id),
  ])
  const systemPrompt = buildSystemPrompt(contextBlock, voiceMode, projectSummary)

  // 2. Construir historial de mensajes para el LLM
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ]

  // 3. Obtener stream del proveedor configurado
  const provider = getChatProvider()
  const providerStream = await provider.stream(messages)

  // 4. Transformar stream del proveedor → stream SSE para el cliente
  const isOllama = process.env.CHAT_PROVIDER === 'ollama'
  const isGroq = process.env.CHAT_PROVIDER === 'groq'

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const stream = new ReadableStream({
    async start(controller) {
      const reader = providerStream.getReader()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? '' // Guardar línea incompleta

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue

            let token: string | null = null

            if (isOllama) {
              // Ollama: JSON directo por línea
              try {
                const parsed = JSON.parse(trimmed)
                token = parsed.message?.content ?? null
                if (parsed.done) {
                  // Enviar fuentes al final del stream
                  const sourcesPayload = JSON.stringify({
                    type: 'sources',
                    sources: relevantTasks.map(t => ({
                      task_id:    t.task_id,
                      title:      t.title,
                      status:     t.status,
                      similarity: t.similarity,
                    })),
                  })
                  controller.enqueue(encoder.encode(`data: ${sourcesPayload}\n\n`))
                }
              } catch { continue }
            } else {
              // Groq/OpenAI: formato SSE con "data: {...}"
              if (!trimmed.startsWith('data: ')) continue
              const data = trimmed.slice(6)
              if (data === '[DONE]') {
                const sourcesPayload = JSON.stringify({
                  type: 'sources',
                  sources: relevantTasks.map(t => ({
                    task_id:    t.task_id,
                    title:      t.title,
                    status:     t.status,
                    similarity: t.similarity,
                  })),
                })
                controller.enqueue(encoder.encode(`data: ${sourcesPayload}\n\n`))
                continue
              }
              try {
                const parsed = JSON.parse(data)
                token = parsed.choices?.[0]?.delta?.content ?? null
              } catch { continue }
            }

            if (token) {
              // Enviar token al cliente en formato SSE
              const payload = JSON.stringify({ type: 'token', content: token })
              controller.enqueue(encoder.encode(`data: ${payload}\n\n`))
            }
          }
        }
      } catch { // <--- CORREGIDO: Sin paréntesis
        const errPayload = JSON.stringify({ type: 'error', message: 'Stream interrupted' })
        controller.enqueue(encoder.encode(`data: ${errPayload}\n\n`))
      } finally {
        reader.releaseLock()
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no', // Desactivar buffering en Nginx/proxies
    },
  })
}