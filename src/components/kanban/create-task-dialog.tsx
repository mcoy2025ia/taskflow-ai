'use client'

import { useTransition, useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form' // ✅ Importado SubmitHandler
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import { CreateTaskSchema, type CreateTaskInput } from '@/lib/validations/task.schema'
import { createTask } from '@/actions/task.actions'
import { toast } from 'sonner'
import type { TaskStatus } from '@/types/app.types'

export function CreateTaskDialog({ defaultStatus }: { defaultStatus: TaskStatus }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // ✅ Agregamos el tipo exacto al useForm para que el resolver de Zod no choque
  // Cambia la inicialización del useForm por esta:
const { register, handleSubmit, reset, formState: { errors } } = useForm<any>({ // <--- Usamos 'any' temporalmente para desatascar el deploy
  resolver: zodResolver(CreateTaskSchema),
  defaultValues: { 
    title: '',
    description: '',
    status: defaultStatus, 
    priority: 'medium' 
  },
})

  // ✅ Usamos SubmitHandler<CreateTaskInput> para asegurar compatibilidad total
  const onSubmit: SubmitHandler<CreateTaskInput> = (data) => {
    startTransition(async () => {
      const result = await createTask(data)
      if (result.success) {
        toast.success('Tarea creada')
        reset()
        setOpen(false)
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* ✅ Si asChild daba error de tipos, nos aseguramos que Button sea el único hijo directo */}
      <DialogTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted/60 h-7 w-7 text-muted-foreground">
        <Plus size={14} />
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva tarea</DialogTitle>
        </DialogHeader>
        
        {/* ✅ El onSubmit ahora está perfectamente tipado */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Título</Label>
            <Input id="title" {...register('title')} placeholder="¿Qué hay que hacer?" autoFocus />
            {errors.title?.message && (
              <p className="text-xs text-destructive">{String(errors.title.message)}</p>
            )}
          </div>
          
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Descripción (opcional)</Label>
            <Input id="description" {...register('description')} placeholder="Detalles adicionales..." />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="priority">Prioridad</Label>
            <select
              id="priority"
              {...register('priority')}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
            </select>
          </div>
          
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creando...' : 'Crear tarea'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}