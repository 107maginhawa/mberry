import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createChatRoomMutation,
  listRosterMembersOptions,
} from '@monobase/sdk-ts/generated/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Skeleton,
} from '@monobase/ui'
import { toast } from 'sonner'
import { MessageCircle, Search } from 'lucide-react'

interface DmMemberPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with the new (or existing, via upsert) DM room id once it opens. */
  onCreated: (roomId: string) => void
  /** Org UUID — scopes the DM so the org-context middleware resolves it (PD-2: org-scoped create). */
  orgId?: string
  /** The current user's person id — one of the two DM participants; excluded from the picker list. */
  myPersonId: string
}

/**
 * Build the createChatRoom request body for a direct message (FIX-006).
 *
 * Mirrors `buildChannelCreateBody`: a pure, unit-testable body builder. Emits
 * `roomType: 'dm'` with both participants and the org id so the room is
 * org-scoped (PD-2 keeps the create org-scoped; the FIX-008 read-filter
 * strictness is a separate decision). `upsert: true` so re-opening an existing
 * DM returns it (the backend dedups DM/group rooms by participant set) instead
 * of a 409. No `context` hack.
 */
export function buildDmCreateBody(myPersonId: string, targetPersonId: string, orgId: string) {
  const participants = [...new Set([myPersonId, targetPersonId])]
  return {
    roomType: 'dm' as const,
    organizationId: orgId,
    participants,
    upsert: true,
  }
}

/**
 * Member picker dialog for starting a direct message.
 *
 * Searches the current org's roster (reusing `listRosterMembers`), excludes
 * self, and on select creates/opens the DM room. DM creation is member-allowed
 * (unlike channels, which are officer-only).
 */
export function DmMemberPicker({
  open,
  onOpenChange,
  onCreated,
  orgId = '',
  myPersonId,
}: DmMemberPickerProps) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const queryClient = useQueryClient()

  // Debounce the search input before querying the roster.
  useEffect(() => {
    const trimmed = search.trim()
    if (trimmed.length < 2) {
      setDebouncedSearch('')
      return
    }
    const timer = setTimeout(() => setDebouncedSearch(trimmed), 300)
    return () => clearTimeout(timer)
  }, [search])

  const membersQuery = useQuery({
    ...listRosterMembersOptions({
      query: { q: debouncedSearch, limit: 20, organizationId: orgId },
      headers: { 'x-org-id': orgId },
    }),
    enabled: open && debouncedSearch.length >= 2,
  })

  // Exclude self — a DM is always with someone else.
  const members = (membersQuery.data?.data ?? []).filter(
    (m) => (m.personId || m.id) !== myPersonId,
  )

  const createDm = useMutation({
    ...createChatRoomMutation(),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['listChatRooms'] })
      onCreated(data?.id ?? '')
      setSearch('')
      setDebouncedSearch('')
      onOpenChange(false)
    },
    onError: () => {
      toast.error('Failed to start conversation')
    },
  })

  const handleSelect = (targetPersonId: string) => {
    if (createDm.isPending) return
    createDm.mutate({
      body: buildDmCreateBody(myPersonId, targetPersonId, orgId),
    } as any)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Direct Message</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)]" />
            <Input
              aria-label="Search members"
              placeholder="Search members by name or number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          <div className="max-h-72 overflow-y-auto">
            {search.trim().length < 2 ? (
              <p className="px-3 py-6 text-center text-sm text-[var(--color-muted)]">
                Type at least 2 characters to search members.
              </p>
            ) : membersQuery.isFetching ? (
              <div className="space-y-2 py-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-11 w-full rounded-lg" />
                ))}
              </div>
            ) : members.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-[var(--color-muted)]">
                No members found.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {members.map((m) => {
                  const targetId = m.personId || m.id
                  const label = m.memberNumber || targetId
                  return (
                    <li key={m.id}>
                      <Button
                        variant="ghost"
                        onClick={() => handleSelect(targetId)}
                        disabled={createDm.isPending}
                        className="w-full justify-start px-3 py-2.5 h-auto rounded-lg flex items-center gap-2"
                      >
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold bg-[var(--color-surface-warm)] text-[var(--color-primary)]">
                          {label.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium truncate flex-1 text-left">
                          {label}
                        </span>
                        <MessageCircle className="h-4 w-4 flex-shrink-0 text-[var(--color-muted)]" />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
