import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  listPendingCreditEntriesOptions,
  listPendingCreditEntriesQueryKey,
  verifyCreditEntryMutation,
  rejectCreditEntryMutation,
} from '@monobase/sdk-ts/generated/react-query'
import { Button, Input, Badge } from '@monobase/ui'
import { Check, X, FileText, FileSearch } from 'lucide-react'
import { toast } from 'sonner'
import { GlassCard } from '@/components/motion/glass-card'
import { EmptyState } from '@/components/patterns/empty-state'
import { ListSkeleton } from '@/components/patterns/skeleton-loader'

interface PendingCreditsListProps {
  orgId: string
  orgSlug: string
}

export function PendingCreditsList({ orgId, orgSlug }: PendingCreditsListProps) {
  const queryClient = useQueryClient()
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const { data, isLoading, error } = useQuery({
    ...listPendingCreditEntriesOptions({ path: { organizationId: orgId }, headers: { 'x-org-id': orgId } }),
    // List response is { entries: PendingCreditEntry[] } (NOT { data }).
    select: (d: any) => d?.entries ?? [],
  })

  const pendingQueryKey = listPendingCreditEntriesQueryKey({ path: { organizationId: orgId }, headers: { 'x-org-id': orgId } })
  // Compliance report query (officer reports/credits.tsx) — refetch after a
  // verify/reject so the standings table reflects the new verification state.
  const complianceQueryKey = ['credit-compliance', orgId]

  function optimisticRemoveEntry(creditEntryId: string) {
    return {
      onMutate: async () => {
        await queryClient.cancelQueries({ queryKey: pendingQueryKey })
        const previous = queryClient.getQueryData(pendingQueryKey)
        queryClient.setQueryData(pendingQueryKey, (old: any) => {
          if (!old?.entries) return old
          return { ...old, entries: old.entries.filter((e: any) => e.id !== creditEntryId) }
        })
        return { previous }
      },
      onError: (_err: any, _vars: any, context: { previous?: unknown } | undefined) => {
        if (context?.previous) queryClient.setQueryData(pendingQueryKey, context.previous)
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: pendingQueryKey })
        queryClient.invalidateQueries({ queryKey: complianceQueryKey })
      },
    }
  }

  const verifyMutOpts = verifyCreditEntryMutation()
  const verifyMutation = useMutation({
    ...verifyMutOpts,
    onMutate: async (variables: any) => {
      const creditEntryId = variables.path?.creditEntryId
      const helpers = optimisticRemoveEntry(creditEntryId)
      return helpers.onMutate()
    },
    onSuccess: () => {
      toast.success('Credit verified')
    },
    onError: (err: any, _vars: any, context: any) => {
      if (context?.previous) queryClient.setQueryData(pendingQueryKey, context.previous)
      toast.error(err?.body?.error ?? 'Verification failed')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: pendingQueryKey })
      queryClient.invalidateQueries({ queryKey: complianceQueryKey })
    },
  })

  const rejectMutOpts = rejectCreditEntryMutation()
  const rejectMutation = useMutation({
    ...rejectMutOpts,
    onMutate: async (variables: any) => {
      const creditEntryId = variables.path?.creditEntryId
      const helpers = optimisticRemoveEntry(creditEntryId)
      return helpers.onMutate()
    },
    onSuccess: () => {
      toast.success('Credit rejected')
      setRejectingId(null)
      setRejectReason('')
    },
    onError: (err: any, _vars: any, context: any) => {
      if (context?.previous) queryClient.setQueryData(pendingQueryKey, context.previous)
      toast.error(err?.body?.error ?? 'Rejection failed')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: pendingQueryKey })
      queryClient.invalidateQueries({ queryKey: complianceQueryKey })
    },
  })

  function handleVerify(creditEntryId: string) {
    verifyMutation.mutate({ path: { creditEntryId }, headers: { 'x-org-id': orgId } })
  }

  function handleReject(creditEntryId: string) {
    // Reason is optional (RejectCreditEntryRequest.reason?) — send only when provided.
    const reason = rejectReason.trim()
    rejectMutation.mutate({
      path: { creditEntryId },
      body: reason ? { reason } : {},
      headers: { 'x-org-id': orgId },
    })
  }

  if (isLoading) {
    return <ListSkeleton rows={3} />
  }

  if (error) {
    return (
      <div role="alert" aria-live="polite" className="text-sm text-[var(--color-error)] p-4 rounded-xl border border-destructive/20">
        Failed to load pending credits.
      </div>
    )
  }

  const entries = data ?? []

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<FileSearch className="w-8 h-8" />}
        headline="No pending credits"
        description="All member-logged credits have been reviewed."
      />
    )
  }

  return (
    <div className="space-y-3">
      {entries.map((entry: any) => {
        const isRejecting = rejectingId === entry.id

        return (
          <GlassCard key={entry.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{entry.memberName || 'Unknown member'}</span>
                  <Badge className="bg-[var(--color-info-bg)] text-[var(--color-info)]">Pending Review</Badge>
                </div>
                <div className="text-sm text-[var(--color-muted)]">
                  {entry.activityName}
                  {entry.provider && ` · ${entry.provider}`}
                </div>
                <div className="text-xs text-[var(--color-muted)]">
                  {/* creditAmount is float64 on the wire (a JS number) — render as-is, no coercion. */}
                  <span className="font-medium text-[var(--color-text)]">{entry.creditAmount}</span> credits
                  {entry.category && ` · ${entry.category}`}
                  {entry.activityDate && ` · ${new Date(entry.activityDate).toLocaleDateString()}`}
                </div>
                {entry.supportingDocumentId && (
                  <Link
                    to={`/org/${orgSlug}/officer/documents/${entry.supportingDocumentId}` as any}
                    className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    View supporting document
                  </Link>
                )}
              </div>
            </div>

            {isRejecting ? (
              <div className="space-y-2">
                <Input
                  placeholder="Reason for rejection (optional, shown to member)"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleReject(entry.id)}
                    disabled={rejectMutation.isPending}
                  >
                    {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRejectingId(null)
                      setRejectReason('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleVerify(entry.id)}
                  disabled={verifyMutation.isPending}
                >
                  <Check className="h-4 w-4 mr-1" />
                  {verifyMutation.isPending ? 'Approving...' : 'Approve'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRejectingId(entry.id)}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </div>
            )}
          </GlassCard>
        )
      })}
    </div>
  )
}
