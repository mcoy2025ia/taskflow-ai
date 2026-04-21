'use client'

import dynamic from 'next/dynamic'
import { KanbanSkeleton } from './skeleton'

export const KanbanBoardDynamic = dynamic(
  () => import('./board').then(m => m.KanbanBoard),
  { ssr: false, loading: () => <KanbanSkeleton /> }
)
