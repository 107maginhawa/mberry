import { useEffect, useRef, useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getChatMessagesOptions,
  getChatMessagesQueryKey,
} from '@monobase/sdk-ts/generated/react-query'
import type { ChatMessage } from '@monobase/sdk-ts/generated/types.gen'
import { GlassCard } from '@/components/motion/glass-card'
import { Skeleton } from '@monobase/ui'
import { MessageSquare, WifiOff } from 'lucide-react'
import { MessageBubble } from './message-bubble'
import { MessageComposer } from './message-composer'
import { TypingIndicator } from './typing-indicator'
import { ThreadPanel } from './thread-panel'
import { useChatWebSocket } from '../hooks/use-chat-websocket'
import { useUnreadCounts } from '../hooks/use-unread-counts'

interface ChatViewProps {
  roomId: string
  myPersonId: string
  roomName?: string
  /**
   * Org id (FIX-008): when present, message reads carry `x-org-id` so the
   * Step-33 getChatMessages cross-org guard is enforced for non-DM rooms.
   * DM rooms are exempt server-side (PD-2), so this is harmless there.
   */
  orgId?: string
}

/**
 * Main chat area: message list + composer + WebSocket real-time updates.
 * Auto-scrolls on new messages. Shows reconnection banner when WS drops.
 */
export function ChatView({ roomId, myPersonId, roomName, orgId }: ChatViewProps) {
  const queryClient = useQueryClient()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([])
  const [typingUsers, setTypingUsers] = useState<Map<string, number>>(new Map())
  const [threadMessage, setThreadMessage] = useState<ChatMessage | null>(null)
  const prevMessageCountRef = useRef(0)
  const { markRead } = useUnreadCounts()

  // Mark room as read when opened or when new messages arrive while focused
  useEffect(() => {
    markRead(roomId)
  }, [roomId, markRead])

  const messagesQuery = useQuery({
    ...getChatMessagesOptions({
      path: { room: roomId },
      query: { limit: 50 },
      ...(orgId ? { headers: { 'x-org-id': orgId } } : {}),
    }),
    staleTime: 5_000,
  })

  // Sync server messages into local state
  useEffect(() => {
    const serverMessages = messagesQuery.data?.data
    if (serverMessages) {
      setLocalMessages(serverMessages)
    }
  }, [messagesQuery.data])

  // Handle incoming WebSocket messages.
  // Server uses the { event, payload } envelope (see core/ws.ts publishToChannel).
  const handleWsMessage = useCallback(
    (msg: unknown) => {
      const frame = msg as { event?: string; payload?: unknown }
      if (frame.event === 'chat.message' && frame.payload) {
        // payload is the full persisted ChatMessage object.
        const incoming = frame.payload as ChatMessage
        // Optimistic append — avoid duplicates by checking ID
        setLocalMessages((prev) => {
          if (prev.some((m) => m.id === incoming.id)) return prev
          return [...prev, incoming]
        })
      }
      if (frame.event === 'chat.typing') {
        // Server typing payload: { from, isTyping }.
        const typing = (frame.payload ?? {}) as { from?: string; isTyping?: boolean }
        const name = typing.from
        if (name && typing.from !== myPersonId && typing.isTyping !== false) {
          setTypingUsers((prev) => {
            const next = new Map(prev)
            // Clear after 3s of no typing events from this user
            const existingTimer = prev.get(name)
            if (existingTimer) clearTimeout(existingTimer)
            const timer = window.setTimeout(() => {
              setTypingUsers((p) => {
                const n = new Map(p)
                n.delete(name)
                return n
              })
            }, 3000)
            next.set(name, timer)
            return next
          })
        }
      }
    },
    [myPersonId],
  )

  const { isConnected, isReconnecting, send } = useChatWebSocket(roomId, handleWsMessage)

  // Auto-scroll to bottom on new messages + mark read
  useEffect(() => {
    if (localMessages.length > prevMessageCountRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      markRead(roomId)
    }
    prevMessageCountRef.current = localMessages.length
  }, [localMessages.length, markRead, roomId])

  const handleMessageSent = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: getChatMessagesQueryKey({
        path: { room: roomId },
        query: { limit: 50 },
        ...(orgId ? { headers: { 'x-org-id': orgId } } : {}),
      }),
    })
  }, [queryClient, roomId, orgId])

  return (
    <div className="flex h-full">
    <GlassCard className="flex flex-col h-full flex-1 min-w-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border-light)]">
        <MessageSquare className="h-4 w-4 text-[var(--color-muted)]" />
        <h2 className="text-sm font-semibold text-[var(--color-text)] truncate">
          {roomName ?? 'Chat'}
        </h2>
        {isConnected && (
          <span className="ml-auto h-2 w-2 rounded-full bg-emerald-500" title="Connected" />
        )}
      </div>

      {/* Reconnecting banner */}
      {isReconnecting && (
        <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-amber-50 text-amber-700 text-xs border-b border-amber-200">
          <WifiOff className="h-3 w-3" />
          Reconnecting...
        </div>
      )}

      {/* Message list */}
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1"
      >
        {messagesQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                <Skeleton className="h-12 w-48 rounded-xl" />
              </div>
            ))}
          </div>
        ) : localMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-8 w-8 text-[var(--color-muted)] mb-2" />
            <p className="text-sm text-[var(--color-muted)]">No messages yet. Say hello!</p>
          </div>
        ) : (
          localMessages
            .filter((msg) => !(msg as ChatMessage & { parentMessageId?: string }).parentMessageId)
            .map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.sender === myPersonId}
              onOpenThread={setThreadMessage}
            />
          ))
        )}
      </div>

      {/* Typing indicator */}
      <TypingIndicator typers={Array.from(typingUsers.keys())} />

      {/* Composer */}
      <MessageComposer roomId={roomId} wsSend={send} onMessageSent={handleMessageSent} />
    </GlassCard>

    {/* Thread panel */}
    {threadMessage && (
      <ThreadPanel
        roomId={roomId}
        parentMessage={threadMessage}
        myPersonId={myPersonId}
        orgId={orgId}
        onClose={() => setThreadMessage(null)}
      />
    )}
    </div>
  )
}
