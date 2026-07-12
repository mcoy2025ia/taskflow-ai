'use client'

import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { ActiveProjectProvider } from '@/contexts/active-project'
import { OnboardingModal } from '@/components/onboarding/onboarding-modal'
import type { ReactNode } from 'react'

interface DashboardShellProps {
  children: ReactNode
  sidebarProps: {
    userName: string
    userEmail: string
    userInitials: string
    avatarUrl: string | null
  }
}

export function DashboardShell({ children, sidebarProps }: DashboardShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <ActiveProjectProvider>
      <OnboardingModal />
      <div className="flex h-dvh overflow-hidden bg-background">
        {isSidebarOpen && (
          <button
            type="button"
            aria-label="Cerrar navegación"
            className="fixed inset-0 z-30 bg-slate-950/35 backdrop-blur-[2px] md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <Sidebar
          {...sidebarProps}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar onMenuToggle={() => setIsSidebarOpen(open => !open)} />
          <main className="relative flex-1 overflow-auto bg-background">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-foreground/[0.04]" />
            {children}
          </main>
        </div>
      </div>
    </ActiveProjectProvider>
  )
}
