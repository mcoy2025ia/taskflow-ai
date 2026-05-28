'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="es">
      <body style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: '400px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Algo salió mal
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            El error fue registrado automáticamente.
            {error.digest && (
              <span style={{ display: 'block', marginTop: '0.25rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                ID: {error.digest}
              </span>
            )}
          </p>
          <button
            onClick={reset}
            style={{ padding: '0.5rem 1.25rem', borderRadius: '0.5rem', background: '#4f46e5', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Intentar de nuevo
          </button>
        </div>
      </body>
    </html>
  )
}
