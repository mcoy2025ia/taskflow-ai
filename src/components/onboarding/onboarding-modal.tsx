'use client'

import { useEffect, useState, useTransition, type ElementType } from 'react'
import { useRouter } from 'next/navigation'
import { X, LayoutDashboard, Sparkles, ChartNoAxesCombined, ArrowLeft, ArrowRight, Loader2, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { seedDemoProject } from '@/actions/project.actions'

const STORAGE_KEY = 'onboarding_done'
const STEPS: { icon: ElementType; title: string; description: string; action: 'demo' | 'finish' | null }[] = [
  { icon: WandSparkles, title: 'Tu workspace está listo', description: 'Empieza con un proyecto de ejemplo o explora cada espacio a tu ritmo.', action: 'demo' },
  { icon: LayoutDashboard, title: 'Trabajo visible y ordenado', description: 'Mueve tareas entre columnas, asigna responsables y mantén las prioridades a la vista.', action: null },
  { icon: Sparkles, title: 'Un asistente con contexto', description: 'Pregunta por riesgos, busca pendientes o crea tareas usando lenguaje natural.', action: null },
  { icon: ChartNoAxesCombined, title: 'Decisiones con perspectiva', description: 'Sigue el avance, la velocidad y la trayectoria de entrega del proyecto.', action: 'finish' },
]

export function OnboardingModal() {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  useEffect(() => { if (!localStorage.getItem(STORAGE_KEY)) setVisible(true) }, [])
  function dismiss() { localStorage.setItem(STORAGE_KEY, '1'); setVisible(false) }
  function handleDemo() { startTransition(async () => { const result = await seedDemoProject(); if (result.success) { dismiss(); router.push(`/board?project_id=${result.data.id}`) } }) }
  function handleFinish() { dismiss(); router.push('/board') }
  if (!visible) return null

  const current = STEPS[step]
  const Icon = current.icon
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm animate-in">
      <div className="material-panel relative flex w-full max-w-md flex-col gap-6 rounded-[8px] p-5 shadow-2xl sm:p-6">
        <button onClick={dismiss} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-[7px] text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Omitir introducción"><X size={15} /></button>
        <div className="flex gap-1.5 pr-10">{STEPS.map((_, index) => <div key={index} className={`h-1 flex-1 rounded-full transition-colors ${index <= step ? 'bg-primary' : 'bg-muted'}`} />)}</div>
        <div className="py-3 text-center" key={step}>
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-[8px] bg-primary/10 text-primary animate-in"><Icon size={21} /></div>
          <p className="text-lg font-semibold">{current.title}</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{current.description}</p>
        </div>
        <div className="flex gap-2">
          {step > 0 && <Button variant="outline" onClick={() => setStep(value => value - 1)} className="h-10 flex-1 gap-2 rounded-[8px]"><ArrowLeft size={14} /> Atrás</Button>}
          {current.action === 'demo' ? (
            <Button onClick={handleDemo} disabled={isPending} className="h-10 flex-1 gap-2 rounded-[8px]">{isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}{isPending ? 'Creando...' : 'Crear proyecto demo'}</Button>
          ) : current.action === 'finish' ? (
            <Button onClick={handleFinish} className="h-10 flex-1 gap-2 rounded-[8px]">Ir al tablero <ArrowRight size={14} /></Button>
          ) : (
            <Button onClick={() => setStep(value => value + 1)} className="h-10 flex-1 gap-2 rounded-[8px]">Siguiente <ArrowRight size={14} /></Button>
          )}
        </div>
      </div>
    </div>
  )
}
