import type { TaskStatus } from './app.types'

export interface Source {
  task_id: string
  title: string
  status: TaskStatus
  similarity: number
}

export interface ToolActivity {
  tool: string
  status: 'running' | 'done'
  result?: string
}

export interface PendingConfirm {
  tool: string
  args: Record<string, unknown>
  task_title: string | null
  confirm_id: string
}

export interface ChatUIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  isStreaming?: boolean
  toolActivity?: ToolActivity[]
  pendingConfirm?: PendingConfirm
}
