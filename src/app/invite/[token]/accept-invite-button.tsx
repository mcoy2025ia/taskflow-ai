'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptInvitation } from '@/actions/invite.actions'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function AcceptInviteButton({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  function handleAccept() {
    startTransition(async () => {
      const result = await acceptInvitation(token)
      if (result.success) {
        toast.success('¡Invitación aceptada! Accediendo al proyecto…')
        router.push('/board')
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <button
      onClick={handleAccept}
      disabled={isPending}
      className={cn(
        'mt-4 w-full py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium',
        'hover:bg-indigo-700 transition-colors',
        'disabled:opacity-60 disabled:cursor-not-allowed'
      )}
    >
      {isPending ? 'Aceptando…' : 'Aceptar invitación'}
    </button>
  )
}
