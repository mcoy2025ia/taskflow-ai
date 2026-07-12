import { z } from 'zod'

export const TaskStatus = z.enum(['todo', 'in_progress', 'done'])
export const TaskPriority = z.enum(['low', 'medium', 'high'])

const TaskFieldsSchema = z.object({
  title: z.string().min(1, 'El titulo es requerido').max(200),
  description: z.string().max(2000).optional(),
  status: TaskStatus.default('todo'),
  priority: TaskPriority.default('medium'),
  due_date: z.string().datetime().optional().nullable(),
})

export const CreateTaskSchema = TaskFieldsSchema.extend({
  project_id: z.string().uuid().optional().nullable(),
})

export const UpdateTaskSchema = TaskFieldsSchema.partial().extend({
  id: z.string().uuid(),
})

export const MoveTaskSchema = z.object({
  id: z.string().uuid(),
  status: TaskStatus,
  position: z.number().int().min(0),
})

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>
export type MoveTaskInput = z.infer<typeof MoveTaskSchema>
