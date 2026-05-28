import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Source, ToolActivity, PendingConfirm, ChatUIMessage } from '@/types/chat-ui.types'

function renderInline(
  text: string,
  sources: Source[],
  onCite: (idx: number) => void,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let remaining = text
  let k = 0

  while (remaining.length > 0) {
    const cite = remaining.match(/^\[(\d+)\]/)
    if (cite) {
      const n = parseInt(cite[1])
      const idx = n - 1
      const valid = idx >= 0 && idx < sources.length
      nodes.push(
        <button
          key={k++}
          type="button"
          onClick={() => valid && onCite(idx)}
          title={valid ? sources[idx].title : undefined}
          className={cn(
            'inline-flex items-center justify-center w-[18px] h-[18px] text-[10px] rounded-full mx-0.5 font-bold align-middle leading-none transition-colors',
            valid
              ? 'bg-primary/15 text-primary hover:bg-primary/30 cursor-pointer'
              : 'bg-muted text-muted-foreground cursor-default',
          )}
        >{n}</button>
      )
      remaining = remaining.slice(cite[0].length)
      continue
    }

    const bold = remaining.match(/^\*\*(.+?)\*\*/)
    if (bold) { nodes.push(<strong key={k++}>{bold[1]}</strong>); remaining = remaining.slice(bold[0].length); continue }

    const italic = remaining.match(/^\*([^*\n]+?)\*/)
    if (italic) { nodes.push(<em key={k++}>{italic[1]}</em>); remaining = remaining.slice(italic[0].length); continue }

    const code = remaining.match(/^`([^`\n]+?)`/)
    if (code) {
      nodes.push(<code key={k++} className="bg-muted px-1 py-0.5 rounded text-[11px] font-mono">{code[1]}</code>)
      remaining = remaining.slice(code[0].length)
      continue
    }

    const next = remaining.search(/\[|\*|`/)
    if (next === -1) { nodes.push(remaining); break }
    if (next === 0)  { nodes.push(remaining[0]); remaining = remaining.slice(1) }
    else             { nodes.push(remaining.slice(0, next)); remaining = remaining.slice(next) }
  }
  return nodes
}

export function MessageContent({
  text,
  sources,
  onCite,
}: {
  text: string
  sources: Source[]
  onCite: (idx: number) => void
}) {
  return (
    <div className="space-y-0.5">
      {text.split('\n').map((line, i) => {
        const t = line.trimEnd()
        if (!t) return <div key={i} className="h-1.5" />

        const bullet = t.match(/^[-•]\s+(.+)$/)
        if (bullet) return (
          <div key={i} className="flex gap-1.5 items-baseline">
            <span className="text-muted-foreground text-xs shrink-0">•</span>
            <span>{renderInline(bullet[1], sources, onCite)}</span>
          </div>
        )

        const num = t.match(/^(\d+)\.\s+(.+)$/)
        if (num) return (
          <div key={i} className="flex gap-1.5 items-baseline">
            <span className="text-muted-foreground text-xs shrink-0 w-4 text-right">{num[1]}.</span>
            <span>{renderInline(num[2], sources, onCite)}</span>
          </div>
        )

        return <p key={i}>{renderInline(t, sources, onCite)}</p>
      })}
    </div>
  )
}

export function ToolActivityList({ activity }: { activity: ToolActivity[] }) {
  return (
    <div className="flex flex-col gap-1">
      {activity.map((t, i) => (
        <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-1.5">
          {t.status === 'running'
            ? <span className="w-3 h-3 rounded-full border-2 border-primary/40 border-t-primary animate-spin shrink-0" />
            : <span className="text-emerald-500 shrink-0">✓</span>}
          <span className="font-mono">{t.tool.replace('_', ' ')}</span>
          {t.result && <span className="text-muted-foreground/70 truncate">— {t.result.slice(0, 60)}</span>}
        </div>
      ))}
    </div>
  )
}

export function ConfirmCard({
  confirm,
  onConfirm,
  onCancel,
}: {
  confirm: PendingConfirm
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex flex-col gap-3 p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm">
      <div>
        <p className="font-medium text-destructive">Confirmar eliminación</p>
        <p className="text-muted-foreground mt-0.5">
          {confirm.task_title
            ? <>¿Eliminar permanentemente <span className="font-medium text-foreground">&quot;{confirm.task_title}&quot;</span>? Esta acción no se puede deshacer.</>
            : 'Esta acción es permanente y no se puede deshacer.'}
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="destructive" onClick={onConfirm}>Eliminar</Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  )
}

export function SourceChips({
  sources,
  messageId,
  highlighted,
}: {
  sources: Source[]
  messageId: string
  highlighted: Record<string, number>
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {sources.map((src, idx) => (
        <span key={src.task_id}
          className={cn(
            'inline-flex items-center gap-1 text-xs bg-background border rounded-full px-2.5 py-1 transition-all duration-300 cursor-default',
            highlighted[messageId] === idx
              ? 'border-primary text-foreground ring-2 ring-primary/40 scale-105'
              : 'border-border/60 text-muted-foreground hover:text-foreground'
          )}
          title={`[${idx + 1}] ${src.title} — Similitud: ${(src.similarity * 100).toFixed(0)}%`}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0',
            src.status === 'done' && 'bg-emerald-500',
            src.status === 'in_progress' && 'bg-amber-500',
            src.status === 'todo' && 'bg-slate-400',
          )}/>
          <span className="font-mono text-[10px] text-muted-foreground/70 mr-0.5">[{idx + 1}]</span>
          {src.title.slice(0, 35)}{src.title.length > 35 ? '…' : ''}
        </span>
      ))}
    </div>
  )
}

// Re-export so callers only need one import
export type { ChatUIMessage }
