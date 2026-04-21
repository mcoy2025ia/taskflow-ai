import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Página no encontrada',
  description: 'La página que buscas no existe.',
}

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-xl font-semibold">404 — No encontrado</h2>
      <p className="text-muted-foreground mt-1">La página que buscas no existe.</p>
      <Link href="/" className="mt-4 text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
        Volver al inicio
      </Link>
    </div>
  )
}