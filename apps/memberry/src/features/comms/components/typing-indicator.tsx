interface TypingIndicatorProps {
  typers: string[]
}

/**
 * Shows "X is typing..." below the message list.
 * aria-live="polite" for screen reader announcements.
 */
export function TypingIndicator({ typers }: TypingIndicatorProps) {
  if (typers.length === 0) return null

  const text =
    typers.length === 1
      ? `${typers[0]} is typing...`
      : typers.length === 2
        ? `${typers[0]} and ${typers[1]} are typing...`
        : `${typers[0]} and ${typers.length - 1} others are typing...`

  return (
    <div
      aria-live="polite"
      aria-atomic
      className="px-4 py-1 text-xs text-[var(--color-muted)] italic"
    >
      <span className="inline-flex items-center gap-1">
        <span className="flex gap-0.5">
          <span className="h-1 w-1 rounded-full bg-[var(--color-muted)] animate-bounce [animation-delay:0ms]" />
          <span className="h-1 w-1 rounded-full bg-[var(--color-muted)] animate-bounce [animation-delay:150ms]" />
          <span className="h-1 w-1 rounded-full bg-[var(--color-muted)] animate-bounce [animation-delay:300ms]" />
        </span>
        {text}
      </span>
    </div>
  )
}
