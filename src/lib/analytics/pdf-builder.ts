import type { AnalyticsMetrics, TaskRow } from './metrics'

export interface PDFData {
  narrative: string
  metrics: AnalyticsMetrics
  tasks: TaskRow[]
  projectName: string
  deliveryDate: Date
  audit?: string        // informe del auditor de arquitectura (opcional)
}

const PHASE_COLORS: Record<string, [number, number, number]> = {
  'Bronze (6)':       [205, 127, 50],
  'Silver (6)':       [148, 163, 184],
  'Gold (3)':         [245, 158, 11],
  'Feature Eng. (4)': [139, 92, 246],
  'ML (2+3)':         [59, 130, 246],
  'Dashboard (3)':    [16, 185, 129],
  'Informe (2)':      [239, 68, 68],
}

// Colores por sección del informe de auditoría
const AUDIT_SECTION_STYLES: Array<{
  pattern: RegExp
  rgb: [number, number, number]
  bgRgb: [number, number, number]
}> = [
  {
    pattern: /^DIAGNOSTICO ARQUITECTONICO:/i,
    rgb:   [79, 70, 229],
    bgRgb: [237, 233, 254],
  },
  {
    pattern: /^ALERTAS CRITICAS/i,
    rgb:   [220, 38, 38],
    bgRgb: [254, 226, 226],
  },
  {
    pattern: /^RIESGOS OPERATIVOS/i,
    rgb:   [180, 83, 9],
    bgRgb: [254, 243, 199],
  },
  {
    pattern: /^INTERROGATORIO TECNICO:/i,
    rgb:   [37, 99, 235],
    bgRgb: [219, 234, 254],
  },
  {
    pattern: /^VEREDICTO DE MADUREZ:/i,
    rgb:   [5, 150, 105],
    bgRgb: [209, 250, 229],
  },
]

/** Quita emojis y caracteres fuera de Latin-1 para que jsPDF/Helvetica no los rompa */
function sanitizePDF(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')   // emojis
    .replace(/[^\x00-\xFF]/g, '')              // cualquier otro no-Latin1
    .replace(/\r\n/g, '\n')
    .trim()
}

/** Divide el texto de auditoría en bloques por sección */
function parseAuditSections(text: string): Array<{ heading: string; body: string }> {
  const sectionPatterns = AUDIT_SECTION_STYLES.map(s => s.pattern)
  const lines = sanitizePDF(text).split('\n')
  const sections: Array<{ heading: string; body: string }> = []
  let current: { heading: string; body: string } | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (current) current.body += '\n'
      continue
    }
    const isHeading = sectionPatterns.some(p => p.test(trimmed))
    if (isHeading) {
      if (current) sections.push(current)
      current = { heading: trimmed, body: '' }
    } else {
      if (current) current.body += (current.body ? ' ' : '') + trimmed
    }
  }
  if (current) sections.push(current)
  return sections
}

// ── Renderizador de la página de auditoría ────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderAuditPage(doc: any, audit: string, projectName: string): void {
  const pageW  = doc.internal.pageSize.getWidth()
  const pageH  = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentW = pageW - margin * 2

  doc.addPage()

  // Encabezado de página — fondo rojo oscuro
  doc.setFillColor(185, 28, 28)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('AUDITORIA DE ARQUITECTURA Y MLOps', margin, 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Principal Data Architect & MLOps Tech Lead — Informe Confidencial', margin, 17)

  // Metadato del proyecto
  doc.setTextColor(120, 120, 120)
  doc.setFontSize(7)
  doc.text(
    `Proyecto: ${projectName}  |  Emitido: ${new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    margin, 28,
  )

  let y = 34  // cursor vertical
  const sections = parseAuditSections(audit)

  for (const section of sections) {
    // Detectar estilo de la sección
    const style = AUDIT_SECTION_STYLES.find(s => s.pattern.test(section.heading))
    const headingRGB: [number, number, number] = style?.rgb   ?? [50, 50, 50]
    const bgRGB:      [number, number, number] = style?.bgRgb ?? [245, 245, 245]

    // Preparar el cuerpo envuelto para saber la altura antes de dibujar
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const bodyLines: string[] = section.body.trim()
      ? doc.splitTextToSize(section.body.trim(), contentW - 4)
      : []

    const blockH = 7 + (bodyLines.length > 0 ? bodyLines.length * 4.5 + 4 : 0)

    // Salto de página si no cabe
    if (y + blockH > pageH - 14) {
      doc.addPage()
      doc.setFillColor(185, 28, 28)
      doc.rect(0, 0, pageW, 10, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text('AUDITORIA DE ARQUITECTURA (continuacion)', margin, 7)
      y = 16
    }

    // Fondo de la tarjeta de sección
    doc.setFillColor(...bgRGB)
    doc.roundedRect(margin, y, contentW, blockH, 1.5, 1.5, 'F')

    // Barra lateral de color
    doc.setFillColor(...headingRGB)
    doc.rect(margin, y, 3, blockH, 'F')

    // Encabezado de sección
    doc.setTextColor(...headingRGB)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(section.heading, margin + 6, y + 5.5)

    // Cuerpo
    if (bodyLines.length > 0) {
      doc.setTextColor(40, 40, 40)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.text(bodyLines, margin + 6, y + 5.5 + 5.5)
    }

    y += blockH + 4  // espacio entre secciones
  }

  // Pie de la página de auditoría
  doc.setFontSize(7)
  doc.setTextColor(180, 180, 180)
  doc.text(
    'Clasificacion: USO INTERNO — No distribuir sin autorizacion del Tech Lead',
    margin,
    pageH - 8,
  )
}

// ── Función principal exportada ───────────────────────────────────────────────
export async function buildAnalyticsPDF({
  narrative, metrics, tasks, projectName, deliveryDate, audit,
}: PDFData): Promise<void> {
  const { done, total, inProgress, todo, pct, daysLeft, atRisk,
    velocityActual, velocityRequired, pending, phaseReal } = metrics

  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 20
  const contentW = pageW - margin * 2

  // ── Portada ───────────────────────────────────────────────────────────────
  doc.setFillColor(79, 70, 229)
  doc.rect(0, 0, pageW, 55, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('TaskFlow AI', margin, 28)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'normal')
  doc.text('Informe Ejecutivo del Proyecto', margin, 39)
  doc.setFontSize(9)
  doc.text(
    new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
    margin, 50
  )

  // ── KPIs ──────────────────────────────────────────────────────────────────
  doc.setTextColor(30, 30, 30)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Metricas clave', margin, 70)

  const kpiData = [
    { label: 'Completadas',    value: `${done}/${total}`, sub: `${pct}%`,                    color: [16, 185, 129]  as [number,number,number] },
    { label: 'En progreso',    value: String(inProgress), sub: 'activas',                     color: [245, 158, 11]  as [number,number,number] },
    { label: 'Por hacer',      value: String(todo),       sub: 'backlog',                     color: [100, 116, 139] as [number,number,number] },
    { label: 'Dias restantes', value: String(daysLeft),   sub: atRisk ? 'Riesgo' : 'En tiempo',
      color: (atRisk ? [239, 68, 68] : [16, 185, 129]) as [number,number,number] },
  ]
  const kpiW = contentW / 4
  kpiData.forEach((k, i) => {
    const x = margin + i * kpiW
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(x, 76, kpiW - 3, 22, 2, 2, 'F')
    doc.setFontSize(7)
    doc.setTextColor(100, 116, 139)
    doc.text(k.label.toUpperCase(), x + 3, 81)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...k.color)
    doc.text(k.value, x + 3, 90)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(100, 116, 139)
    doc.text(k.sub, x + 3, 95)
  })

  // ── Velocidad ─────────────────────────────────────────────────────────────
  doc.setTextColor(30, 30, 30)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Velocidad de ejecucion', margin, 110)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text(
    `Actual: ${velocityActual} tareas/dia   ·   Requerida: ${velocityRequired} tareas/dia   ·   Pendientes: ${pending}   ·   Riesgo: ${atRisk ? 'SI' : 'NO'}`,
    margin, 117
  )

  // ── Narrativa ejecutiva ───────────────────────────────────────────────────
  doc.setTextColor(30, 30, 30)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Analisis ejecutivo', margin, 130)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(50, 50, 50)
  const narrativeLines = doc.splitTextToSize(sanitizePDF(narrative), contentW)
  doc.text(narrativeLines, margin, 138)

  // ── Página 2: progreso por fase ───────────────────────────────────────────
  doc.addPage()
  doc.setFillColor(79, 70, 229)
  doc.rect(0, 0, pageW, 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Progreso por Fase del Pipeline', margin, 12)

  doc.setTextColor(30, 30, 30)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Fases', margin, 30)

  phaseReal.forEach((phase, i) => {
    const y = 36 + i * 14
    const barW = contentW - 40
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(50, 50, 50)
    doc.text(phase.name, margin, y + 4)
    doc.setFillColor(241, 245, 249)
    doc.roundedRect(margin + 40, y, barW, 5, 1, 1, 'F')
    const fill = (phase.pct / 100) * barW
    if (fill > 0) {
      const c = PHASE_COLORS[phase.name] ?? [99, 102, 241]
      doc.setFillColor(...c)
      doc.roundedRect(margin + 40, y, fill, 5, 1, 1, 'F')
    }
    doc.setFontSize(7)
    doc.setTextColor(100, 116, 139)
    doc.text(`${phase.done}/${phase.total} · ${phase.pct}%`, margin + 40 + barW + 2, y + 4)
  })

  // ── Distribución por prioridad ────────────────────────────────────────────
  let py = 36 + phaseReal.length * 14 + 12
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(30, 30, 30)
  doc.text('Tareas Pendientes por Prioridad', margin, py)
  py += 8

  const priData = [
    { label: 'Alta',  count: tasks.filter(t => t.priority === 'high'   && t.status !== 'done').length, color: [239,68,68]   as [number,number,number] },
    { label: 'Media', count: tasks.filter(t => t.priority === 'medium' && t.status !== 'done').length, color: [245,158,11]  as [number,number,number] },
    { label: 'Baja',  count: tasks.filter(t => t.priority === 'low'    && t.status !== 'done').length, color: [100,116,139] as [number,number,number] },
  ]
  const boxW = contentW / 3
  priData.forEach((p, i) => {
    const x = margin + i * boxW
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(x, py, boxW - 4, 20, 2, 2, 'F')
    doc.setFillColor(...p.color)
    doc.circle(x + 5, py + 5, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...p.color)
    doc.text(String(p.count), x + 5, py + 15)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text(p.label, x + 14, py + 15)
  })

  // ── Pie de página con nombre del proyecto ─────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight()
  doc.setFontSize(7)
  doc.setTextColor(180, 180, 180)
  doc.text(
    `${projectName} · Entrega: ${deliveryDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    margin, pageH - 8
  )

  // ── Página 3+: Auditoría de Arquitectura (si está disponible) ─────────────
  if (audit?.trim()) {
    renderAuditPage(doc, audit, projectName)
  }

  doc.save(`taskflow-informe-${new Date().toISOString().slice(0, 10)}.pdf`)
}
