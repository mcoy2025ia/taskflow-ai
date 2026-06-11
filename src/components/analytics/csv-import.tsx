'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { importTasksCSV, generateTasksCSV, type ImportResult } from '@/actions/import.actions'

// ── Design tokens (same as analytics page) ───────────────────────────────────
const T = {
  bg2:      '#0b0e1a',
  surface:  '#131729',
  surface2: '#1a1f38',
  border:   'rgba(255,255,255,0.07)',
  border2:  'rgba(255,255,255,0.12)',
  blue:     '#1d70e8',
  blueLt:   '#4d9bff',
  text:     'rgba(240,244,255,0.88)',
  textDim:  'rgba(240,244,255,0.45)',
  textMute: 'rgba(240,244,255,0.28)',
  green:    '#22c55e',
  greenLt:  '#4ade80',
  amber:    '#f59e0b',
  amberLt:  '#fbbf24',
  red:      '#ef4444',
  redLt:    '#f87171',
  mono:     "'DM Mono', 'SF Mono', ui-monospace, monospace",
  font:     "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}

// ── CSV fields structure ──────────────────────────────────────────────────────
const FIELDS = [
  {
    name: 'title',
    type: 'texto',
    desc: 'Nombre de la tarea',
    example: 'ETL Bronze Layer',
    required: true,
    note: 'Máx. 200 caracteres',
  },
  {
    name: 'description',
    type: 'texto',
    desc: 'Descripción detallada',
    example: 'Pipeline de ingesta cruda con hash de deduplicación',
    required: false,
    note: 'Máx. 2 000 caracteres',
  },
  {
    name: 'status',
    type: 'enum',
    desc: 'Estado de la tarea',
    example: 'todo',
    required: false,
    note: 'todo · in_progress · done  (default: todo)',
  },
  {
    name: 'priority',
    type: 'enum',
    desc: 'Prioridad',
    example: 'high',
    required: false,
    note: 'low · medium · high  (default: medium)',
  },
  {
    name: 'due_date',
    type: 'fecha',
    desc: 'Fecha límite',
    example: '2026-05-15',
    required: false,
    note: 'YYYY-MM-DD o DD/MM/YYYY',
  },
]

// ── Sample CSV content (mirrors public/template-tareas.csv) ──────────────────
const TEMPLATE_CSV = `title,description,status,priority,due_date
Setup infraestructura base,Configurar repositorio Git y Docker Compose con PostgreSQL y MLflow,todo,high,2026-04-05
Descarga y validación dataset Olist,Descargar los 9 archivos CSV de Olist y ejecutar DQ report inicial,todo,high,2026-04-10
ETL Bronze Layer,Pipeline de ingesta cruda con particionado por fecha y hash de deduplicación,in_progress,high,2026-04-18
ETL Silver Layer,Limpieza y normalización de tipos correctos y métricas derivadas,todo,medium,2026-04-25
Modelado Star Schema Gold,Diseñar y poblar fact_orders y dimensiones en PostgreSQL,todo,medium,2026-04-30
Feature Engineering RFM,Calcular RFM y lag features de 30-60-90 días para segmentación de clientes,todo,high,2026-05-05
Modelo XGBoost Churn,Entrenar XGBoost con Optuna para predicción de churn en 90 días,todo,high,2026-05-10
Dashboard Streamlit,Implementar dashboard con mapa coroplético e indicadores year-over-year,todo,medium,2026-05-15
FastAPI y Redis Cache,Exponer endpoints de predicción con caché Redis y rate limiting,todo,medium,2026-05-20
Pruebas de carga Locust,Ejecutar suite de pruebas de carga y documentar resultados en MkDocs,todo,low,2026-05-24
`

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCSV(raw: string): { headers: string[]; rows: Record<string, string>[] } {
  // Normalizar line endings, quitar BOM
  const text = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = text.split('\n').filter(l => l.trim() !== '')
  if (lines.length < 2) return { headers: [], rows: [] }

  const parseRow = (line: string): string[] => {
    const cells: string[] = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
        else inQ = !inQ
      } else if (ch === ',' && !inQ) {
        cells.push(cur.trim()); cur = ''
      } else {
        cur += ch
      }
    }
    cells.push(cur.trim())
    return cells
  }

  const headers = parseRow(lines[0]).map(h => h.replace(/^"|"$/g, '').trim())
  const rows = lines.slice(1).map(line => {
    const vals = parseRow(line)
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').replace(/^"|"$/g, '').trim()]))
  })
  return { headers, rows }
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase =
  | { id: 'idle' }
  | { id: 'parsed'; fileName: string; headers: string[]; rows: Record<string, string>[] }
  | { id: 'importing' }
  | { id: 'done'; result: ImportResult }
  | { id: 'error'; message: string }

// ── CsvImport component ───────────────────────────────────────────────────────
export function CsvImport({
  projectId,
  projectName,
}: {
  projectId?: string | null
  projectName?: string | null
}) {
  const [phase, setPhase] = useState<Phase>({ id: 'idle' })
  const [dragOver, setDragOver] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // ── Template download ──────────────────────────────────────────────────────
  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = 'template-tareas.csv'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── File handling ──────────────────────────────────────────────────────────
  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv' && !file.type.includes('csv')) {
      setPhase({ id: 'error', message: 'Por favor selecciona un archivo .csv' })
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const { headers, rows } = parseCSV(text)
      if (rows.length === 0) {
        setPhase({ id: 'error', message: 'El archivo no contiene filas de datos' })
        return
      }
      if (!headers.includes('title')) {
        setPhase({ id: 'error', message: 'Columna "title" no encontrada. Revisa que el CSV tenga encabezados.' })
        return
      }
      setPhase({ id: 'parsed', fileName: file.name, headers, rows })
    }
    reader.onerror = () => setPhase({ id: 'error', message: 'Error al leer el archivo' })
    reader.readAsText(file, 'UTF-8')
  }, [])

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) processFile(f)
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) processFile(f)
  }

  // ── AI CSV generation ──────────────────────────────────────────────────────
  async function handleGenerate() {
    setIsGenerating(true)
    setPhase({ id: 'idle' })
    const result = await generateTasksCSV()
    setIsGenerating(false)
    if (!result.success) {
      setPhase({ id: 'error', message: result.error })
      return
    }
    const { headers, rows } = parseCSV(result.csv)
    if (rows.length === 0) {
      setPhase({ id: 'error', message: 'El modelo generó un CSV vacío. Intenta de nuevo.' })
      return
    }
    setPhase({ id: 'parsed', fileName: `medallion-ml-${new Date().toISOString().slice(0,10)}.csv`, headers, rows })
  }

  // ── Import ─────────────────────────────────────────────────────────────────
  async function handleImport() {
    if (phase.id !== 'parsed') return
    setPhase({ id: 'importing' })
    const result = await importTasksCSV(projectId, phase.rows)
    if (!result.success) {
      setPhase({ id: 'error', message: result.error })
      return
    }
    setPhase({ id: 'done', result: result.data })
    if (result.data.inserted > 0) {
      router.refresh()
      // Notify analytics hook to re-fetch (useEffect can't detect router.refresh)
      window.dispatchEvent(new CustomEvent('taskflow:board_update'))
    }
  }

  // ── Render helpers ─────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: 20, padding: '1.5rem',
    boxShadow: '0 4px 32px rgba(0,0,0,0.3)',
  }

  const pill = (color: string, bg: string, border: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center',
    padding: '0.15rem 0.55rem', borderRadius: 999,
    fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em',
    background: bg, border: `1px solid ${border}`, color,
  })

  return (
    <div style={{ fontFamily: T.font, color: T.text, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Intro card ── */}
      <div style={{ ...card, border: `1px solid rgba(29,112,232,0.2)`, background: 'rgba(29,112,232,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '2rem' }}>📥</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f0f4ff', marginBottom: 4 }}>
              Importar tareas desde CSV
            </h3>
            <p style={{ fontSize: '0.82rem', color: T.textDim, lineHeight: 1.7 }}>
              Sube un archivo <code style={{ fontFamily: T.mono, color: T.blueLt, fontSize: '0.78rem' }}>.csv</code> con
              tus tareas y las insertaremos automáticamente en
              {projectName ? <b style={{ color: '#f0f4ff' }}> {projectName}</b> : ' el proyecto activo'}.
              Máximo <b style={{ color: '#f0f4ff' }}>500 filas</b> por importación.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
            {/* Generar con IA */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0.5rem 1rem', borderRadius: 10, border: 'none',
                background: isGenerating
                  ? 'rgba(139,92,246,0.4)'
                  : 'linear-gradient(135deg, #7c3aed, #a855f7)',
                color: '#fff', fontSize: '0.72rem',
                fontWeight: 700, cursor: isGenerating ? 'not-allowed' : 'pointer',
                fontFamily: T.font, whiteSpace: 'nowrap',
                boxShadow: isGenerating ? 'none' : '0 4px 14px rgba(139,92,246,0.4)',
                transition: 'opacity 0.2s, transform 0.2s',
                opacity: isGenerating ? 0.7 : 1,
              }}
            >
              {isGenerating ? (
                <>
                  <span style={{ width: 11, height: 11, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'mcoySpinA 0.7s linear infinite', display: 'inline-block', flexShrink: 0 }} />
                  Generando…
                </>
              ) : (
                <>✨ Generar con IA</>
              )}
            </button>
            {/* Descargar plantilla */}
            <button
              onClick={downloadTemplate}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0.5rem 1rem', borderRadius: 10, border: `1px solid ${T.border2}`,
                background: T.surface2, color: T.text, fontSize: '0.72rem',
                fontWeight: 600, cursor: 'pointer', fontFamily: T.font,
                whiteSpace: 'nowrap',
                transition: 'border-color 0.2s, background 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(29,112,232,0.4)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.border2 }}
            >
              ↓ Descargar plantilla
            </button>
          </div>
        </div>
      </div>

      {/* ── Field structure ── */}
      <div style={card}>
        <p style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.blue, marginBottom: '0.25rem' }}>
          Estructura
        </p>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f0f4ff', marginBottom: '1rem' }}>
          Campos del CSV
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr>
                {['Campo', 'Tipo', 'Descripción', 'Ejemplo', 'Notas'].map(h => (
                  <th key={h} style={{
                    padding: '0.5rem 0.875rem', textAlign: 'left',
                    borderBottom: `1px solid ${T.border2}`,
                    color: T.textDim, fontSize: '0.6rem',
                    fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FIELDS.map((f, i) => (
                <tr key={f.name} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '0.625rem 0.875rem', borderBottom: `1px solid ${T.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <code style={{ fontFamily: T.mono, color: T.blueLt, fontSize: '0.78rem' }}>{f.name}</code>
                      {f.required
                        ? <span style={pill(T.redLt, 'rgba(239,68,68,0.12)', 'rgba(239,68,68,0.25)')}>req.</span>
                        : <span style={pill(T.textMute, 'rgba(255,255,255,0.04)', T.border)}>opc.</span>}
                    </div>
                  </td>
                  <td style={{ padding: '0.625rem 0.875rem', borderBottom: `1px solid ${T.border}`, color: T.amberLt, fontFamily: T.mono, fontSize: '0.72rem' }}>
                    {f.type}
                  </td>
                  <td style={{ padding: '0.625rem 0.875rem', borderBottom: `1px solid ${T.border}`, color: T.textDim }}>
                    {f.desc}
                  </td>
                  <td style={{ padding: '0.625rem 0.875rem', borderBottom: `1px solid ${T.border}` }}>
                    <code style={{ fontFamily: T.mono, color: T.greenLt, fontSize: '0.72rem' }}>{f.example}</code>
                  </td>
                  <td style={{ padding: '0.625rem 0.875rem', borderBottom: `1px solid ${T.border}`, color: T.textMute, fontSize: '0.7rem' }}>
                    {f.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Header preview */}
        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: T.bg2, borderRadius: 10, border: `1px solid ${T.border}` }}>
          <p style={{ fontSize: '0.58rem', color: T.textMute, marginBottom: 4, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Encabezado esperado (primera fila)</p>
          <code style={{ fontFamily: T.mono, fontSize: '0.72rem', color: T.blueLt }}>
            title,description,status,priority,due_date
          </code>
        </div>
      </div>

      {/* ── Drop zone ── */}
      <div
        onClick={() => { if (phase.id !== 'importing') fileRef.current?.click() }}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        style={{
          ...card,
          border: `2px dashed ${dragOver ? T.blue : (phase.id === 'error' ? T.red : T.border2)}`,
          background: dragOver ? 'rgba(29,112,232,0.06)' : T.surface,
          cursor: phase.id === 'importing' ? 'not-allowed' : 'pointer',
          textAlign: 'center', padding: '2.5rem 1.5rem',
          transition: 'border-color 0.2s, background 0.2s',
        }}
      >
        <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={onFileInput} />

        {phase.id === 'idle' && (
          <>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📂</div>
            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f0f4ff', marginBottom: 4 }}>
              Arrastra tu CSV aquí o haz clic para seleccionar
            </p>
            <p style={{ fontSize: '0.75rem', color: T.textDim }}>
              Formatos aceptados: .csv · UTF-8 · máx. 500 filas
            </p>
          </>
        )}

        {phase.id === 'parsed' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: T.greenLt, marginBottom: 4 }}>
              {phase.fileName}
            </p>
            <p style={{ fontSize: '0.75rem', color: T.textDim }}>
              {phase.rows.length} fila{phase.rows.length !== 1 ? 's' : ''} detectada{phase.rows.length !== 1 ? 's' : ''} ·{' '}
              Columnas: <code style={{ fontFamily: T.mono, color: T.blueLt }}>{phase.headers.join(', ')}</code>
            </p>
            <p style={{ fontSize: '0.7rem', color: T.textMute, marginTop: 6 }}>Haz clic para cambiar archivo</p>
          </>
        )}

        {phase.id === 'importing' && (
          <>
            <div style={{ display: 'inline-block', width: 32, height: 32, border: `3px solid rgba(29,112,232,0.3)`, borderTopColor: T.blue, borderRadius: '50%', animation: 'mcoySpinA 0.8s linear infinite', marginBottom: '0.75rem' }} />
            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: T.blueLt }}>Importando tareas…</p>
          </>
        )}

        {phase.id === 'done' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎉</div>
            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: T.greenLt, marginBottom: 4 }}>
              ¡Importación completada!
            </p>
            <p style={{ fontSize: '0.75rem', color: T.textDim }}>Haz clic para importar otro archivo</p>
          </>
        )}

        {phase.id === 'error' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: T.redLt, marginBottom: 4 }}>
              {phase.message}
            </p>
            <p style={{ fontSize: '0.75rem', color: T.textDim }}>Haz clic para intentar de nuevo</p>
          </>
        )}
      </div>

      {/* ── Row preview ── */}
      {phase.id === 'parsed' && phase.rows.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <p style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.blue, marginBottom: 2 }}>Vista previa</p>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f0f4ff' }}>
                {phase.rows.length > 10 ? `Primeras 10 de ${phase.rows.length} filas` : `${phase.rows.length} filas a importar`}
              </h3>
            </div>
            <button
              onClick={handleImport}
              disabled={phase.id !== 'parsed'}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '0.6rem 1.375rem', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, #1d70e8, #4d9bff)',
                color: '#fff', fontSize: '0.8rem', fontWeight: 700,
                cursor: 'pointer', fontFamily: T.font,
                boxShadow: '0 4px 20px rgba(29,112,232,0.4)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 28px rgba(29,112,232,0.5)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(29,112,232,0.4)' }}
            >
              🚀 Importar {phase.rows.length} tarea{phase.rows.length !== 1 ? 's' : ''} →
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
              <thead>
                <tr>
                  <th style={{ padding: '0.4rem 0.75rem', textAlign: 'center', borderBottom: `1px solid ${T.border2}`, color: T.textMute, fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', width: 40 }}>#</th>
                  {phase.headers.map(h => (
                    <th key={h} style={{ padding: '0.4rem 0.75rem', textAlign: 'left', borderBottom: `1px solid ${T.border2}`, color: T.textDim, fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {phase.rows.slice(0, 10).map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '0.45rem 0.75rem', borderBottom: `1px solid ${T.border}`, color: T.textMute, fontFamily: T.mono, fontSize: '0.68rem', textAlign: 'center' }}>{i + 2}</td>
                    {phase.headers.map(h => (
                      <td key={h} style={{ padding: '0.45rem 0.75rem', borderBottom: `1px solid ${T.border}`, color: T.text, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {h === 'status'   ? <StatusBadge v={row[h]} /> :
                         h === 'priority' ? <PriorityBadge v={row[h]} /> :
                         h === 'due_date' ? <span style={{ fontFamily: T.mono, color: T.amberLt, fontSize: '0.72rem' }}>{row[h] || '—'}</span> :
                         <span title={row[h]}>{row[h] || <span style={{ color: T.textMute }}>—</span>}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {phase.rows.length > 10 && (
            <p style={{ fontSize: '0.68rem', color: T.textMute, marginTop: '0.75rem', textAlign: 'center' }}>
              + {phase.rows.length - 10} filas más (se importarán todas)
            </p>
          )}
        </div>
      )}

      {/* ── Result ── */}
      {phase.id === 'done' && (
        <div style={card}>
          <p style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.blue, marginBottom: '0.25rem' }}>Resultado</p>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f0f4ff', marginBottom: '1rem' }}>Resumen de importación</h3>

          <div style={{ display: 'flex', gap: '0.875rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div style={{ background: T.bg2, border: `1px solid rgba(34,197,94,0.25)`, borderRadius: 16, padding: '0.875rem 1.25rem', textAlign: 'center', minWidth: 90 }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: T.greenLt, lineHeight: 1 }}>{phase.result.inserted}</div>
              <div style={{ fontSize: '0.6rem', color: T.textDim, marginTop: 3, letterSpacing: '0.05em' }}>Insertadas</div>
            </div>
            <div style={{ background: T.bg2, border: `1px solid rgba(239,68,68,0.25)`, borderRadius: 16, padding: '0.875rem 1.25rem', textAlign: 'center', minWidth: 90 }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: T.redLt, lineHeight: 1 }}>{phase.result.skipped}</div>
              <div style={{ fontSize: '0.6rem', color: T.textDim, marginTop: 3, letterSpacing: '0.05em' }}>Con errores</div>
            </div>
          </div>

          {phase.result.errors.length > 0 && (
            <div>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, color: T.amberLt, marginBottom: '0.625rem' }}>
                ⚠ Filas con problemas:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {phase.result.errors.map((e, i) => (
                  <div key={i} style={{ background: 'rgba(239,68,68,0.06)', border: `1px solid rgba(239,68,68,0.18)`, borderRadius: 8, padding: '0.5rem 0.875rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', fontSize: '0.75rem' }}>
                    <span style={{ fontFamily: T.mono, color: T.amberLt, flexShrink: 0 }}>Fila {e.row}</span>
                    <span style={{ color: T.redLt, fontFamily: T.mono, fontSize: '0.7rem' }}>{e.field}</span>
                    <span style={{ color: T.textDim }}>{e.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {phase.result.inserted > 0 && (
            <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(34,197,94,0.06)', border: `1px solid rgba(34,197,94,0.2)`, borderRadius: 10, fontSize: '0.78rem', color: T.greenLt }}>
              ✓ Las tareas ya están disponibles en el Tablero Kanban y en la vista de Analítica.
              Los embeddings vectoriales se generarán en segundo plano para habilitar la búsqueda semántica.
            </div>
          )}

          <button
            onClick={() => setPhase({ id: 'idle' })}
            style={{
              marginTop: '1rem', padding: '0.5rem 1rem', borderRadius: 10,
              border: `1px solid ${T.border2}`, background: T.surface2,
              color: T.textDim, fontSize: '0.72rem', fontWeight: 600,
              cursor: 'pointer', fontFamily: T.font,
            }}
          >
            ← Importar otro archivo
          </button>
        </div>
      )}

    </div>
  )
}

// ── Small badge components ────────────────────────────────────────────────────
function StatusBadge({ v }: { v: string }) {
  const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
    todo:        { label: 'Por hacer',  color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)' },
    in_progress: { label: 'En curso',   color: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' },
    done:        { label: 'Completa',   color: '#4ade80', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.25)'  },
  }
  const cfg = map[v?.toLowerCase()] ?? map['todo']
  return (
    <span style={{ display: 'inline-block', padding: '0.15rem 0.55rem', borderRadius: 999, fontSize: '0.65rem', fontWeight: 600, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
      {cfg.label}
    </span>
  )
}

function PriorityBadge({ v }: { v: string }) {
  const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
    high:   { label: '▲ Alta',  color: '#f87171', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.2)'  },
    medium: { label: '● Media', color: '#fbbf24', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
    low:    { label: '▼ Baja',  color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)' },
  }
  const cfg = map[v?.toLowerCase()] ?? map['medium']
  return (
    <span style={{ display: 'inline-block', padding: '0.15rem 0.55rem', borderRadius: 999, fontSize: '0.65rem', fontWeight: 600, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
      {cfg.label}
    </span>
  )
}
