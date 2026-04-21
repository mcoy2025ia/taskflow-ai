'use client'

import dynamic from 'next/dynamic'

export const ChatInterfaceDynamic = dynamic(
  () => import('./chat-interface').then(m => m.ChatInterface),
  { ssr: false }
)
