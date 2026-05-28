'use client'

import dynamic from 'next/dynamic'
import type { ChatInterfaceProps } from './chat-interface'

const ChatInterfaceImpl = dynamic<ChatInterfaceProps>(
  () => import('./chat-interface').then(m => m.ChatInterface),
  { ssr: false }
)

export function ChatInterfaceDynamic(props: ChatInterfaceProps) {
  return <ChatInterfaceImpl {...props} />
}
