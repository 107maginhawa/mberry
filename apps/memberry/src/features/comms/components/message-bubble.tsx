import type { ChatMessage } from '@monobase/sdk-ts/generated/types.gen'
import { Button } from '@monobase/ui'
import { MessageSquare } from 'lucide-react'

interface MessageBubbleProps {
  message: ChatMessage
  isOwn: boolean
  onOpenThread?: (message: ChatMessage) => void
}

function formatTime(d: Date): string {
  return new Date(d).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function truncateId(id: string): string {
  return id.slice(0, 8)
}

/**
 * Individual message display. Own messages right-aligned with primary bg,
 * others left-aligned with surface bg. System messages centered with muted styling.
 */
export function MessageBubble({ message, isOwn, onOpenThread }: MessageBubbleProps) {
  const replyCount = (message as ChatMessage & { replyCount?: number }).replyCount ?? 0
  // System messages: centered, muted
  if (message.messageType === 'system') {
    return (
      <div role="listitem" className="flex justify-center py-1">
        <span className="text-xs text-[var(--color-muted)] italic px-3 py-1">
          {message.message}
        </span>
      </div>
    )
  }

  return (
    <div
      role="listitem"
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} py-1`}
    >
      <div
        className={`max-w-[75%] rounded-xl px-3 py-2 ${
          isOwn
            ? 'bg-[var(--color-primary)] text-white rounded-br-sm'
            : 'bg-[var(--color-surface-warm)] text-[var(--color-text)] rounded-bl-sm'
        }`}
      >
        {!isOwn && (
          <p className="text-[10px] font-medium opacity-70 mb-0.5">
            {truncateId(message.sender)}
          </p>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
        <p
          className={`text-[10px] mt-1 ${
            isOwn ? 'text-white/70 text-right' : 'text-[var(--color-muted)]'
          }`}
        >
          {formatTime(message.timestamp)}
        </p>
        {replyCount > 0 && onOpenThread && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenThread(message)}
            className="flex items-center gap-1 mt-1 h-auto p-0 text-[10px] text-[var(--color-primary)] hover:underline"
          >
            <MessageSquare className="h-3 w-3" />
            {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          </Button>
        )}
      </div>
    </div>
  )
}
