// oli-execute: error-handled-inline -- thread panel; parent route handles isError.
import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getChatMessagesOptions } from '@monobase/sdk-ts/generated/react-query'
import type { ChatMessage } from '@monobase/sdk-ts/generated/types.gen'
import { GlassCard } from '@/components/motion/glass-card'
import { Button, Skeleton } from '@monobase/ui'
import { X, MessageSquare } from 'lucide-react'
import { MessageBubble } from './message-bubble'
import { MessageComposer } from './message-composer'

interface ThreadPanelProps {
  roomId: string
  parentMessage: ChatMessage
  myPersonId: string
  onClose: () => void
}

/**
 * Slide-out thread panel showing parent message + replies.
 * Appears on the right side of the chat view.
 */
export function ThreadPanel({ roomId, parentMessage, myPersonId, onClose }: ThreadPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [localReplies, setLocalReplies] = useState<ChatMessage[]>([])

  // Fetch replies for this parent message
  const repliesQuery = useQuery({
    ...getChatMessagesOptions({
      path: { room: roomId },
      query: { limit: 50 },
    }),
    // Filter client-side since API may not support parentMessageId filter yet
    select: (data) => ({
      ...data,
      data: (data?.data ?? []).filter(
        (m: ChatMessage) => (m as ChatMessage & { parentMessageId?: string }).parentMessageId === parentMessage.id
      ),
    }),
    staleTime: 5_000,
  })

  useEffect(() => {
    if (repliesQuery.data?.data) {
      setLocalReplies(repliesQuery.data.data)
    }
  }, [repliesQuery.data])

  // Auto-scroll on new replies
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [localReplies.length])

  const handleReplySent = useCallback(() => {
    repliesQuery.refetch()
  }, [repliesQuery])

  return (
    <GlassCard className="flex flex-col h-full w-80 border-l border-[var(--color-border-light)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-light)]">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[var(--color-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Thread</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close thread">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Parent message */}
      <div className="px-4 py-3 border-b border-[var(--color-border-light)] bg-[var(--color-surface-warm)]/30">
        <MessageBubble message={parentMessage} isOwn={parentMessage.sender === myPersonId} />
      </div>

      {/* Replies */}
      <div
        ref={scrollRef}
        role="log"
        aria-label="Thread replies"
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1"
      >
        {repliesQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-40 rounded-xl" />
            ))}
          </div>
        ) : localReplies.length === 0 ? (
          <p className="text-xs text-[var(--color-muted)] text-center py-4">
            No replies yet. Start the conversation!
          </p>
        ) : (
          localReplies.map((reply) => (
            <MessageBubble
              key={reply.id}
              message={reply}
              isOwn={reply.sender === myPersonId}
            />
          ))
        )}
      </div>

      {/* Reply composer */}
      <MessageComposer roomId={roomId} onMessageSent={handleReplySent} />
    </GlassCard>
  )
}
