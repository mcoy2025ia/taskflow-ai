export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/get-user'
import { executeTool } from '@/lib/ai/tools'
import { ratelimit } from '@/lib/ratelimit'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await ratelimit.chat(user.id)
  if (rl.limited) return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 })

  const { tool, args } = await request.json() as { tool: string; args: Record<string, unknown> }

  const result = await executeTool(tool, args, { supabase, userId: user.id })

  // Brief confirmation via Groq (non-streaming — response is always short)
  let message = result
  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'Eres TaskFlow AI. Confirma en UNA sola oración que la acción solicitada se ejecutó. Sin markdown.',
          },
          {
            role: 'assistant',
            content: '',
            tool_calls: [{
              id: 'confirmed',
              type: 'function',
              function: { name: tool, arguments: JSON.stringify(args) },
            }],
          },
          {
            role: 'tool',
            tool_call_id: 'confirmed',
            content: result,
          },
        ],
        stream: false,
        temperature: 0.2,
        max_tokens: 80,
      }),
    })

    if (groqRes.ok) {
      const data = await groqRes.json()
      message = data.choices?.[0]?.message?.content ?? result
    }
  } catch { /* usa el resultado bruto si Groq falla */ }

  return NextResponse.json({ message })
}
