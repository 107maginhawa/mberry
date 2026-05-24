import { useState } from 'react'
import { Button } from '@monobase/ui'
import { SmilePlus } from 'lucide-react'

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '🤔', '👀']

interface Reaction {
  emoji: string
  count: number
  reacted: boolean // whether current user reacted with this emoji
}

interface MessageReactionsProps {
  reactions: Reaction[]
  onReact: (emoji: string) => void
  onRemoveReaction: (emoji: string) => void
}

/**
 * Shows existing reactions below message + hover emoji picker for adding new ones.
 */
export function MessageReactions({ reactions, onReact, onRemoveReaction }: MessageReactionsProps) {
  const [showPicker, setShowPicker] = useState(false)

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1">
      {/* Existing reactions */}
      {reactions.map((r) => (
        <Button
          key={r.emoji}
          variant="ghost"
          size="sm"
          onClick={() => (r.reacted ? onRemoveReaction(r.emoji) : onReact(r.emoji))}
          className={`h-5 px-1.5 text-[10px] rounded-full border ${
            r.reacted
              ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10'
              : 'border-[var(--color-border-light)] bg-transparent'
          }`}
          aria-label={`${r.emoji} ${r.count} reaction${r.count !== 1 ? 's' : ''}`}
        >
          {r.emoji} {r.count}
        </Button>
      ))}

      {/* Add reaction button */}
      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowPicker(!showPicker)}
          className="h-5 w-5 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Add reaction"
        >
          <SmilePlus className="h-3 w-3 text-[var(--color-muted)]" />
        </Button>

        {/* Quick picker */}
        {showPicker && (
          <div className="absolute bottom-6 left-0 z-20 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-[var(--color-border-light)] p-1 flex gap-0.5">
            {QUICK_REACTIONS.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                onClick={() => {
                  onReact(emoji)
                  setShowPicker(false)
                }}
                className="h-7 w-7 p-0 text-base hover:bg-[var(--color-surface-warm)] rounded"
              >
                {emoji}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
