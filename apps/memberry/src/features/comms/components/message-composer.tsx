import { useState, useRef, useCallback, type KeyboardEvent, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { sendChatMessageMutation } from '@monobase/sdk-ts/generated/react-query'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Send } from 'lucide-react'
import { toast } from 'sonner'

interface MessageComposerProps {
  roomId: string
  wsSend?: (type: string, data: unknown) => void
  onMessageSent?: () => void
}

/**
 * Message input with send button. Submits on Enter (Shift+Enter for newline).
 * Basic 500ms throttle after sending. Emits chat.typing via WebSocket on input.
 */
export function MessageComposer({ roomId, wsSend, onMessageSent }: MessageComposerProps) {
  const [draft, setDraft] = useState('')
  const [throttled, setThrottled] = useState(false)
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingThrottleRef = useRef<number>(0)

  const send = useMutation({
    ...sendChatMessageMutation(),
    onSuccess: () => {
      setDraft('')
      onMessageSent?.()

      // Throttle: disable for 500ms
      setThrottled(true)
      throttleTimerRef.current = setTimeout(() => setThrottled(false), 500)
    },
    onError: () => {
      toast.error('Could not send message')
    },
  })

  const canSend = draft.trim().length > 0 && !send.isPending && !throttled

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault()
      if (!canSend) return

      send.mutate({
        path: { room: roomId },
        body: { messageType: 'text', message: draft.trim() },
      })
    },
    [canSend, send, roomId, draft],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3 border-t border-[var(--color-border-light)]">
      <Input
        aria-label="Message input"
        placeholder="Type a message..."
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          // Emit typing event throttled to once per 2s.
          // Server reads `data.isTyping` and broadcasts { from, isTyping }.
          const now = Date.now()
          if (wsSend && now - typingThrottleRef.current > 2000) {
            typingThrottleRef.current = now
            wsSend('chat.typing', { isTyping: true })
          }
        }}
        onKeyDown={handleKeyDown}
        disabled={send.isPending}
        className="flex-1"
      />
      <Button
        type="submit"
        size="icon"
        disabled={!canSend}
        aria-label="Send message"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  )
}
