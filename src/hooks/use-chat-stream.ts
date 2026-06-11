'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { getChatMessages, createChatSession, saveMessages } from '@/actions/chat.actions'
import type { ChatUIMessage, Source } from '@/types/chat-ui.types'

const WELCOME: ChatUIMessage = {
  id: 'welcome',
  role: 'assistant',
  content: '¡Hola! Soy TaskFlow AI. Puedes escribirme o hablarme por voz 🎤. Por ejemplo: *"¿Qué tareas urgentes tengo pendientes?"* o *"¿Cómo va el proyecto?"*.',
}

interface UseChatStreamOptions {
  initialSessionId: string | null
  onVoiceResponse?: (text: string) => void
}

export function useChatStream({ initialSessionId, onVoiceResponse }: UseChatStreamOptions) {
  const [, startTransition] = useTransition()
  const [messages, setMessages] = useState<ChatUIMessage[]>([WELCOME])
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId)
  const [isStreaming, setIsStreaming] = useState(false)
  const [highlightedSource, setHighlightedSource] = useState<Record<string, number>>({})
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)

  // Load persisted messages from DB on mount
  useEffect(() => {
    if (!initialSessionId) return
    getChatMessages(initialSessionId).then(rows => {
      if (!rows.length) return
      setMessages(rows.map(r => ({ id: r.id, role: r.role, content: r.content })))
    })
  }, [initialSessionId])

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (!isNearBottomRef.current) return
    const raf = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(raf)
  }, [messages])

  function handleScroll() {
    const el = scrollContainerRef.current
    if (!el) return
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }

  function handleCiteClick(messageId: string, sourceIdx: number) {
    setHighlightedSource(prev => ({ ...prev, [messageId]: sourceIdx }))
    setTimeout(() => {
      setHighlightedSource(prev => {
        const next = { ...prev }
        delete next[messageId]
        return next
      })
    }, 2000)
  }

  async function sendMessage(text: string, isVoice = false) {
    if (!text.trim() || isStreaming) return

    const userMessage = text.trim()
    const assistantId = `${Date.now()}-assistant`

    setMessages(prev => [
      ...prev,
      { id: Date.now().toString(), role: 'user', content: userMessage },
      { id: assistantId, role: 'assistant', content: '', isStreaming: true },
    ])
    setIsStreaming(true)

    const history = messages
      .filter(m => m.id !== 'welcome' && !m.isStreaming)
      .map(m => ({ role: m.role, content: m.content }))

    abortRef.current = new AbortController()

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, history, voiceMode: isVoice }),
        signal: abortRef.current.signal,
      })

      if (!response.ok || !response.body) throw new Error('Chat error')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      let sources: Source[] = []
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
            const data = JSON.parse(line.slice(6))

            if (data.type === 'token') {
              accumulated += data.content
              startTransition(() => {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: accumulated } : m
                ))
              })
            } else if (data.type === 'sources') {
              sources = data.sources
            } else if (data.type === 'tool_call') {
              startTransition(() => {
                setMessages(prev => prev.map(m => {
                  if (m.id !== assistantId) return m
                  return { ...m, toolActivity: [...(m.toolActivity ?? []), { tool: data.tool, status: 'running' as const }] }
                }))
              })
            } else if (data.type === 'tool_result') {
              startTransition(() => {
                setMessages(prev => prev.map(m => {
                  if (m.id !== assistantId) return m
                  const updated = (m.toolActivity ?? []).map(t =>
                    t.tool === data.tool && t.status === 'running'
                      ? { ...t, status: 'done' as const, result: data.result }
                      : t
                  )
                  return { ...m, toolActivity: updated }
                }))
              })
            } else if (data.type === 'confirm_required') {
              startTransition(() => {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? { ...m, isStreaming: false, pendingConfirm: { tool: data.tool, args: data.args, task_title: data.task_title ?? null, confirm_id: data.confirm_id } }
                    : m
                ))
              })
            } else if (data.type === 'board_update') {
              window.dispatchEvent(new CustomEvent('taskflow:board_update'))
            } else if (data.type === 'error') {
              accumulated = `⚠️ ${data.message ?? 'Error desconocido del agente.'}`
              startTransition(() => {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: accumulated } : m
                ))
              })
            }
          } catch { continue }
        }
      }

      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, isStreaming: false, sources } : m
      ))

      // Persist to DB
      if (accumulated) {
        let sid = sessionId
        if (!sid) {
          sid = await createChatSession(userMessage)
          if (sid) {
            setSessionId(sid)
            window.history.replaceState({}, '', `/chat?session_id=${sid}`)
          }
        }
        if (sid) {
          void saveMessages(sid, userMessage, accumulated)
          window.dispatchEvent(new CustomEvent('taskflow:session_updated'))
        }
      }

      if (isVoice && accumulated) onVoiceResponse?.(accumulated)

    } catch (error: unknown) {
      if ((error as Error).name === 'AbortError') return
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: 'Error al conectar con el asistente. Intenta de nuevo.', isStreaming: false }
          : m
      ))
    } finally {
      setIsStreaming(false)
    }
  }

  async function handleConfirm(message: ChatUIMessage) {
    const pc = message.pendingConfirm
    if (!pc) return

    setMessages(prev => prev.map(m =>
      m.id === message.id ? { ...m, pendingConfirm: undefined, content: '', isStreaming: true } : m
    ))

    try {
      const res = await fetch('/api/chat/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: pc.tool, args: pc.args }),
      })
      const data = await res.json() as { message?: string }
      setMessages(prev => prev.map(m =>
        m.id === message.id ? { ...m, content: data.message ?? 'Acción completada.', isStreaming: false } : m
      ))
      window.dispatchEvent(new CustomEvent('taskflow:board_update'))
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === message.id ? { ...m, content: 'Error al ejecutar la acción.', isStreaming: false } : m
      ))
    }
  }

  function handleCancel(messageId: string) {
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, pendingConfirm: undefined, content: 'Acción cancelada.' } : m
    ))
  }

  return {
    messages,
    sessionId,
    isStreaming,
    highlightedSource,
    sendMessage,
    handleConfirm,
    handleCancel,
    handleCiteClick,
    bottomRef,
    scrollContainerRef,
    handleScroll,
  }
}
