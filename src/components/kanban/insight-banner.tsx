'use client'

import { useState } from 'react'

interface InsightBannerProps {
  overdueCount: number
  atRisk: boolean
}

export function InsightBanner({ overdueCount, atRisk }: InsightBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || (overdueCount === 0 && !atRisk)) return null

  const messages: string[] = []
  if (overdueCount > 0) {
    messages.push(`${overdueCount} tarea${overdueCount > 1 ? 's' : ''} vencida${overdueCount > 1 ? 's' : ''} sin completar`)
  }
  if (atRisk) {
    messages.push('la velocidad actual no alcanza para entregar a tiempo')
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400 mb-4">
      <span className="mt-0.5 shrink-0">⚠</span>
      <p className="flex-1">
        <span className="font-medium">Alerta: </span>
        {messages.join(' y ')}.
      </p>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Cerrar alerta"
        className="shrink-0 text-amber-500/60 hover:text-amber-500 transition-colors"
      >
        ✕
      </button>
    </div>
  )
}
