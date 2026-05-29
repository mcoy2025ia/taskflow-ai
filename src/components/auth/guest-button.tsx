'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signInAsGuest } from '@/actions/auth.actions'

export function GuestButton() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function handleGuest() {
    setError(null)
    startTransition(async () => {
      const result = await signInAsGuest()
      if (!result.success) {
        setError(result.error)
      } else {
        router.push('/board')
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={handleGuest}
        disabled={isPending}
        className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed underline underline-offset-4 transition-colors"
      >
        {isPending ? 'Entrando…' : 'Entrar como invitado'}
      </button>
      {error && (
        <p className="text-xs text-destructive text-center">{error}</p>
      )}
    </div>
  )
}
