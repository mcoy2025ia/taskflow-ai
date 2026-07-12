'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserRound, Mail, LockKeyhole, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SignUpSchema, type SignUpInput } from '@/lib/validations/auth.schema'
import { signUp } from '@/actions/auth.actions'

export function RegisterForm() {
  const [isPending, startTransition] = useTransition()
  const [showPassword, setShowPassword] = useState(false)
  const { register, handleSubmit, setError, formState: { errors } } = useForm<SignUpInput>({ resolver: zodResolver(SignUpSchema) })
  function onSubmit(data: SignUpInput) { startTransition(async () => { const result = await signUp(data.email, data.password, data.full_name); if (!result.success) setError('root', { message: result.error }) }) }
  const fields = [{ id: 'full_name', label: 'Nombre completo', type: 'text', placeholder: 'Tu nombre', icon: UserRound, autoComplete: 'name' }, { id: 'email', label: 'Correo electrónico', type: 'email', placeholder: 'tu@email.com', icon: Mail, autoComplete: 'email' }] as const

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
      {fields.map(({ id, label, type, placeholder, icon: Icon, autoComplete }) => <div key={id} className="flex flex-col gap-1.5"><Label htmlFor={id} className="text-xs">{label}</Label><div className="relative"><Icon size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input id={id} type={type} autoComplete={autoComplete} placeholder={placeholder} className="h-10 pl-9" {...register(id)} /></div>{errors[id] && <p className="text-[11px] text-destructive">{errors[id]?.message}</p>}</div>)}
      <div className="flex flex-col gap-1.5"><Label htmlFor="password" className="text-xs">Contraseña</Label><div className="relative"><LockKeyhole size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Mínimo 8 caracteres" className="h-10 px-9" {...register('password')} /><button type="button" onClick={() => setShowPassword(show => !show)} className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[6px] text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff size={14} /> : <Eye size={14} />}</button></div>{errors.password && <p className="text-[11px] text-destructive">{errors.password.message}</p>}</div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="password_confirm" className="text-xs">Confirmar contraseña</Label><div className="relative"><LockKeyhole size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input id="password_confirm" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Repite tu contraseña" className="h-10 pl-9" {...register('password_confirm')} /></div>{errors.password_confirm && <p className="text-[11px] text-destructive">{errors.password_confirm.message}</p>}</div>
      {errors.root && <div role="alert" className="rounded-[8px] border border-destructive/20 bg-destructive/[0.07] px-3 py-2.5 text-xs text-destructive">{errors.root.message}</div>}
      <Button type="submit" disabled={isPending} className="mt-1 h-10 w-full gap-2 rounded-[8px] shadow-sm">{isPending ? <><Loader2 size={14} className="animate-spin" /> Creando...</> : <>Crear cuenta <ArrowRight size={14} /></>}</Button>
    </form>
  )
}
