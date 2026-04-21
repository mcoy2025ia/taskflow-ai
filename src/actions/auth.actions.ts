'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

type ActionResult = { success: true } | { success: false; error: string }

export async function signOut(): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()

  if (error) return { success: false, error: error.message }

  redirect('/login')
}

export async function signIn(
  email: string,
  password: string
): Promise<ActionResult> {
  const supabase = await createClient()

  let authError: unknown
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    authError = error
  } catch (err) {
    // Supabase SDK may throw for severely malformed inputs.
    // Re-throw Next.js redirect signals; treat everything else as auth failure.
    if ((err as { digest?: string })?.digest?.startsWith('NEXT_REDIRECT')) throw err
    return { success: false, error: 'Credenciales inválidas' }
  }

  if (authError) return { success: false, error: 'Credenciales inválidas' }

  redirect('/board')
}

export async function signUp(
  email: string,
  password: string,
  fullName: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })

  if (error) return { success: false, error: error.message }

  redirect('/board')
}