export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/get-user'
import { executeTool } from '@/lib/ai/tools'
import { ratelimit } from '@/lib/ratelimit'

// Allowlist of tools that can run after explicit user confirmation.
const ConfirmSchema = z.object({
  tool: z.literal('delete_task'),
  args: z.record(z.string(), z.unknown()),
  projectId: z.string().uuid().optional().nullable(),
})

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
    return NextResponse.json({ error: 'Payload invalido' }, { status: 400 })
  }

  const { tool, args, projectId } = parsed.data
  const argsParsed = ArgsSchemas[tool].safeParse(args)
  if (!argsParsed.success) {
    return NextResponse.json({ error: 'Argumentos invalidos' }, { status: 400 })
  }

  const result = await executeTool(tool, args, { supabase, userId: user.id, projectId: projectId ?? null })

  return NextResponse.json({ message: result })
}
