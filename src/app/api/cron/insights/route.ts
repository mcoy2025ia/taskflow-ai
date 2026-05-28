import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// Protected by Vercel Cron — Authorization header set in vercel.json
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: overdueTasks, error } = await supabase
    .from('tasks')
    .select('id, title, project_id, due_date, user_id')
    .neq('status', 'done')
    .lt('due_date', today.toISOString())

  if (error) {
    console.error('[cron/insights] query error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const byProject = new Map<string, number>()
  for (const task of overdueTasks ?? []) {
    const key = task.project_id ?? task.user_id
    byProject.set(key, (byProject.get(key) ?? 0) + 1)
  }

  const insights = Array.from(byProject.entries()).map(([projectId, overdueCount]) => ({
    projectId,
    overdueCount,
    generatedAt: new Date().toISOString(),
  }))

  console.info('[cron/insights] generated', insights.length, 'project insights')

  return NextResponse.json({ ok: true, insights })
}
