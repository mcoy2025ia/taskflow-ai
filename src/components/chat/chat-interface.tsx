'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { Send, Bot, User, Mic, MicOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { TaskStatus } from '@/types/app.types'

interface SpeechRecognitionInstance {
  lang: string
  continuous: boolean
  interimResults: boolean
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

interface SpeechRecognitionResultEvent {
  results: { [index: number]: { [index: number]: { transcript: string } } }
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

interface Source {
  task_id: string
  title: string
  status: TaskStatus
  similarity: number
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  isStreaming?: boolean
}

export function ChatInterface() {
  const [, startTransition] = useTransition()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '¡Hola! Soy TaskFlow AI. Puedes escribirme o hablarme por voz 🎤. Por ejemplo: *"¿Qué tareas urgentes tengo pendientes?"* o *"¿Cómo va el proyecto?"*.',
    }
  ])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceMode, setVoiceMode] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const isNearBottomRef = useRef(true)
  const submitRef = useRef<(() => void) | null>(null)

  function handleScroll() {
    const el = scrollContainerRef.current
    if (!el) return
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }

  useEffect(() => {
    if (!isNearBottomRef.current) return
    const raf = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(raf)
  }, [messages])

  function startVoiceInput() {
    const w = window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }
    const SpeechRecognitionAPI = w.SpeechRecognition || w.webkitSpeechRecognition

    if (!SpeechRecognitionAPI) {
      alert('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.')
      return
    }

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const recognition = new SpeechRecognitionAPI()
    recognition.lang = 'es-CO'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => setIsListening(true)

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      const transcript = event.results[0][0].transcript
      setVoiceMode(true)
      setInput(transcript)
      // submitRef permite disparar el submit después de que React actualice el estado
      submitRef.current = () => sendMessage(transcript, true)
    }

    recognition.onerror = () => {
      setIsListening(false)
      setVoiceMode(false)
    }

    recognition.onend = () => {
      setIsListening(false)
      if (submitRef.current) {
        const fn = submitRef.current
        submitRef.current = null
        setTimeout(fn, 100)
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  async function sendMessage(text: string, isVoice = false) {
    if (!text.trim() || isStreaming) return

    const userMessage = text.trim()
    setInput('')

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
    }

    const assistantId = `${Date.now()}-assistant`
    const assistantPlaceholder: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    }

    setMessages(prev => [...prev, userMsg, assistantPlaceholder])
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

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'token') {
              accumulated += data.content
              startTransition(() => {
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantId ? { ...m, content: accumulated } : m
                  )
                )
              })
            } else if (data.type === 'sources') {
              sources = data.sources
            }
          } catch { continue }
        }
      }

      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId ? { ...m, isStreaming: false, sources } : m
        )
      )
    } catch (error: unknown) {
      if ((error as Error).name === 'AbortError') return
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: 'Error al conectar con el asistente. Intenta de nuevo.', isStreaming: false }
            : m
        )
      )
    } finally {
      setIsStreaming(false)
      setVoiceMode(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await sendMessage(input, voiceMode)
  }

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      {/* Historial */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.map(message => (
          <div
            key={message.id}
            className={cn('flex gap-3', message.role === 'user' && 'flex-row-reverse')}
          >
            <div className={cn(
              'shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
              message.role === 'assistant' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            )}>
              {message.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
            </div>

            <div className={cn('flex flex-col gap-2 max-w-[80%]', message.role === 'user' && 'items-end')}>
              <div className={cn(
                'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                message.role === 'assistant'
                  ? 'bg-muted/60 text-foreground rounded-tl-sm'
                  : 'bg-primary text-primary-foreground rounded-tr-sm'
              )}>
                {message.content || (
                  message.isStreaming
                    ? <span className="inline-flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]"/>
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]"/>
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]"/>
                      </span>
                    : null
                )}
              </div>

              {message.sources && message.sources.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {message.sources.map(source => (
                    <span
                      key={source.task_id}
                      className="inline-flex items-center gap-1 text-xs bg-background border border-border/60 rounded-full px-2.5 py-1 text-muted-foreground hover:text-foreground transition-colors cursor-default"
                      title={`Similitud: ${(source.similarity * 100).toFixed(0)}%`}
                    >
                      <span className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        source.status === 'done' && 'bg-emerald-500',
                        source.status === 'in_progress' && 'bg-amber-500',
                        source.status === 'todo' && 'bg-slate-400',
                      )}/>
                      {source.title.slice(0, 40)}{source.title.length > 40 ? '…' : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Indicador de escucha activa */}
      {isListening && (
        <div className="px-4 pb-1 flex items-center gap-2 text-xs text-red-500 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>
          Escuchando... habla ahora
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="p-4 border-t border-border/50 flex gap-2"
      >
        <Input
          value={input}
          onChange={e => { setInput(e.target.value); setVoiceMode(false) }}
          placeholder={isListening ? 'Escuchando...' : 'Pregunta sobre tus tareas...'}
          disabled={isStreaming || isListening}
          className="flex-1"
          autoFocus
        />
        <Button
          type="button"
          size="icon"
          variant={isListening ? 'destructive' : 'outline'}
          onClick={startVoiceInput}
          disabled={isStreaming}
          title={isListening ? 'Detener grabación' : 'Dictar por voz'}
          className={isListening ? 'animate-pulse' : ''}
        >
          {isListening ? <MicOff size={16} /> : <Mic size={16} />}
        </Button>
        <Button
          type="submit"
          size="icon"
          disabled={isStreaming || !input.trim()}
        >
          <Send size={16} />
        </Button>
      </form>
    </div>
  )
}
