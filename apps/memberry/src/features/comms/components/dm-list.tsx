import { useQuery } from '@tanstack/react-query'
import { listChatRoomsOptions } from '@monobase/sdk-ts/generated/react-query'
import type { ChatRoom } from '@monobase/sdk-ts/generated/types.gen'
import { GlassCard } from '@/components/motion/glass-card'
import { EmptyState } from '@/components/patterns/empty-state'
import { Button, Skeleton } from '@monobase/ui'
import { MessageCircle, Plus } from 'lucide-react'

interface DmListProps {
  activeRoomId?: string
  onSelectRoom: (roomId: string) => void
  onNewDm?: () => void
  myPersonId: string
}

function formatRelativeTime(d?: Date): string {
  if (!d) return ''
  const date = new Date(d)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'now'
  if (diffMin < 60) return `${diffMin}m`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h`
  const diffD = Math.floor(diffH / 24)
  return `${diffD}d`
}

/**
 * DM list sidebar. Shows direct message conversations
 * (rooms with exactly 2 participants) sorted by last activity.
 */
export function DmList({ activeRoomId, onSelectRoom, onNewDm, myPersonId }: DmListProps) {
  const roomsQuery = useQuery({
    ...listChatRoomsOptions({ query: { status: 'active' } }),
    staleTime: 10_000,
  })

  const rooms: ChatRoom[] = roomsQuery.data?.data ?? []

  // Filter to DM rooms (exactly 2 participants)
  const dmRooms = rooms.filter((r) => r.participants.length === 2)

  // Sort by lastMessageAt descending
  const sorted = [...dmRooms].sort((a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
    return bTime - aTime
  })

  if (roomsQuery.isLoading) {
    return (
      <GlassCard className="p-4">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </GlassCard>
    )
  }

  return (
    <GlassCard className="p-2">
      <div className="flex items-center justify-between px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Direct Messages
        </h3>
        {onNewDm && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onNewDm}
            aria-label="New direct message"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="px-3 py-4">
          <EmptyState
            icon={<MessageCircle className="h-8 w-8" />}
            headline="No direct messages"
            description="Start a conversation with a fellow member."
          />
        </div>
      ) : (
        <nav aria-label="Direct messages">
          <ul className="space-y-0.5">
            {sorted.map((room) => {
              const isActive = room.id === activeRoomId
              // Show the other person's ID (not ours)
              const otherParticipant = room.participants.find((p) => p !== myPersonId) ?? 'Unknown'
              const displayName = otherParticipant.slice(0, 8) + '…'

              return (
                <li key={room.id}>
                  <Button
                    variant="ghost"
                    onClick={() => onSelectRoom(room.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full justify-start px-3 py-2.5 h-auto rounded-lg flex items-center gap-2 transition-colors ${
                      isActive
                        ? 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]'
                        : 'hover:bg-[var(--color-surface-warm)] text-[var(--color-text)]'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-[var(--color-surface-warm)] text-[var(--color-primary)]'
                    }`}>
                      {otherParticipant.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium truncate flex-1 text-left">
                      {displayName}
                    </span>
                    {room.lastMessageAt && (
                      <span className={`text-[10px] flex-shrink-0 ${isActive ? 'text-white/70' : 'text-[var(--color-muted)]'}`}>
                        {formatRelativeTime(room.lastMessageAt)}
                      </span>
                    )}
                  </Button>
                </li>
              )
            })}
          </ul>
        </nav>
      )}
    </GlassCard>
  )
}
