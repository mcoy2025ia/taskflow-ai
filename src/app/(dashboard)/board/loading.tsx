import { KanbanSkeleton } from '@/components/kanban/skeleton'

export default function BoardLoading() {
  return (
    <main className="flex-1 p-6 overflow-hidden">
      <div className="mb-6">
        <div className="h-7 w-40 bg-muted rounded animate-pulse" />
        <div className="h-4 w-72 bg-muted rounded animate-pulse mt-2" />
      </div>
      <KanbanSkeleton />
    </main>
  )
}
