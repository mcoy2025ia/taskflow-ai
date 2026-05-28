'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { ProjectMember } from '@/types/app.types'

interface MemberFilterBarProps {
  members: ProjectMember[]
  filteredMemberId: string | null
  onChange: (userId: string | null) => void
}

export function MemberFilterBar({ members, filteredMemberId, onChange }: MemberFilterBarProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-muted-foreground mr-1">Filtrar:</span>
      <button
        onClick={() => onChange(null)}
        className={cn(
          'px-2.5 py-1 rounded-full text-xs transition-colors',
          filteredMemberId === null
            ? 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-medium'
            : 'text-muted-foreground hover:bg-muted/60'
        )}
      >
        Todos
      </button>
      {members.map(m => (
        <button
          key={m.userId}
          onClick={() => onChange(filteredMemberId === m.userId ? null : m.userId)}
          title={m.name}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-colors',
            filteredMemberId === m.userId
              ? 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-medium ring-1 ring-indigo-400/50'
              : 'text-muted-foreground hover:bg-muted/60'
          )}
        >
          <MemberAvatar member={m} size={16} />
          <span>{m.name.split(' ')[0]}</span>
        </button>
      ))}
    </div>
  )
}

export function MemberAvatar({ member, size = 20 }: { member: ProjectMember; size?: number }) {
  if (member.avatarUrl) {
    return (
      <div
        className="rounded-full overflow-hidden flex-shrink-0"
        style={{ width: size, height: size }}
      >
        <Image
          src={member.avatarUrl}
          alt={member.name}
          width={size}
          height={size}
          className="object-cover"
        />
      </div>
    )
  }
  return (
    <div
      className="rounded-full bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <span
        className="font-semibold text-indigo-700 dark:text-indigo-300 leading-none"
        style={{ fontSize: size * 0.45 }}
      >
        {member.initials}
      </span>
    </div>
  )
}
