export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  user_id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  position: number
  due_date: string | null
  created_at: string
  updated_at: string
}

export interface KanbanColumn {
  id: TaskStatus
  title: string
  tasks: Task[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: Array<{ task_id: string; title: string; score: number }>
}