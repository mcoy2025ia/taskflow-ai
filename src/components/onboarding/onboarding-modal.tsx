'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { seedDemoProject } from '@/actions/project.actions'

const STORAGE_KEY = 'onboarding_done'

const STEPS = [
  {
    icon: '👋',
    title: '¡Bienvenido a TaskFlow!',
    description:
      'Gestiona tus proyectos con un tablero Kanban inteligente, asistente de IA y analítica en tiempo real. Crea un proyecto demo para empezar en segundos.',
    action: 'demo',
  },
  {
    icon: '📋',
    title: 'Tablero Kanban',
    description:
      'Arrastra tareas entre columnas (Por hacer → En progreso → Listo), asigna prioridades y colabora con tu equipo. El orden se sincroniza en tiempo real.',
    action: null,
  },
  {
    icon: '🤖',
    title: 'Asistente con IA',
    description:
      'Pregunta en lenguaje natural: "¿Qué tareas están vencidas?", "Resume el estado del proyecto". El asistente busca en tu tablero y responde con contexto real.',
    action: null,
  },
  {
    icon: '📊',
    title: 'Analítica y reportes',
    description:
      'Visualiza el burndown, velocidad y fases del pipeline. Exporta un informe ejecutivo en PDF generado por IA con un solo clic.',
    action: 'finish',
  },
] as const

export function OnboardingModal() {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem(STORAGE_KEY)) {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  function handleNext() {
    if (step < STEPS.length - 1) setStep(s => s + 1)
  }

  function handleDemo() {
    startTransition(async () => {
      const result = await seedDemoProject()
      if (result.success) {
        dismiss()
        router.push(`/board?project_id=${result.data.id}`)
      }
    })
  }

  function handleFinish() {
    dismiss()
    router.push('/board')
  }

  if (!visible) return null

  const current = STEPS[step]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-background border border-border/60 shadow-2xl p-6 flex flex-col gap-5">
        {/* Skip */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          Omitir
        </button>

        {/* Step indicator */}
        <div className="flex gap-1.5 justify-center">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6 bg-indigo-500' : 'w-1.5 bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="text-center space-y-3 py-2">
          <div className="text-5xl">{current.icon}</div>
          <h2 className="text-lg font-bold">{current.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{current.description}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex-1 py-2 rounded-lg border border-border/60 text-sm hover:bg-muted/50 transition-colors"
            >
              Atrás
            </button>
          )}

          {current.action === 'demo' ? (
            <button
              onClick={handleDemo}
              disabled={isPending}
              className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isPending ? (
                <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Creando…</>
              ) : (
                'Crear proyecto demo'
              )}
            </button>
          ) : current.action === 'finish' ? (
            <button
              onClick={handleFinish}
              className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
            >
              Ir al tablero →
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
            >
              Siguiente →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
