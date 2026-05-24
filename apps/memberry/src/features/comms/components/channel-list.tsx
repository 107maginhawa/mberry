import { useQuery } from '@tanstack/react-query'
import { listChatRoomsOptions } from '@monobase/sdk-ts/generated/react-query'
import type { ChatRoom } from '@monobase/sdk-ts/generated/types.gen'
import { GlassCard } from '@/components/motion/glass-card'
import { EmptyState } from '@/components/patterns/empty-state'
import { MessageSquare } from 'lucide-react'
import { Button, Skeleton } from '@monobase/ui'

interface ChannelListProps {
  orgSlug: string
  activeRoomId?: string
  onSelectRoom: (roomId: string) => void
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

function roomDisplayName(room: ChatRoom): string {
  // Use name if available (returned from API even before TypeSpec update)
  const name = (room as ChatRoom & { name?: string }).name
  if (name) return `# ${name}`

  // Use context field for channel naming (format: "channel:general")
  if (room.context?.startsWith('channel:')) {
    return `# ${room.context.slice(8)}`
  }

  // Fallback: show participant count
  const count = room.participants.length
  if (count <= 2) return 'Direct message'
  return `Group (${count})`
}

/**
 * Channel list sidebar. Shows chat rooms the user is in,
 * sorted by last activity. Active room highlighted.
 */
export function ChannelList({ activeRoomId, onSelectRoom }: ChannelListProps) {
  const roomsQuery = useQuery({
    ...listChatRoomsOptions({ query: { status: 'active' } }),
    staleTime: 10_000,
  })

  const rooms: ChatRoom[] = roomsQuery.data?.data ?? []

  // Sort by lastMessageAt descending (most recent first)
  const sorted = [...rooms].sort((a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
    return bTime - aTime
  })

  if (roomsQuery.isLoading) {
    return (
      <GlassCard className="p-4">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </GlassCard>
    )
  }

  if (sorted.length === 0) {
    return (
      <GlassCard className="p-4">
        <EmptyState
          icon={<MessageSquare className="h-8 w-8" />}
          headline="No conversations yet"
          description="Start a new conversation to get going."
        />
      </GlassCard>
    )
  }

  return (
    <GlassCard className="p-2">
      <nav aria-label="Chat rooms">
        <ul className="space-y-0.5">
          {sorted.map((room) => {
            const isActive = room.id === activeRoomId
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
                  <MessageSquare className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-[var(--color-muted)]'}`} />
                  <span className="text-sm font-medium truncate flex-1 text-left">
                    {roomDisplayName(room)}
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
    </GlassCard>
  )
}
