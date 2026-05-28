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

export interface TaskWithAssignees extends Task {
  assignees: string[] // user_ids
}

export interface KanbanColumn {
  id: TaskStatus
  title: string
  tasks: TaskWithAssignees[]
}

export interface ProjectMember {
  userId: string
  name: string
  initials: string
  avatarUrl: string | null
  role: 'owner' | 'editor' | 'viewer'
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: Array<{ task_id: string; title: string; score: number }>
}
