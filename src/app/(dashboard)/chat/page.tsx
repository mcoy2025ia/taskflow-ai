import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/get-user'
import { ChatInterfaceDynamic } from '@/components/chat/chat-dynamic'
import { Sparkles } from 'lucide-react'

export const metadata: Metadata = { title: 'Asistente IA', description: 'Busca y analiza tus tareas con lenguaje natural.' }

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const [user, params] = await Promise.all([getAuthUser(), searchParams])
  if (!user) redirect('/login')
  let initialSessionId: string | null = null
  if (params.session_id) {
    const supabase = await createClient()
    const { data } = await supabase.from('chat_sessions').select('id').eq('id', params.session_id).eq('user_id', user.id).single()
    initialSessionId = data?.id ?? null
  }
  return (
    <main className="page-enter flex h-full flex-col overflow-hidden">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border/65 px-4 py-4 sm:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary"><Sparkles size={17} /></div>
          <div className="min-w-0"><h1 className="truncate text-sm font-semibold sm:text-base">Asistente de proyecto</h1><p className="mt-0.5 truncate text-[11px] text-muted-foreground sm:text-xs">Entiende contexto, consulta tareas y ejecuta acciones.</p></div>
        </div>
        <div className="hidden items-center gap-2 text-[10px] font-medium text-muted-foreground sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Contexto activo</div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden"><ChatInterfaceDynamic initialSessionId={initialSessionId} /></div>
    </main>
  )
}
