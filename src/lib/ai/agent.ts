import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { ChatMessage } from './chat'
import { TASK_TOOLS, executeTool } from './tools'
import * as Sentry from '@sentry/nextjs'

// ── Selección de proveedor ────────────────────────────────────────────────────
// CHAT_PROVIDER=deepseek → DeepSeek API (default, OpenAI-compatible, tool calling + streaming)
// CHAT_PROVIDER=groq     → Groq API (OpenAI-compatible, tool calling + streaming)
// CHAT_PROVIDER=ollama   → Ollama OpenAI-compat API (/v1) — también soporta tools
//                          en modelos modernos (llama3.2, qwen2.5, mistral-nemo…)
//
// AI_GATEWAY_BASE_URL sobreescribe la base URL de Groq/DeepSeek cuando está
// definida (Vercel AI Gateway proxy). En ese caso el modelo lleva el prefijo
// del proveedor ('groq/' o 'deepseek/').

const PROVIDER     = process.env.CHAT_PROVIDER ?? 'deepseek'
const IS_OLLAMA    = PROVIDER === 'ollama'
const IS_DEEPSEEK  = PROVIDER === 'deepseek'
const PROVIDER_LABEL = IS_OLLAMA ? 'Ollama' : IS_DEEPSEEK ? 'DeepSeek' : 'Groq'

const LLM_BASE = IS_OLLAMA
  ? `${process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'}/v1`
  : IS_DEEPSEEK
    ? (process.env.AI_GATEWAY_BASE_URL ?? 'https://api.deepseek.com/v1')
    : (process.env.AI_GATEWAY_BASE_URL ?? 'https://api.groq.com/openai/v1')

const LLM_MODEL = IS_OLLAMA
  ? (process.env.OLLAMA_MODEL ?? 'llama3.2')
  : IS_DEEPSEEK
    ? (process.env.AI_GATEWAY_BASE_URL ? 'deepseek/deepseek-chat' : 'deepseek-chat')
    : (process.env.AI_GATEWAY_BASE_URL ? 'groq/llama-3.3-70b-versatile' : 'llama-3.3-70b-versatile')

interface AgentOptions {
  supabase: SupabaseClient<Database>
  userId: string
  projectId?: string | null
  messages: ChatMessage[]
  voiceMode: boolean
}

interface ToolCall {
  id: string
  function: { name: string; arguments: string }
}

function llmHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (IS_OLLAMA) {
    // Ollama no requiere API key; si el usuario la configuró de todas formas, la pasamos
    if (process.env.OLLAMA_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.OLLAMA_API_KEY}`
    }
    return headers
  }

  if (IS_DEEPSEEK) {
    headers['Authorization'] = `Bearer ${process.env.DEEPSEEK_API_KEY ?? ''}`
    return headers
  }

  // Groq — soporte para Vercel AI Gateway con OIDC token
  if (process.env.VERCEL_OIDC_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.VERCEL_OIDC_TOKEN}`
    headers['X-Groq-Api-Key'] = process.env.GROQ_API_KEY ?? ''
  } else {
    headers['Authorization'] = `Bearer ${process.env.GROQ_API_KEY}`
  }
  return headers
}

async function callLLM(messages: ChatMessage[], stream: false): Promise<{
  content: string | null
  tool_calls: ToolCall[] | null
  finish_reason: string
}>
async function callLLM(messages: ChatMessage[], stream: true): Promise<ReadableStream<Uint8Array>>
async function callLLM(messages: ChatMessage[], stream: boolean) {
  const response = await fetch(`${LLM_BASE}/chat/completions`, {
    method: 'POST',
    headers: llmHeaders(),
    body: JSON.stringify({
      model: LLM_MODEL,
      messages,
      tools: TASK_TOOLS,
      tool_choice: 'auto',
      stream,
      temperature: 0.3,
      max_tokens: 1024,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`${PROVIDER_LABEL} error ${response.status}: ${body}`)
  }

  if (stream) return response.body as ReadableStream<Uint8Array>

  const data = await response.json()
  const choice = data.choices?.[0]
  return {
    content:       choice?.message?.content ?? null,
    tool_calls:    choice?.message?.tool_calls ?? null,
    finish_reason: choice?.finish_reason ?? 'stop',
  }
}

// Fallback: Claude Haiku 4.5 — solo cuando ANTHROPIC_API_KEY está definida y el LLM principal falla
async function callClaudeHaikuStream(messages: ChatMessage[]): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada para fallback')

  const system = messages.find(m => m.role === 'system')?.content ?? ''
  const conversation = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content || '…' }))

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type':      'application/json',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      stream:     true,
      system,
      messages:   conversation,
    }),
  })

  if (!response.ok || !response.body) {
    throw new Error(`Claude Haiku fallback error: ${response.status}`)
  }

  return response.body
}

async function pipeAnthropicStream(
  stream: ReadableStream<Uint8Array>,
  emit: (data: unknown) => void
) {
  const reader  = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const parsed = JSON.parse(line.slice(6))
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          emit({ type: 'token', content: parsed.delta.text })
        }
      } catch { /* ignorar chunks malformados */ }
    }
  }
  reader.releaseLock()
}

/**
 * Ejecuta el loop de agente y devuelve un ReadableStream SSE.
 *
 * Eventos emitidos:
 *   { type: 'tool_call',       tool, args }
 *   { type: 'tool_result',     tool, result }
 *   { type: 'confirm_required', tool, args, task_title, confirm_id }
 *   { type: 'token',           content }
 *   { type: 'sources',         sources }
 *   { type: 'board_update' }
 *   { type: 'error',           message }
 */
const DESTRUCTIVE_TOOLS = new Set(['delete_task'])

export function runAgent(options: AgentOptions, relevantTasks: unknown[]): ReadableStream<Uint8Array> {
  const { supabase, userId, projectId = null, messages } = options
  const encoder = new TextEncoder()

  function emit(controller: ReadableStreamDefaultController, data: unknown) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
  }

  return new ReadableStream({
    async start(controller) {
      try {
        let currentMessages = [...messages]

        // ── Turno 1: detectar tool calls ─────────────────────────────────────
        const first = await callLLM(currentMessages, false)

        if (first.finish_reason === 'tool_calls' && first.tool_calls?.length) {
          currentMessages.push({
            role: 'assistant',
            content: first.content ?? '',
            tool_calls: first.tool_calls.map(tc => ({
              id: tc.id,
              type: 'function',
              function: tc.function,
            })),
          })

          // ── Interceptar tools destructivas antes de ejecutar ─────────────
          const destructiveCall = first.tool_calls.find(tc => DESTRUCTIVE_TOOLS.has(tc.function.name))
          if (destructiveCall) {
            let parsedArgs: Record<string, unknown> = {}
            try { parsedArgs = JSON.parse(destructiveCall.function.arguments) } catch {}

            let taskTitle: string | null = null
            if (parsedArgs.task_id) {
              let titleQuery = supabase
                .from('tasks')
                .select('title')
                .eq('id', parsedArgs.task_id as string)

              titleQuery = projectId
                ? titleQuery.eq('project_id', projectId)
                : titleQuery.eq('user_id', userId).is('project_id', null)

              const { data } = await titleQuery
                .single()
              taskTitle = data?.title ?? null
            }

            emit(controller, {
              type: 'confirm_required',
              tool: destructiveCall.function.name,
              args: parsedArgs,
              task_title: taskTitle,
              confirm_id: crypto.randomUUID(),
            })
            return
          }

          // ── Ejecutar todas las tools en paralelo ──────────────────────────
          const toolResults = await Promise.all(
            first.tool_calls.map(async (tc) => {
              let parsedArgs: Record<string, unknown> = {}
              try { parsedArgs = JSON.parse(tc.function.arguments) } catch {}

              emit(controller, { type: 'tool_call', tool: tc.function.name, args: parsedArgs })
              Sentry.addBreadcrumb({ category: 'agent', message: 'agent.tool_called', data: { tool: tc.function.name }, level: 'info' })

              const result = await executeTool(tc.function.name, parsedArgs, { supabase, userId, projectId })
              emit(controller, { type: 'tool_result', tool: tc.function.name, result })

              return { role: 'tool' as const, tool_call_id: tc.id, content: result }
            })
          )

          currentMessages = [...currentMessages, ...toolResults]
        } else if (first.content) {
          emit(controller, { type: 'token', content: first.content })
          emit(controller, { type: 'sources', sources: relevantTasks })
          // NO cerrar aquí — el bloque finally siempre cierra el controller
          // al salir por return. Cerrar aquí causaba ERR_INVALID_STATE porque
          // finally intentaba cerrar un controller ya cerrado.
          return
        }

        // ── Turno 2: respuesta final del LLM (streaming) ──────────────────
        let usedFallback = false
        let llmStream: ReadableStream<Uint8Array> | null = null

        try {
          llmStream = await callLLM(currentMessages, true)
        } catch (llmErr) {
          console.warn(`[agent] ${PROVIDER_LABEL} no disponible, usando Claude Haiku fallback:`, llmErr)
          usedFallback = true
          try {
            const haikuStream = await callClaudeHaikuStream(currentMessages)
            await pipeAnthropicStream(haikuStream, (data) => emit(controller, data))
          } catch (haikuErr) {
            throw new Error(`Tanto ${PROVIDER_LABEL} como Claude Haiku fallaron: ${haikuErr}`)
          }
        }

        if (!usedFallback && llmStream) {
          const reader  = llmStream.getReader()
          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed.startsWith('data: ')) continue
              const raw = trimmed.slice(6)
              if (raw === '[DONE]') continue
              try {
                const parsed = JSON.parse(raw)
                const token = parsed.choices?.[0]?.delta?.content
                if (token) emit(controller, { type: 'token', content: token })
              } catch { /* ignorar chunks malformados */ }
            }
          }

          reader.releaseLock()
        }

        emit(controller, { type: 'sources', sources: relevantTasks })
        Sentry.addBreadcrumb({
          category: 'chat',
          message: 'chat.completion',
          data: { provider: PROVIDER, toolsUsed: first.tool_calls?.length ?? 0, usedFallback },
          level: 'info',
        })

        if (first.tool_calls?.length) {
          emit(controller, { type: 'board_update' })
        }

      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido'
        Sentry.captureException(err)
        emit(controller, { type: 'error', message })
      } finally {
        controller.close()
      }
    },
  })
}

// Exportar para compatibilidad con voiceMode (no usado en agente pero accesible para tests)
export { DESTRUCTIVE_TOOLS }
