import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/get-user'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import type { ReactNode } from 'react'

interface DashboardLayoutProps {
  children: ReactNode
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  // Parallelize profile fetch alongside page data (page also runs getAuthUser,
  // but cache() ensures only one network call is made for the whole request).
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .single()

  const displayName = profile?.full_name ?? user.email ?? 'Usuario'
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <DashboardShell
      sidebarProps={{
        userName: displayName,
        userEmail: user.email ?? '',
        userInitials: initials,
        avatarUrl: profile?.avatar_url ?? null,
      }}
    >
      {children}
    </DashboardShell>
  )
}