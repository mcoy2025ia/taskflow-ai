'use client'

import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SignUpSchema, type SignUpInput } from '@/lib/validations/auth.schema'
import { signUp } from '@/actions/auth.actions'

export function RegisterForm() {
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignUpInput>({
    resolver: zodResolver(SignUpSchema),
  })

  function onSubmit(data: SignUpInput) {
    startTransition(async () => {
      const result = await signUp(data.email, data.password, data.full_name)
      if (!result.success) {
        setError('root', { message: result.error })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="full_name">Nombre completo</Label>
        <Input
          id="full_name"
          autoComplete="name"
          placeholder="Tu nombre"
          autoFocus
          {...register('full_name')}
        />
        {errors.full_name && (
          <p className="text-xs text-destructive">{errors.full_name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="tu@email.com"
          {...register('email')}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          {...register('password')}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password_confirm">Confirmar contraseña</Label>
        <Input
          id="password_confirm"
          type="password"
          autoComplete="new-password"
          placeholder="Repite tu contraseña"
          {...register('password_confirm')}
        />
        {errors.password_confirm && (
          <p className="text-xs text-destructive">{errors.password_confirm.message}</p>
        )}
      </div>

      {errors.root && (
        <div
          role="alert"
          className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2"
        >
          {errors.root.message}
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full mt-1">
        {isPending ? 'Creando cuenta...' : 'Crear cuenta'}
      </Button>
    </form>
  )
}