export function KanbanSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
      {(['todo', 'in_progress', 'done'] as const).map((col, ci) => (
        <div
          key={col}
          className="flex flex-col rounded-xl border border-border/50 bg-slate-100 dark:bg-slate-800"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            <div className="h-6 w-6 bg-muted rounded animate-pulse" />
          </div>
          <div className="flex-1 p-3 flex flex-col gap-2">
            {Array.from({ length: [3, 3, 2][ci] }).map((_, i) => (
              <div
                key={i}
                className="bg-background rounded-lg border border-border/50 p-3 space-y-2"
              >
                <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                <div className="h-5 w-14 bg-muted rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
