import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/login-form'
import { Zap } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Iniciar sesión',
  description: 'Accede a tu workspace de TaskFlow AI para gestionar tus tareas con inteligencia artificial.',
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 flex items-center justify-center mb-3">
            <Zap size={20} className="text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">TaskFlow AI</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Inicia sesión en tu workspace
          </p>
        </div>

        {/* Card */}
        <div className="bg-background border border-border/50 rounded-xl p-6 shadow-sm">
          <LoginForm />
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          ¿No tienes cuenta?{' '}
          <Link
            href="/register"
            className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            Regístrate gratis
          </Link>
        </p>
      </div>
    </div>
  )
}