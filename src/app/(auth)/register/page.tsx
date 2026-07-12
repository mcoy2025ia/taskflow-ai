import type { Metadata } from 'next'
import Link from 'next/link'
import { RegisterForm } from '@/components/auth/register-form'
import { AuthShell } from '@/components/auth/auth-shell'

export const metadata: Metadata = { title: 'Crear cuenta', description: 'Crea tu cuenta en TaskFlow AI.' }

export default function RegisterPage() {
  return <AuthShell eyebrow="Nuevo workspace" title="Empieza con claridad." description="Crea tu cuenta y organiza el próximo avance de tu equipo." footer={<p className="text-xs text-muted-foreground">¿Ya tienes cuenta? <Link href="/login" className="font-semibold text-primary hover:underline">Iniciar sesión</Link></p>}><RegisterForm /></AuthShell>
}
