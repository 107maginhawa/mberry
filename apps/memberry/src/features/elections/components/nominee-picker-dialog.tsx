import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, UserPlus } from 'lucide-react'
import { Input } from '@monobase/ui'
import { Skeleton } from '@monobase/ui'
import { toast } from 'sonner'
import { listRosterMembersOptions } from '@monobase/sdk-ts/generated/react-query'
import {
  createCandidateMutation,
  getElectionOptions,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

interface NomineePickerDialogProps {
  orgId: string
  electionId: string
  positionId: string
  existingNomineePersonIds: string[]
  onClose: () => void
}

export function NomineePickerDialog({
  orgId,
  electionId,
  positionId,
  existingNomineePersonIds,
  onClose,
}: NomineePickerDialogProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery(
    listRosterMembersOptions({ query: { organizationId: orgId, limit: 50, q: search || undefined } }),
  )

  const members: any[] = (data?.data ?? []).filter(
    (m: any) => !existingNomineePersonIds.includes(m.personId ?? m.id),
  )

  const addMutation = useMutation({
    mutationFn: createCandidateMutation().mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getElectionOptions({ path: { electionId } }).queryKey })
      toast.success('Nominee added')
      onClose()
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to add nominee')
    },
  })

  function handleSelect(personId: string) {
    addMutation.mutate({
      body: {
        electionId,
        positionId,
        personId,
        nominatedBy: '', // server defaults to authenticated user
      },
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-[var(--color-surface)] border rounded-xl shadow-lg w-full max-w-md max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b">
          <h3 className="text-h4">Add Nominee</h3>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members..."
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        {/* Member list */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--color-muted)]">
              {search ? 'No matching members found' : 'No members available'}
            </div>
          ) : (
            members.map((member: any) => {
              const name = [member.firstName, member.lastName].filter(Boolean).join(' ') || member.personId || member.id
              return (
                <button
                  key={member.personId ?? member.id}
                  onClick={() => handleSelect(member.personId ?? member.id)}
                  disabled={addMutation.isPending}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-[var(--color-surface-warm)] transition-colors disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-xs font-medium shrink-0">
                    {(member.firstName?.[0] ?? '?').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{name}</p>
                    {member.membershipNumber && (
                      <p className="text-xs text-[var(--color-muted)]">#{member.membershipNumber}</p>
                    )}
                  </div>
                  <UserPlus className="w-4 h-4 text-[var(--color-muted)] shrink-0" />
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t">
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
