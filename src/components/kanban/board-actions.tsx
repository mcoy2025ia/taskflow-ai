'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { deleteAllTasks } from '@/actions/project.actions'

interface BoardActionsProps { projectId: string | null; isGuest?: boolean }

export function BoardActions({ projectId, isGuest = false }: BoardActionsProps) {
  const [isDeletePending, startDeleteTransition] = useTransition()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const router = useRouter()

  function handleDeleteAll() {
    startDeleteTransition(async () => {
      const result = await deleteAllTasks(projectId)
      if (result.success) {
        toast.success('Tablero limpiado. Puedes comenzar de cero.')
        setDeleteOpen(false)
      } else toast.error(`Error al borrar: ${result.error}`)
    })
  }

  if (isGuest) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/register')}
          className="h-9 gap-1.5 rounded-[8px] border-border/80 bg-card px-3 text-xs text-muted-foreground shadow-sm hover:border-primary/30 hover:bg-primary/[0.06] hover:text-primary"
          title="Crea tu cuenta para gestionar tus propias tareas"
        >
          <Trash2 size={13} />
          <span className="hidden sm:inline">Limpiar</span>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger render={<Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-[8px] border-border/80 bg-card px-3 text-xs text-muted-foreground shadow-sm hover:border-destructive/30 hover:bg-destructive/[0.06] hover:text-destructive" title="Elimina todas las tareas del tablero actual" />}>
          <Trash2 size={13} />
          <span className="hidden sm:inline">Limpiar</span>
        </DialogTrigger>

        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="border-b border-border/60 pb-3">
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle size={17} /> Borrar todas las tareas</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Esta acción eliminará <strong className="text-foreground">todas las tareas</strong>
            {projectId ? ' del proyecto activo' : ' de tu espacio personal'} de forma permanente, incluyendo sus embeddings y comentarios.
          </p>
          <p className="text-xs text-muted-foreground/70">Esta operación no se puede deshacer.</p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(false)} disabled={isDeletePending}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteAll} disabled={isDeletePending} className="gap-1.5">
              {isDeletePending ? <><Loader2 size={13} className="animate-spin" /> Borrando...</> : <><Trash2 size={13} /> Sí, borrar todo</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
