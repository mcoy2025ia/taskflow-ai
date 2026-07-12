'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Send, Sparkles, User, Mic, MicOff, VolumeX, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useChatStream } from '@/hooks/use-chat-stream'
import { useVoiceInput } from '@/hooks/use-voice-input'
import { useChatTTS } from '@/hooks/use-chat-tts'
import { useActiveProjectSafe } from '@/contexts/active-project'
import { MessageContent, ToolActivityList, ConfirmCard, SourceChips } from './message-renderer'

export interface ChatInterfaceProps { initialSessionId?: string | null }
const SUGGESTIONS = ['Resume el estado del proyecto', '¿Qué tareas están en riesgo?', 'Prioriza mis pendientes']

export function ChatInterface({ initialSessionId = null }: ChatInterfaceProps) {
  const [input, setInput] = useState('')
  const searchParams = useSearchParams()
  const projectCtx = useActiveProjectSafe()
  const activeProjectId = searchParams.get('project_id') ?? projectCtx?.activeProject?.id
  const { isSpeaking, speakText, stopSpeaking } = useChatTTS()
  const { messages, isStreaming, highlightedSource, sendMessage, handleConfirm, handleCancel, handleCiteClick, bottomRef, scrollContainerRef, handleScroll } = useChatStream({ initialSessionId, activeProjectId, onVoiceResponse: speakText })
  const { isListening, voiceMode, setVoiceMode, startVoiceInput } = useVoiceInput({ onTranscript: setInput, onSubmit: text => { setInput(''); sendMessage(text, true) } })

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const text = input
    setInput('')
    setVoiceMode(false)
    await sendMessage(text, voiceMode)
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col">
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
        {messages.map((message, index) => (
          <div key={message.id} className={cn('flex gap-3 animate-in', message.role === 'user' && 'flex-row-reverse')} style={{ animationDelay: `${Math.min(index, 4) * 35}ms` }}>
            <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border', message.role === 'assistant' ? 'border-primary/15 bg-primary/[0.08] text-primary' : 'border-border/70 bg-card text-muted-foreground shadow-sm')}>
              {message.role === 'assistant' ? <Sparkles size={15} /> : <User size={14} />}
            </div>
            <div className={cn('flex max-w-[84%] flex-col gap-2 sm:max-w-[76%]', message.role === 'user' && 'items-end')}>
              <div className={cn('text-sm leading-7', message.role === 'assistant' ? 'text-foreground' : 'rounded-[8px] bg-foreground px-4 py-2.5 text-background shadow-sm')}>
                {message.isStreaming && !message.content ? (
                  <span className="inline-flex h-7 items-center gap-1.5">{[0, 1, 2].map(dot => <span key={dot} className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${dot * 120}ms` }} />)}</span>
                ) : message.isStreaming ? message.content : message.role === 'assistant' && message.content ? (
                  <MessageContent text={message.content} sources={message.sources ?? []} onCite={idx => handleCiteClick(message.id, idx)} />
                ) : message.content || null}
              </div>
              {message.toolActivity && message.toolActivity.length > 0 && <ToolActivityList activity={message.toolActivity} />}
              {message.pendingConfirm && <ConfirmCard confirm={message.pendingConfirm} onConfirm={() => handleConfirm(message)} onCancel={() => handleCancel(message.id)} />}
              {message.sources && message.sources.length > 0 && <SourceChips sources={message.sources} messageId={message.id} highlighted={highlightedSource} />}
              {message.id === 'welcome' && messages.length === 1 && (
                <div className="mt-1 flex flex-wrap gap-2">{SUGGESTIONS.map(suggestion => <button key={suggestion} onClick={() => setInput(suggestion)} className="rounded-full border border-border/80 bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm hover:border-primary/25 hover:text-primary">{suggestion}</button>)}</div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {(isListening || isSpeaking) && <div className="px-4 pb-2 sm:px-8"><div className="flex items-center gap-2 text-[11px] font-medium"><span className={cn('h-2 w-2 rounded-full animate-pulse', isListening ? 'bg-red-500' : 'bg-primary')} /><span className={isListening ? 'text-red-600 dark:text-red-300' : 'text-primary'}>{isListening ? 'Escuchando...' : 'Reproduciendo respuesta'}</span></div></div>}

      <div className="px-3 pb-3 sm:px-7 sm:pb-5">
        <form onSubmit={handleSubmit} className="material-panel flex items-center gap-2 rounded-[8px] p-2 shadow-[0_12px_38px_rgba(32,47,74,0.10)] focus-within:border-primary/30">
          <div className="hidden h-8 w-8 shrink-0 items-center justify-center text-primary sm:flex"><WandSparkles size={16} /></div>
          <Input value={input} onChange={event => { setInput(event.target.value); setVoiceMode(false) }} placeholder={isListening ? 'Escuchando...' : 'Pregunta o pide una acción...'} disabled={isStreaming || isListening} className="h-10 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0" autoFocus />
          {isSpeaking && <Button type="button" size="icon" variant="ghost" onClick={stopSpeaking} title="Detener lectura" className="h-9 w-9 rounded-[7px] text-primary"><VolumeX size={16} /></Button>}
          <Button type="button" size="icon" variant="ghost" onClick={startVoiceInput} disabled={isStreaming} title={isListening ? 'Detener grabación' : 'Dictar por voz'} className={cn('h-9 w-9 rounded-[7px] text-muted-foreground', isListening && 'bg-red-500/10 text-red-600 animate-pulse')}>{isListening ? <MicOff size={16} /> : <Mic size={16} />}</Button>
          <Button type="submit" size="icon" disabled={isStreaming || !input.trim()} className="h-9 w-9 rounded-[7px] shadow-sm"><Send size={15} /></Button>
        </form>
        <p className="mt-2 text-center text-[9px] text-muted-foreground/70">Las acciones destructivas siempre requieren confirmación.</p>
      </div>
    </div>
  )
}
