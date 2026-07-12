'use server'

import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/get-user'

type ActionResult<T = null> =
  | { success: true;  data: T }
  | { success: false; error: string }

export interface ChatSessionSummary {
  id: string
  title: string
  updated_at: string
}

export interface ChatMessageRow {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export async function getChatSessions(): Promise<ChatSessionSummary[]> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return []

  const { data } = await supabase
    .from('chat_sessions')
    .select('id, title, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(20)

  return data ?? []
}

export async function createChatSession(firstMessage: string): Promise<string | null> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return null

  const title = firstMessage.length > 60
    ? firstMessage.slice(0, 60) + '…'
    : firstMessage

  const { data } = await supabase
    .from('chat_sessions')
    .insert({ user_id: user.id, title })
    .select('id')
    .single()

  return data?.id ?? null
}

export async function getChatMessages(sessionId: string): Promise<ChatMessageRow[]> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return []

  const { data } = await supabase
    .from('chat_messages')
    .select('id, role, content')
    .eq('session_id', sessionId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  return (data ?? []) as ChatMessageRow[]
}

export async function saveMessages(
  sessionId: string,
  userContent: string,
  assistantContent: string
): Promise<ActionResult> {
  if (!assistantContent.trim()) return { success: true, data: null }

  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('chat_messages')
    .insert([
      { session_id: sessionId, user_id: user.id, role: 'user',      content: userContent },
      { session_id: sessionId, user_id: user.id, role: 'assistant', content: assistantContent },
    ])

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

export async function deleteChatSession(sessionId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('chat_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}
