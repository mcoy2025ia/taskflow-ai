'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { UploadCloud, Download, Sparkles, FileText, Loader2, CircleCheck, TriangleAlert, ArrowRight, Wand2, Building2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { importTasksCSV, generateTasksCSV, type ImportResult } from '@/actions/import.actions'
import { DEFAULT_GENERATE_TASKS_PROMPT } from '@/lib/ai/generate-tasks-prompt'
import type { ProjectMember } from '@/types/app.types'

const FIELDS = [
  { name: 'title', desc: 'Nombre de la tarea', example: 'Preparar informe', required: true },
  { name: 'description', desc: 'Detalle opcional', example: 'Resumen para dirección', required: false },
  { name: 'status', desc: 'Estado', example: 'todo', required: false },
  { name: 'priority', desc: 'Prioridad', example: 'high', required: false },
  { name: 'due_date', desc: 'Fecha límite', example: '2026-05-15', required: false },
]

const TEMPLATE_CSV = `title,description,status,priority,due_date
Setup infraestructura base,Configurar repositorio y entorno,todo,high,2026-04-05
Validar dataset,Ejecutar reporte de calidad,in_progress,high,2026-04-10
Preparar dashboard,Construir indicadores principales,todo,medium,2026-04-18
Documentar entrega,Crear guía de operación,todo,low,2026-04-25
`

function buildContextBlock(company: string, area: string, participants: string[]): string {
  return [
    'CONTEXTO DEL PROYECTO (respétalo al redactar títulos y descripciones):',
    `- Empresa: ${company.trim() || 'No especificada'}`,
    `- Proyecto / Área para la que es: ${area.trim() || 'No especificado'}`,
    `- Personas que van a participar: ${participants.length ? participants.join(', ') : 'No especificadas'}`,
    'Redacta las tareas como si realmente pertenecieran a este proyecto y equipo.',
  ].join('\n')
}

function parseCSV(raw: string): { headers: string[]; rows: Record<string, string>[] } {
  const text = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = text.split('\n').filter(line => line.trim() !== '')
  if (lines.length < 2) return { headers: [], rows: [] }
  const parseRow = (line: string): string[] => {
    const cells: string[] = []
    let current = '', quoted = false
    for (let index = 0; index < line.length; index++) {
      const character = line[index]
      if (character === '"') {
        if (quoted && line[index + 1] === '"') { current += '"'; index++ }
        else quoted = !quoted
      } else if (character === ',' && !quoted) { cells.push(current.trim()); current = '' }
      else current += character
    }
    cells.push(current.trim())
    return cells
  }
  const headers = parseRow(lines[0]).map(header => header.replace(/^"|"$/g, '').trim())
  const rows = lines.slice(1).map(line => {
    const values = parseRow(line)
    return Object.fromEntries(headers.map((header, index) => [header, (values[index] ?? '').replace(/^"|"$/g, '').trim()]))
  })
  return { headers, rows }
}

type Phase =
  | { id: 'idle' }
  | { id: 'parsed'; fileName: string; headers: string[]; rows: Record<string, string>[] }
  | { id: 'importing' }
  | { id: 'done'; result: ImportResult }
  | { id: 'error'; message: string }

interface CsvImportProps {
  projectId?: string | null
  projectName?: string | null
  company?: string | null
  department?: string | null
  members?: ProjectMember[]
}

export function CsvImport({ projectId, projectName, company: companyProp, department, members = [] }: CsvImportProps) {
  const [phase, setPhase] = useState<Phase>({ id: 'idle' })
  const [dragOver, setDragOver] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const [promptValue, setPromptValue] = useState(DEFAULT_GENERATE_TASKS_PROMPT)
  const [company, setCompany] = useState(companyProp ?? '')
  const [area, setArea] = useState(projectName ?? department ?? '')
  const [participantIds, setParticipantIds] = useState<string[]>(() => members.map(m => m.userId))
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const finalPrompt = useMemo(() => {
    const participantNames = members
      .filter(m => participantIds.includes(m.userId))
      .map(m => (m.role ? `${m.name} (${m.role})` : m.name))
    return `${buildContextBlock(company, area, participantNames)}\n\n${promptValue}`
  }, [company, area, participantIds, members, promptValue])

  function toggleParticipant(userId: string) {
    setParticipantIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId])
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = 'template-tareas.csv'
    document.body.appendChild(anchor); anchor.click(); document.body.removeChild(anchor); URL.revokeObjectURL(url)
  }

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv' && !file.type.includes('csv')) { setPhase({ id: 'error', message: 'Selecciona un archivo .csv válido.' }); return }
    const reader = new FileReader()
    reader.onload = event => {
      const { headers, rows } = parseCSV(event.target?.result as string)
      if (!rows.length) { setPhase({ id: 'error', message: 'El archivo no contiene filas de datos.' }); return }
      if (!headers.includes('title')) { setPhase({ id: 'error', message: 'No encontramos la columna obligatoria "title".' }); return }
      setPhase({ id: 'parsed', fileName: file.name, headers, rows })
    }
    reader.onerror = () => setPhase({ id: 'error', message: 'No pudimos leer el archivo.' })
    reader.readAsText(file, 'UTF-8')
  }, [])

  function onFileInput(event: React.ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (file) processFile(file); event.target.value = '' }
  function onDrop(event: React.DragEvent) { event.preventDefault(); setDragOver(false); const file = event.dataTransfer.files?.[0]; if (file) processFile(file) }

  async function handleGenerate() {
    setPromptOpen(false)
    setIsGenerating(true); setPhase({ id: 'idle' })
    const result = await generateTasksCSV(finalPrompt)
    setIsGenerating(false)
    if (!result.success) { setPhase({ id: 'error', message: result.error }); return }
    const { headers, rows } = parseCSV(result.csv)
    if (!rows.length) { setPhase({ id: 'error', message: 'La IA generó un CSV vacío. Intenta de nuevo.' }); return }
    setPhase({ id: 'parsed', fileName: `tareas-ia-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows })
  }

  async function handleImport() {
    if (phase.id !== 'parsed') return
    const rows = phase.rows
    setPhase({ id: 'importing' })
    const result = await importTasksCSV(projectId, rows)
    if (!result.success) { setPhase({ id: 'error', message: result.error }); return }
    setPhase({ id: 'done', result: result.data })
    if (result.data.inserted > 0) { router.refresh(); window.dispatchEvent(new CustomEvent('taskflow:board_update')) }
  }

  const canSelect = phase.id !== 'importing'
  const parsed = phase.id === 'parsed' ? phase : null

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 pb-8">
      <section className="material-panel rounded-[8px] p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex max-w-xl gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary"><FileText size={18} /></div><div><p className="text-sm font-semibold">Empieza con tus tareas</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Importa un CSV en {projectName ?? 'el proyecto activo'} o deja que la IA prepare una base editable.</p></div></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={downloadTemplate} className="h-9 gap-2 rounded-[8px] text-xs"><Download size={13} /> Plantilla</Button><Button size="sm" onClick={() => setPromptOpen(true)} disabled={isGenerating} className="h-9 gap-2 rounded-[8px] text-xs">{isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {isGenerating ? 'Generando...' : 'Generar con IA'}</Button></div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <div
          onClick={() => { if (canSelect) fileRef.current?.click() }}
          onDragOver={event => { event.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn('material-subtle flex min-h-[270px] cursor-pointer flex-col items-center justify-center rounded-[8px] border-2 border-dashed p-6 text-center', dragOver && 'border-primary bg-primary/[0.05]', phase.id === 'error' && 'border-destructive/45 bg-destructive/[0.04]', !canSelect && 'cursor-wait')}
        >
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileInput} />
          {phase.id === 'idle' && <><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[8px] bg-card text-primary shadow-sm"><UploadCloud size={21} /></div><p className="text-sm font-semibold">Suelta aquí tu archivo CSV</p><p className="mt-2 max-w-xs text-[11px] leading-relaxed text-muted-foreground">También puedes hacer clic para buscarlo. UTF-8, máximo 500 filas.</p></>}
          {phase.id === 'parsed' && <><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[8px] bg-emerald-500/10 text-emerald-600"><CircleCheck size={21} /></div><p className="max-w-full truncate text-sm font-semibold text-emerald-700 dark:text-emerald-300">{phase.fileName}</p><p className="mt-2 text-[11px] text-muted-foreground">{phase.rows.length} tareas listas para revisar</p></>}
          {phase.id === 'importing' && <><Loader2 size={28} className="mb-4 animate-spin text-primary" /><p className="text-sm font-semibold">Importando tareas...</p><p className="mt-2 text-[11px] text-muted-foreground">Estamos validando cada fila.</p></>}
          {phase.id === 'done' && <><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[8px] bg-emerald-500/10 text-emerald-600"><CircleCheck size={22} /></div><p className="text-sm font-semibold">Importación completada</p><p className="mt-2 text-[11px] text-muted-foreground">{phase.result.inserted} tareas agregadas, {phase.result.skipped} omitidas.</p></>}
          {phase.id === 'error' && <><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[8px] bg-destructive/10 text-destructive"><TriangleAlert size={21} /></div><p className="text-sm font-semibold text-destructive">Revisa el archivo</p><p className="mt-2 max-w-sm text-[11px] leading-relaxed text-muted-foreground">{phase.message}</p></>}
        </div>

        <div className="material-panel rounded-[8px] p-4 sm:p-5">
          <p className="mb-4 text-[10px] font-bold uppercase text-muted-foreground">Estructura esperada</p>
          <div className="space-y-1">{FIELDS.map(field => <div key={field.name} className="flex items-center gap-3 rounded-[7px] px-2 py-2 hover:bg-muted/50"><code className="w-24 shrink-0 text-[10px] font-semibold text-primary">{field.name}</code><div className="min-w-0 flex-1"><p className="truncate text-[10px] text-foreground">{field.desc}</p><p className="mt-0.5 truncate text-[9px] text-muted-foreground">Ej: {field.example}</p></div><span className={cn('rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase', field.required ? 'bg-red-500/10 text-red-600' : 'bg-muted text-muted-foreground')}>{field.required ? 'Req.' : 'Opc.'}</span></div>)}</div>
          <div className="mt-4 rounded-[7px] bg-muted/65 p-3"><code className="block overflow-x-auto whitespace-nowrap text-[9px] text-muted-foreground">title,description,status,priority,due_date</code></div>
        </div>
      </section>

      <Dialog open={promptOpen} onOpenChange={setPromptOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader className="border-b border-border/60 pb-3">
            <DialogTitle className="flex items-center gap-2"><Wand2 size={16} className="text-primary" /> Prompt para generar tareas</DialogTitle>
            <DialogDescription>Confirma para quién son estas tareas y revisa las instrucciones antes de enviarlas a la IA.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase text-muted-foreground"><Building2 size={11} /> Empresa</span>
              <Input value={company} onChange={event => setCompany(event.target.value)} placeholder="Ej: Sodimac" className="h-8 text-xs" />
            </label>
            <label className="block">
              <span className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase text-muted-foreground">Proyecto / Área</span>
              <Input value={area} onChange={event => setArea(event.target.value)} placeholder="Ej: Analítica de Mercadeo" className="h-8 text-xs" />
            </label>
          </div>

          {members.length > 0 && (
            <div>
              <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase text-muted-foreground"><Users size={11} /> Quiénes participan</span>
              <div className="flex flex-wrap gap-1.5">
                {members.map(member => {
                  const checked = participantIds.includes(member.userId)
                  return (
                    <button
                      key={member.userId}
                      type="button"
                      onClick={() => toggleParticipant(member.userId)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                        checked ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/70 bg-muted/40 text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {member.name}{member.role ? ` · ${member.role}` : ''}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <span className="mb-1.5 block text-[10px] font-semibold uppercase text-muted-foreground">Instrucciones de generación</span>
            <Textarea
              value={promptValue}
              onChange={event => setPromptValue(event.target.value)}
              rows={11}
              className="font-mono text-[11px] leading-relaxed"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              {promptValue !== DEFAULT_GENERATE_TASKS_PROMPT ? (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-muted-foreground" onClick={() => setPromptValue(DEFAULT_GENERATE_TASKS_PROMPT)}>Restaurar instrucciones originales</Button>
              ) : <span />}
            </div>
          </div>

          <details className="rounded-[7px] border border-border/60 bg-muted/30 px-3 py-2">
            <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">Ver prompt final completo</summary>
            <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-muted-foreground">{finalPrompt}</pre>
          </details>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setPromptOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleGenerate} disabled={!promptValue.trim()} className="gap-1.5"><Sparkles size={13} /> Generar tareas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {parsed && (
        <section className="overflow-hidden rounded-[8px] border border-border/70 bg-card shadow-sm animate-in">
          <div className="flex flex-col justify-between gap-3 border-b border-border/60 px-4 py-3 sm:flex-row sm:items-center"><div><p className="text-xs font-semibold">Vista previa</p><p className="mt-0.5 text-[10px] text-muted-foreground">Mostrando {Math.min(8, parsed.rows.length)} de {parsed.rows.length} filas</p></div><Button onClick={handleImport} size="sm" className="h-9 gap-2 rounded-[8px] text-xs">Importar {parsed.rows.length} tareas <ArrowRight size={13} /></Button></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-[10px]"><thead className="bg-muted/45 text-muted-foreground"><tr><th className="px-4 py-2.5 font-semibold">#</th>{parsed.headers.map(header => <th key={header} className="px-3 py-2.5 font-semibold">{header}</th>)}</tr></thead><tbody>{parsed.rows.slice(0, 8).map((row, index) => <tr key={index} className="border-t border-border/50"><td className="px-4 py-3 text-muted-foreground">{index + 1}</td>{parsed.headers.map(header => <td key={header} className="max-w-[220px] truncate px-3 py-3" title={row[header]}>{header === 'status' ? <StatusBadge value={row[header]} /> : header === 'priority' ? <PriorityBadge value={row[header]} /> : row[header] || <span className="text-muted-foreground">-</span>}</td>)}</tr>)}</tbody></table></div>
        </section>
      )}

      {phase.id === 'done' && <section className="material-panel flex flex-col justify-between gap-4 rounded-[8px] p-5 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold">{phase.result.inserted} tareas disponibles</p><p className="mt-1 text-[11px] text-muted-foreground">Los embeddings se generan en segundo plano para habilitar la búsqueda semántica.</p></div><Button variant="outline" size="sm" onClick={() => setPhase({ id: 'idle' })} className="rounded-[8px] text-xs">Importar otro archivo</Button></section>}
    </div>
  )
}

function StatusBadge({ value }: { value: string }) {
  const config = value === 'done' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : value === 'in_progress' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-slate-500/10 text-slate-600 dark:text-slate-300'
  return <span className={cn('rounded-full px-2 py-1 text-[9px] font-semibold', config)}>{value || 'todo'}</span>
}

function PriorityBadge({ value }: { value: string }) {
  const config = value === 'high' ? 'bg-red-500/10 text-red-700 dark:text-red-300' : value === 'low' ? 'bg-slate-500/10 text-slate-600 dark:text-slate-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
  return <span className={cn('rounded-full px-2 py-1 text-[9px] font-semibold', config)}>{value || 'medium'}</span>
}
