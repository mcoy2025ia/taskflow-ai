import type { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from '@/components/auth/login-form'
import { GuestButton } from '@/components/auth/guest-button'
import { AuthShell } from '@/components/auth/auth-shell'

export const metadata: Metadata = { title: 'Iniciar sesión', description: 'Accede a tu workspace de TaskFlow AI.' }

export default function LoginPage() {
  return <AuthShell eyebrow="Bienvenido" title="Continúa donde lo dejaste." description="Ingresa a tu espacio de trabajo para retomar el proyecto." footer={<div className="flex flex-col items-center gap-3"><p className="text-xs text-muted-foreground">¿No tienes cuenta? <Link href="/register" className="font-semibold text-primary hover:underline">Crear cuenta</Link></p><GuestButton /></div>}><LoginForm /></AuthShell>
}
