import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listPendingProofsOptions,
  listPendingProofsQueryKey,
  listDuesPaymentsQueryKey,
  confirmPaymentProofMutation,
  rejectPaymentProofMutation,
} from '@monobase/sdk-ts/generated/react-query'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Badge } from '@monobase/ui'
import { formatCents } from '@/features/dues/lib/money'
import { Check, X, Image, FileText, FileSearch } from 'lucide-react'
import { toast } from 'sonner'
import { GlassCard } from '@/components/motion/glass-card'
import { EmptyState } from '@/components/patterns/empty-state'
import { ListSkeleton } from '@/components/patterns/skeleton-loader'

interface PendingProofsListProps {
  orgId: string
}

export function PendingProofsList({ orgId }: PendingProofsListProps) {
  const queryClient = useQueryClient()
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const { data, isLoading, error } = useQuery({
    ...listPendingProofsOptions({ query: { organizationId: orgId }, headers: { 'x-org-id': orgId } }),
    select: (d: any) => d?.data ?? [],
  })

  const proofsQueryKey = listPendingProofsQueryKey({ query: { organizationId: orgId }, headers: { 'x-org-id': orgId } })
  const paymentsQueryKey = listDuesPaymentsQueryKey({ headers: { 'x-org-id': orgId } })

  function optimisticRemoveProof(paymentId: string) {
    return {
      onMutate: async () => {
        await queryClient.cancelQueries({ queryKey: proofsQueryKey })
        const previous = queryClient.getQueryData(proofsQueryKey)
        queryClient.setQueryData(proofsQueryKey, (old: any) => {
          if (!old?.data) return old
          return { ...old, data: old.data.filter((p: any) => p.id !== paymentId) }
        })
        return { previous }
      },
      onError: (_err: any, _vars: any, context: { previous?: unknown } | undefined) => {
        if (context?.previous) queryClient.setQueryData(proofsQueryKey, context.previous)
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: proofsQueryKey })
        queryClient.invalidateQueries({ queryKey: paymentsQueryKey })
      },
    }
  }

  const confirmMutOpts = confirmPaymentProofMutation()
  const confirmMutation = useMutation({
    ...confirmMutOpts,
    onMutate: async (variables: any) => {
      const paymentId = variables.path?.paymentId
      const helpers = optimisticRemoveProof(paymentId)
      return helpers.onMutate()
    },
    onSuccess: () => {
      toast.success('Payment confirmed')
    },
    onError: (err: any, vars: any, context: any) => {
      if (context?.previous) queryClient.setQueryData(proofsQueryKey, context.previous)
      toast.error(err?.body?.error ?? 'Confirmation failed')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: proofsQueryKey })
      queryClient.invalidateQueries({ queryKey: paymentsQueryKey })
    },
  })

  const rejectMutOpts = rejectPaymentProofMutation()
  const rejectMutation = useMutation({
    ...rejectMutOpts,
    onMutate: async (variables: any) => {
      const paymentId = variables.path?.paymentId
      const helpers = optimisticRemoveProof(paymentId)
      return helpers.onMutate()
    },
    onSuccess: () => {
      toast.success('Payment rejected')
      setRejectingId(null)
      setRejectReason('')
    },
    onError: (err: any, vars: any, context: any) => {
      if (context?.previous) queryClient.setQueryData(proofsQueryKey, context.previous)
      toast.error(err?.body?.error ?? 'Rejection failed')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: proofsQueryKey })
      queryClient.invalidateQueries({ queryKey: paymentsQueryKey })
    },
  })

  function handleConfirm(paymentId: string) {
    confirmMutation.mutate({ path: { paymentId }, body: {}, headers: { 'x-org-id': orgId } })
  }

  function handleReject(paymentId: string) {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }
    rejectMutation.mutate({
      path: { paymentId },
      body: { reason: rejectReason.trim() },
      headers: { 'x-org-id': orgId },
    })
  }

  if (isLoading) {
    return <ListSkeleton rows={3} />
  }

  if (error) {
    return (
      <div role="alert" aria-live="polite" className="text-sm text-[var(--color-error)] p-4 rounded-xl border border-destructive/20">
        Failed to load pending proofs.
      </div>
    )
  }

  const proofs = data ?? []

  if (proofs.length === 0) {
    return (
      <EmptyState
        icon={<FileSearch className="w-8 h-8" />}
        headline="No pending proofs"
        description="All payment proofs have been reviewed."
      />
    )
  }

  return (
    <div className="space-y-3">
      {proofs.map((p: any) => {
        const isRejecting = rejectingId === p.id
        const proofMime = p.proof?.mimeType ?? p.proofMimeType ?? ''
        const isImage = proofMime.startsWith('image/')

        return (
          <GlassCard
            key={p.id}
            className="p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">{p.receiptNumber}</span>
                  <Badge className="bg-blue-100 text-blue-800">Pending Review</Badge>
                </div>
                <div className="text-sm text-[var(--color-muted)]">
                  <span className="font-mono font-medium">
                    {formatCents(p.amount, p.currency)}
                  </span>
                  {' via '}
                  {p.paymentMethod}
                  {p.referenceNumber && ` (ref: ${p.referenceNumber})`}
                </div>
                <div className="text-xs text-[var(--color-muted)]">
                  Member: {p.personId?.slice(0, 8)}...
                  {p.paidAt && ` | Submitted: ${new Date(p.paidAt).toLocaleDateString()}`}
                </div>
              </div>

              {/* Proof thumbnail */}
              <div className="shrink-0">
                {isImage ? (
                  <Image className="h-10 w-10 text-[var(--color-muted)]" />
                ) : (
                  <FileText className="h-10 w-10 text-[var(--color-muted)]" />
                )}
                <p className="text-xs text-[var(--color-muted)] text-center mt-1">
                  {p.proof?.fileName ?? p.proofFileName ?? 'proof'}
                </p>
              </div>
            </div>

            {isRejecting ? (
              <div className="space-y-2">
                <Input
                  placeholder="Reason for rejection (required)"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleReject(p.id)}
                    disabled={rejectMutation.isPending || !rejectReason.trim()}
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
                  onClick={() => handleConfirm(p.id)}
                  disabled={confirmMutation.isPending}
                >
                  <Check className="h-4 w-4 mr-1" />
                  {confirmMutation.isPending ? 'Confirming...' : 'Confirm'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRejectingId(p.id)}
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
