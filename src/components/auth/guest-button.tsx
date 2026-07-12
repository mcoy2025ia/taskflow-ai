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
        className="rounded-[7px] px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? 'Entrando...' : 'Explorar como invitado'}
      </button>
      {error && (
        <p className="text-xs text-destructive text-center">{error}</p>
      )}
    </div>
  )
}
