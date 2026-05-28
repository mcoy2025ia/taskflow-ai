'use server'

import crypto from 'crypto'
import { z } from 'zod'
import { getAuthUser } from '@/lib/supabase/get-user'
import { createClient } from '@/lib/supabase/server'

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

const InviteSchema = z.object({
  projectId: z.string().uuid(),
  email: z.string().email('Email inválido'),
  role: z.enum(['editor', 'viewer']),
})

export async function inviteToProject(
  input: z.infer<typeof InviteSchema>
): Promise<ActionResult<{ token: string }>> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = InviteSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const { projectId, email, role } = parsed.data
  const supabase = await createClient()

  // Verify caller is owner of this project
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, user_id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) return { success: false, error: 'Proyecto no encontrado o sin permiso' }

  // Check for existing pending invitation to same email+project
  const { data: existing } = await supabase
    .from('pending_invitations')
    .select('id, accepted_at, expires_at')
    .eq('project_id', projectId)
    .eq('email', email.toLowerCase())
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (existing) return { success: false, error: 'Ya existe una invitación pendiente para ese email' }

  const token = crypto.randomBytes(32).toString('hex')

  const { error: insertError } = await supabase.from('pending_invitations').insert({
    project_id: projectId,
    invited_by: user.id,
    email: email.toLowerCase(),
    role,
    token,
  })

  if (insertError) return { success: false, error: insertError.message }

  await sendInviteEmail({
    to: email,
    inviterName: user.email ?? 'Un colaborador',
    projectName: project.name,
    role,
    token,
  })

  return { success: true, data: { token } }
}

export async function acceptInvitation(
  token: string
): Promise<ActionResult<{ projectId: string }>> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Debes iniciar sesión para aceptar la invitación' }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('accept_invitation', { p_token: token })

  if (error) return { success: false, error: error.message }

  return { success: true, data: { projectId: data as string } }
}

// ── Email helper ──────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  editor: 'editor (puede crear y editar tareas)',
  viewer: 'lector (solo lectura)',
}

async function sendInviteEmail({
  to,
  inviterName,
  projectName,
  role,
  token,
}: {
  to: string
  inviterName: string
  projectName: string
  role: string
  token: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // Graceful degradation in dev: log the invite link instead of crashing
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    console.info(`[invite] ${appUrl}/invite/${token}  →  ${to}`)
    return
  }

  const { Resend } = await import('resend')
  const resend = new Resend(apiKey)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const inviteUrl = `${appUrl}/invite/${token}`
  const roleLabel = ROLE_LABELS[role] ?? role

  await resend.emails.send({
    from: 'TaskFlow AI <noreply@resend.dev>',
    to: [to],
    subject: `Invitación al proyecto "${projectName}" en TaskFlow AI`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:2rem">
        <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem">
          Invitación a colaborar
        </h2>
        <p style="color:#374151;margin-bottom:1rem">
          <strong>${inviterName}</strong> te invita a colaborar en el proyecto
          <strong>${projectName}</strong> como ${roleLabel}.
        </p>
        <a
          href="${inviteUrl}"
          style="display:inline-block;padding:0.625rem 1.5rem;background:#4f46e5;color:#fff;border-radius:0.5rem;text-decoration:none;font-size:0.875rem"
        >
          Aceptar invitación
        </a>
        <p style="color:#6b7280;font-size:0.75rem;margin-top:1.5rem">
          Este enlace expira en 7 días. Si no esperabas esta invitación, puedes ignorar este mensaje.
        </p>
      </div>
    `,
  })
}
