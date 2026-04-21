import { RegisterForm } from '@/components/auth/register-form'
import { Zap } from 'lucide-react'
import Link from 'next/link'

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 flex items-center justify-center mb-3">
            <Zap size={20} className="text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">TaskFlow AI</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crea tu workspace en segundos
          </p>
        </div>

        <div className="bg-background border border-border/50 rounded-xl p-6 shadow-sm">
          <RegisterForm />
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          ¿Ya tienes cuenta?{' '}
          <Link
            href="/login"
            className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}