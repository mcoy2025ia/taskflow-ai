export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/get-user'
import { executeTool } from '@/lib/ai/tools'
import { ratelimit } from '@/lib/ratelimit'
import { DESTRUCTIVE_TOOLS } from '@/lib/ai/agent'

// Allowlist de tools que pueden ejecutarse via confirmación.
// Refleja DESTRUCTIVE_TOOLS de agent.ts — si se agrega una nueva tool destructiva
// hay que agregar su literal aquí y su ArgsSchema más abajo.
const ConfirmSchema = z.object({
  tool: z.literal('delete_task'),
  args: z.record(z.string(), z.unknown()),
})

// Validación de args específica por tool destructiva
const ArgsSchemas: Record<string, z.ZodTypeAny> = {
  delete_task: z.object({ task_id: z.string().uuid() }),
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await ratelimit.chat(user.id)
  if (rl.limited) return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 })

  const body = await request.json().catch(() => null)
  const parsed = ConfirmSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const { tool, args } = parsed.data

  // Validar args con el schema específico de la tool
  const argsSchema = ArgsSchemas[tool]
  if (argsSchema) {
    const argsParsed = argsSchema.safeParse(args)
    if (!argsParsed.success) {
      return NextResponse.json({ error: 'Argumentos inválidos' }, { status: 400 })
    }
  }

  const result = await executeTool(tool, args, { supabase, userId: user.id })

  // Template determinista — sin llamada LLM para una confirmación de una oración.
  // La versión anterior usaba llama-3.3-70b-versatile con max_tokens:80 para esto.
  const message = result

  return NextResponse.json({ message })
}
