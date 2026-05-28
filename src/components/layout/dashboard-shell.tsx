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
      <div className="flex h-screen overflow-hidden bg-background">
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <Sidebar
          {...sidebarProps}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Topbar onMenuToggle={() => setIsSidebarOpen(o => !o)} />
          <main className="flex-1 overflow-auto bg-muted/30">
            {children}
          </main>
        </div>
      </div>
    </ActiveProjectProvider>
  )
}
