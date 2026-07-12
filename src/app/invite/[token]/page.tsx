import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/get-user'
import { AcceptInviteButton } from './accept-invite-button'
import { Zap, ArrowRight } from 'lucide-react'

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
        <a href="/board" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
          Ir al tablero <ArrowRight size={14} />
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
        className="mt-4 inline-flex h-10 items-center gap-2 rounded-[8px] bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
      >
        Iniciar sesión <ArrowRight size={14} />
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
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="material-panel mx-4 w-full max-w-sm rounded-[8px] p-6 shadow-xl animate-in">
        <div className="mb-6 flex items-center gap-2.5 border-b border-border/60 pb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-foreground text-background">
            <Zap size={15} fill="currentColor" />
          </div>
          <span className="text-sm font-semibold">TaskFlow AI</span>
        </div>
        {children}
      </div>
    </div>
  )
}
