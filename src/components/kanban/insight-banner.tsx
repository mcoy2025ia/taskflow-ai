'use client'

import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface InsightBannerProps { overdueCount: number; atRisk: boolean }

export function InsightBanner({ overdueCount, atRisk }: InsightBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed || (overdueCount === 0 && !atRisk)) return null

  const messages: string[] = []
  if (overdueCount > 0) messages.push(`${overdueCount} tarea${overdueCount > 1 ? 's' : ''} vencida${overdueCount > 1 ? 's' : ''}`)
  if (atRisk) messages.push('el ritmo actual requiere atención')

  return (
    <div className="mb-4 flex items-center gap-3 rounded-[8px] border border-amber-500/25 bg-amber-500/[0.07] px-3.5 py-3 text-sm text-amber-800 animate-in dark:text-amber-200">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-amber-500/12"><AlertTriangle size={14} /></div>
      <p className="min-w-0 flex-1 text-xs leading-relaxed"><span className="font-semibold">Atención:</span> {messages.join(' y ')}.</p>
      <button onClick={() => setDismissed(true)} aria-label="Cerrar alerta" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-amber-700/60 hover:bg-amber-500/10 hover:text-amber-800 dark:text-amber-200/60"><X size={14} /></button>
    </div>
  )
}
