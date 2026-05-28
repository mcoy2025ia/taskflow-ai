'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface UseRealtimeTasksOptions {
  projectId: string | null
  currentUserId: string
}

const EVENT_LABELS: Record<string, string> = {
  INSERT: 'añadió una tarea',
  UPDATE: 'actualizó una tarea',
  DELETE: 'eliminó una tarea',
}

export function useRealtimeTasks({ projectId, currentUserId }: UseRealtimeTasksOptions) {
  const router = useRouter()
  // Stable ref to avoid re-subscribing on router identity changes
  const routerRef = useRef(router)
  routerRef.current = router

  useEffect(() => {
    if (!projectId) return

    const supabase = createClient()

    const channel = supabase
      .channel(`project-tasks:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          // Skip own changes — they're already reflected via useOptimistic
          const record = (payload.new ?? payload.old) as { user_id?: string } | null
          if (record?.user_id === currentUserId) return

          const label = EVENT_LABELS[payload.eventType] ?? 'modificó el tablero'
          toast.info(`Un colaborador ${label}`, { duration: 3000, id: 'collab-task-change' })
          routerRef.current.refresh()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_assignments',
        },
        () => {
          // Silently refresh for assignment changes (no user_id to check ownership)
          routerRef.current.refresh()
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[realtime] Error al suscribirse al canal de tareas')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId, currentUserId])
}
