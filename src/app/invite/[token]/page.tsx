import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/get-user'
import { AcceptInviteButton } from './accept-invite-button'

interface InvitePageProps {
  params: Promise<{ token: string }>
}

const ROLE_LABELS: Record<string, string> = {
  editor: 'Editor',
  viewer: 'Lector',
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params
  const user = await getAuthUser()
  const supabase = await createClient()

  const { data: rows } = await supabase.rpc('get_invitation_by_token', { p_token: token })
  const inv = rows?.[0]

  // Invalid or not found
  if (!inv) {
    return <InviteLayout>
      <h1 className="text-lg font-semibold">Invitación no válida</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Este enlace de invitación no existe o ya fue eliminado.
      </p>
    </InviteLayout>
  }

  // Already accepted
  if (inv.accepted_at) {
    return <InviteLayout>
      <h1 className="text-lg font-semibold">Invitación ya aceptada</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Esta invitación ya fue aceptada anteriormente.
      </p>
      {user && (
        <a href="/board" className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
          Ir al tablero →
        </a>
      )}
    </InviteLayout>
  }

  // Expired
  if (new Date(inv.expires_at) < new Date()) {
    return <InviteLayout>
      <h1 className="text-lg font-semibold">Invitación expirada</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Este enlace expiró. Pide al propietario del proyecto que envíe una nueva invitación.
      </p>
    </InviteLayout>
  }

  // Not authenticated → prompt to log in
  if (!user) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const loginUrl = `/login?redirect=${encodeURIComponent(`${appUrl}/invite/${token}`)}`
    return <InviteLayout>
      <h1 className="text-lg font-semibold">Invitación al proyecto</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Te invitaron a colaborar en <strong>{inv.project_name}</strong> como{' '}
        <strong>{ROLE_LABELS[inv.role] ?? inv.role}</strong>.
      </p>
      <p className="text-sm text-muted-foreground mt-3">
        Inicia sesión para aceptar la invitación.
      </p>
      <a
        href={loginUrl}
        className="mt-4 inline-block px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
      >
        Iniciar sesión
      </a>
    </InviteLayout>
  }

  // Authenticated — check email match (warn but still allow)
  const emailMatch = user.email?.toLowerCase() === inv.invited_email?.toLowerCase()

  return (
    <InviteLayout>
      <h1 className="text-lg font-semibold">Invitación al proyecto</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Fuiste invitado/a a colaborar en{' '}
        <strong className="text-foreground">{inv.project_name}</strong> como{' '}
        <strong className="text-foreground">{ROLE_LABELS[inv.role] ?? inv.role}</strong>.
      </p>
      {!emailMatch && (
        <p className="mt-3 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-md">
          Esta invitación fue enviada a <strong>{inv.invited_email}</strong>, pero estás
          conectado como <strong>{user.email}</strong>.
        </p>
      )}
      <AcceptInviteButton token={token} />
    </InviteLayout>
  )
}

function InviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="w-full max-w-sm mx-4 p-6 rounded-xl border border-border/60 bg-background shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-[7px] bg-gradient-to-br from-indigo-600 to-violet-500 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <span className="text-sm font-semibold">TaskFlow AI</span>
        </div>
        {children}
      </div>
    </div>
  )
}
