'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export interface ActiveProject {
  id: string
  name: string
  role: 'owner' | 'editor' | 'viewer'
}

interface ActiveProjectCtx {
  activeProject: ActiveProject | null
  setActiveProject: (p: ActiveProject) => void
}

const ActiveProjectContext = createContext<ActiveProjectCtx | null>(null)

const LS_KEY = 'taskflow_active_project'

export function ActiveProjectProvider({ children }: { children: ReactNode }) {
  const [activeProject, setActiveProjectState] = useState<ActiveProject | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY)
      if (stored) setActiveProjectState(JSON.parse(stored) as ActiveProject)
    } catch {}
  }, [])

  function setActiveProject(p: ActiveProject) {
    setActiveProjectState(p)
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(p))
    } catch {}
  }

  return (
    <ActiveProjectContext.Provider value={{ activeProject, setActiveProject }}>
      {children}
    </ActiveProjectContext.Provider>
  )
}

export function useActiveProject() {
  const ctx = useContext(ActiveProjectContext)
  if (!ctx) throw new Error('useActiveProject must be used inside ActiveProjectProvider')
  return ctx
}

export function useActiveProjectSafe() {
  return useContext(ActiveProjectContext)
}
