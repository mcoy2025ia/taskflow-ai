'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Send, Bot, User, Mic, MicOff, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useChatStream } from '@/hooks/use-chat-stream'
import { useVoiceInput } from '@/hooks/use-voice-input'
import { useChatTTS } from '@/hooks/use-chat-tts'
import { useActiveProjectSafe } from '@/contexts/active-project'
import { MessageContent, ToolActivityList, ConfirmCard, SourceChips } from './message-renderer'

export interface ChatInterfaceProps {
  initialSessionId?: string | null
}

export function ChatInterface({ initialSessionId = null }: ChatInterfaceProps) {
  const [input, setInput] = useState('')
  const searchParams = useSearchParams()
  const projectCtx = useActiveProjectSafe()
  const activeProjectId = searchParams.get('project_id') ?? projectCtx?.activeProject?.id
  const { isSpeaking, speakText, stopSpeaking } = useChatTTS()
  const {
    messages, isStreaming, highlightedSource,
    sendMessage, handleConfirm, handleCancel, handleCiteClick,
    bottomRef, scrollContainerRef, handleScroll,
  } = useChatStream({ initialSessionId, activeProjectId, onVoiceResponse: speakText })
  const { isListening, voiceMode, setVoiceMode, startVoiceInput } = useVoiceInput({
    onTranscript: setInput,
    onSubmit: (text) => { setInput(''); sendMessage(text, true) },
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input
    setInput('')
    setVoiceMode(false)
    await sendMessage(text, voiceMode)
  }

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      <div ref={scrollContainerRef} onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
            <div className={cn('shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
              msg.role === 'assistant' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
              {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
            </div>

            <div className={cn('flex flex-col gap-2 max-w-[80%]', msg.role === 'user' && 'items-end')}>
              <div className={cn('rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                msg.role === 'assistant'
                  ? 'bg-muted/60 text-foreground rounded-tl-sm'
                  : 'bg-primary text-primary-foreground rounded-tr-sm')}>
                {msg.isStreaming && !msg.content
                  ? <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]"/>
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]"/>
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]"/>
                    </span>
                  : msg.isStreaming ? msg.content
                  : msg.role === 'assistant' && msg.content
                    ? <MessageContent text={msg.content} sources={msg.sources ?? []} onCite={idx => handleCiteClick(msg.id, idx)} />
                    : msg.content || null}
              </div>

              {msg.toolActivity && msg.toolActivity.length > 0 &&
                <ToolActivityList activity={msg.toolActivity} />}

              {msg.pendingConfirm &&
                <ConfirmCard confirm={msg.pendingConfirm}
                  onConfirm={() => handleConfirm(msg)} onCancel={() => handleCancel(msg.id)} />}

              {msg.sources && msg.sources.length > 0 &&
                <SourceChips sources={msg.sources} messageId={msg.id} highlighted={highlightedSource} />}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {(isListening || isSpeaking) && (
        <div className="px-4 pb-1 flex items-center gap-2 text-xs animate-pulse">
          {isListening
            ? <><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/><span className="text-red-500">Escuchando... habla ahora</span></>
            : <><span className="w-2 h-2 rounded-full bg-primary inline-block"/><span className="text-primary">Reproduciendo respuesta</span></>}
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4 border-t border-border/50 flex gap-2">
        <Input value={input} onChange={e => { setInput(e.target.value); setVoiceMode(false) }}
          placeholder={isListening ? 'Escuchando...' : 'Pregunta sobre tus tareas...'}
          disabled={isStreaming || isListening} className="flex-1" autoFocus />
        {isSpeaking && (
          <Button type="button" size="icon" variant="outline" onClick={stopSpeaking}
            title="Detener lectura" className="text-primary border-primary/50">
            <VolumeX size={16} />
          </Button>
        )}
        <Button type="button" size="icon" variant={isListening ? 'destructive' : 'outline'}
          onClick={startVoiceInput} disabled={isStreaming}
          title={isListening ? 'Detener grabación' : 'Dictar por voz'}
          className={isListening ? 'animate-pulse' : ''}>
          {isListening ? <MicOff size={16} /> : <Mic size={16} />}
        </Button>
        <Button type="submit" size="icon" disabled={isStreaming || !input.trim()}>
          <Send size={16} />
        </Button>
      </form>
    </div>
  )
}
