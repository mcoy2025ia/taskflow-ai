'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Mail, LockKeyhole, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SignInSchema, type SignInInput } from '@/lib/validations/auth.schema'
import { signIn } from '@/actions/auth.actions'

export function LoginForm() {
  const [isPending, startTransition] = useTransition()
  const [showPassword, setShowPassword] = useState(false)
  const { register, handleSubmit, setError, formState: { errors } } = useForm<SignInInput>({ resolver: zodResolver(SignInSchema) })
  function onSubmit(data: SignInInput) { startTransition(async () => { const result = await signIn(data.email, data.password); if (!result.success) setError('root', { message: result.error }) }) }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5"><Label htmlFor="email" className="text-xs">Correo electrónico</Label><div className="relative"><Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input id="email" type="email" autoComplete="email" placeholder="tu@email.com" className="h-10 pl-9" autoFocus {...register('email')} /></div>{errors.email && <p className="text-[11px] text-destructive">{errors.email.message}</p>}</div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="password" className="text-xs">Contraseña</Label><div className="relative"><LockKeyhole size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="8 caracteres o más" className="h-10 px-9" {...register('password')} /><button type="button" onClick={() => setShowPassword(show => !show)} className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[6px] text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff size={14} /> : <Eye size={14} />}</button></div>{errors.password && <p className="text-[11px] text-destructive">{errors.password.message}</p>}</div>
      {errors.root && <div role="alert" className="rounded-[8px] border border-destructive/20 bg-destructive/[0.07] px-3 py-2.5 text-xs text-destructive">{errors.root.message}</div>}
      <Button type="submit" disabled={isPending} className="mt-1 h-10 w-full gap-2 rounded-[8px] shadow-sm">{isPending ? <><Loader2 size={14} className="animate-spin" /> Iniciando...</> : <>Iniciar sesión <ArrowRight size={14} /></>}</Button>
    </form>
  )
}
