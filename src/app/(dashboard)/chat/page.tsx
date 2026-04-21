import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/supabase/get-user'
import { ChatInterfaceDynamic } from '@/components/chat/chat-dynamic'
import { MessageSquareText } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Asistente RAG',
  description: 'Busca y analiza tus tareas con lenguaje natural usando el asistente de inteligencia artificial.',
}

export default async function ChatPage() {
  const user = await getAuthUser()
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
      <ChatInterfaceDynamic />
    </main>
  )
}
