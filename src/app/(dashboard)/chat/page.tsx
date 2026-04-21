import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ChatInterface } from '@/components/chat/chat-interface'
import { MessageSquareText } from 'lucide-react'

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <main className="flex flex-col h-full">
      <div className="border-b border-border/50 px-6 py-4 flex items-center gap-2">
        <MessageSquareText size={18} className="text-primary" />
        <div>
          <h1 className="text-base font-semibold">Asistente RAG</h1>
          <p className="text-xs text-muted-foreground">
            Busca y analiza tus tareas con lenguaje natural
          </p>
        </div>
      </div>
      <ChatInterface />
    </main>
  )
}