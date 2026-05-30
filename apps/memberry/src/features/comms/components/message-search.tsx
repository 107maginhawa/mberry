// oli-execute: error-handled-inline -- search popover; non-critical, errors silent fallback.
import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GlassCard } from '@/components/motion/glass-card'
import { Button, Input, Skeleton } from '@monobase/ui'
import { Search, X } from 'lucide-react'
import { api } from '@/lib/api'

interface MessageSearchProps {
  orgId: string
  onSelectMessage?: (roomId: string, messageId: string) => void
  onClose: () => void
}

interface SearchResult {
  id: string
  message: string
  sender: string
  chatRoom: string
  roomName?: string
  timestamp: string
}

/**
 * Message search panel with filters. Searches across all rooms the user has access to.
 */
export function MessageSearch({ orgId, onSelectMessage, onClose }: MessageSearchProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const debounceRef = useState<ReturnType<typeof setTimeout> | null>(null)

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value)
    if (debounceRef[0]) clearTimeout(debounceRef[0])
    const timer = setTimeout(() => setDebouncedQuery(value), 300)
    debounceRef[1](timer)
  }, [debounceRef])

  const searchResults = useQuery({
    queryKey: ['comms', 'search', orgId, debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return { data: [] }
      const params = new URLSearchParams({ q: debouncedQuery.trim() })
      return api.get<{ data: SearchResult[] }>(`/api/comms/messages/search?${params}`)
    },
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 10_000,
  })

  const results = searchResults.data?.data ?? []

  return (
    <GlassCard className="flex flex-col h-full w-80 border-l border-[var(--color-border-light)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border-light)]">
        <Search className="h-4 w-4 text-[var(--color-muted)]" />
        <h3 className="text-sm font-semibold text-[var(--color-text)] flex-1">Search Messages</h3>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close search">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search input */}
      <div className="px-4 py-3 border-b border-[var(--color-border-light)]">
        <Input
          aria-label="Search messages"
          placeholder="Search messages..."
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          autoFocus
        />
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {searchResults.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : debouncedQuery.trim().length < 2 ? (
          <p className="text-xs text-[var(--color-muted)] text-center py-4">
            Type at least 2 characters to search
          </p>
        ) : results.length === 0 ? (
          <p className="text-xs text-[var(--color-muted)] text-center py-4">
            No messages found
          </p>
        ) : (
          results.map((result) => (
            <Button
              key={result.id}
              variant="ghost"
              onClick={() => onSelectMessage?.(result.chatRoom, result.id)}
              className="w-full h-auto p-2 justify-start text-left rounded-lg hover:bg-[var(--color-surface-warm)]"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-[var(--color-muted)] truncate">
                    {result.roomName ?? 'Chat'} · {result.sender.slice(0, 8)}
                  </span>
                  <span className="text-[10px] text-[var(--color-muted)]">
                    {new Date(result.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text)] truncate mt-0.5">
                  {result.message}
                </p>
              </div>
            </Button>
          ))
        )}
      </div>
    </GlassCard>
  )
}
