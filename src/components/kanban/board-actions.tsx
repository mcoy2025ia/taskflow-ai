'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Database, Trash2, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { seedOlistTasks, deleteAllTasks } from '@/actions/project.actions'

interface BoardActionsProps {
  projectId: string | null
}

export function BoardActions({ projectId }: BoardActionsProps) {
  const [isSeedPending, startSeedTransition] = useTransition()
  const [isDeletePending, startDeleteTransition] = useTransition()
  const [deleteOpen, setDeleteOpen] = useState(false)

  function handleSeed() {
    startSeedTransition(async () => {
      const result = await seedOlistTasks(projectId)
      if (result.success) {
        toast.success(
          `✅ ${result.data.count} tareas Olist creadas — los embeddings se generan en segundo plano.`
        )
      } else {
        toast.error(`Error al poblar: ${result.error}`)
      }
    })
  }

  function handleDeleteAll() {
    startDeleteTransition(async () => {
      const result = await deleteAllTasks(projectId)
      if (result.success) {
        toast.success('Tablero limpiado. Comienza de cero 🗑️')
        setDeleteOpen(false)
      } else {
        toast.error(`Error al borrar: ${result.error}`)
      }
    })
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      {/* ── Poblar con tareas Olist ── */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleSeed}
        disabled={isSeedPending}
        className="gap-1.5 text-xs h-8"
        title="Genera 60+ tareas del proyecto Olist (datos, ML, IA, Streamlit)"
      >
        {isSeedPending ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Database size={13} />
        )}
        {isSeedPending ? 'Generando...' : 'Poblar Olist'}
      </Button>

      {/* ── Borrar todas las tareas (con confirmación) ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger
          render={
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5 text-xs h-8"
              title="Elimina todas las tareas del tablero actual"
            />
          }
        >
          <Trash2 size={13} />
          Borrar todo
        </DialogTrigger>

        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle size={17} />
              Borrar todas las tareas
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground leading-relaxed">
            Esta acción eliminará{' '}
            <strong className="text-foreground">todas las tareas</strong>
            {projectId ? ' del proyecto activo' : ' de tu espacio personal'} de
            forma permanente, incluyendo sus embeddings y comentarios.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Esta operación no se puede deshacer.
          </p>

          <div className="flex gap-2 justify-end mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeletePending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteAll}
              disabled={isDeletePending}
              className="gap-1.5"
            >
              {isDeletePending ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Borrando…
                </>
              ) : (
                <>
                  <Trash2 size={13} />
                  Sí, borrar todo
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
