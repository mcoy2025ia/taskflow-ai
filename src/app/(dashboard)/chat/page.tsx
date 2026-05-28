import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/get-user'
import { ChatInterfaceDynamic } from '@/components/chat/chat-dynamic'
import { MessageSquareText } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Asistente RAG',
  description: 'Busca y analiza tus tareas con lenguaje natural usando el asistente de inteligencia artificial.',
}

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const [user, params] = await Promise.all([getAuthUser(), searchParams])
  if (!user) redirect('/login')

  // Verify session belongs to this user before trusting the URL param
  let initialSessionId: string | null = null
  if (params.session_id) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', params.session_id)
      .eq('user_id', user.id)
      .single()
    initialSessionId = data?.id ?? null
  }

  return (
    <main className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 border-b border-border/50 px-4 py-3 sm:px-6 sm:py-4 flex items-center gap-2">
        <MessageSquareText size={18} className="text-primary" />
        <div>
          <h1 className="text-base font-semibold">Asistente RAG</h1>
          <p className="text-xs text-muted-foreground">
            Busca y analiza tus tareas con lenguaje natural
          </p>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatInterfaceDynamic initialSessionId={initialSessionId} />
      </div>
    </main>
  )
}
