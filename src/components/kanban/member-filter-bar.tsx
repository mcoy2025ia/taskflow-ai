'use client'

import Image from 'next/image'
import { Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectMember } from '@/types/app.types'

interface MemberFilterBarProps {
  members: ProjectMember[]
  filteredMemberId: string | null
  onChange: (userId: string | null) => void
}

export function MemberFilterBar({ members, filteredMemberId, onChange }: MemberFilterBarProps) {
  return (
    <div className="material-panel flex flex-wrap items-center gap-1 rounded-[8px] p-1.5">
      <span className="flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase text-muted-foreground"><Users size={12} /> Equipo</span>
      <button onClick={() => onChange(null)} className={cn('h-7 rounded-[7px] px-2.5 text-[11px] font-medium', filteredMemberId === null ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground')}>
        Todos
      </button>
      {members.map(member => (
        <button key={member.userId} onClick={() => onChange(filteredMemberId === member.userId ? null : member.userId)} title={member.name} className={cn('flex h-7 items-center gap-1.5 rounded-[7px] px-2 text-[11px] font-medium', filteredMemberId === member.userId ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground')}>
          <MemberAvatar member={member} size={16} />
          <span>{member.name.split(' ')[0]}</span>
        </button>
      ))}
    </div>
  )
}

export function MemberAvatar({ member, size = 20 }: { member: ProjectMember; size?: number }) {
  if (member.avatarUrl) {
    return (
      <div className="flex-shrink-0 overflow-hidden rounded-full" style={{ width: size, height: size }}>
        <Image src={member.avatarUrl} alt={member.name} width={size} height={size} className="h-full w-full object-cover" />
      </div>
    )
  }
  return (
    <div className="flex flex-shrink-0 items-center justify-center rounded-full bg-primary/12" style={{ width: size, height: size }}>
      <span className="font-bold leading-none text-primary" style={{ fontSize: size * 0.44 }}>{member.initials}</span>
    </div>
  )
}
