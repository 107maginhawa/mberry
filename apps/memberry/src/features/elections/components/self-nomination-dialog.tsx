import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus } from 'lucide-react'
import { Button } from '@monobase/ui'
import { toast } from 'sonner'
import {
  createCandidateMutation,
  getElectionOptions,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

interface SelfNominationDialogProps {
  electionId: string
  orgId: string
  positionId: string
  positionTitle: string
  personId: string
  onClose: () => void
  onSuccess: () => void
}

export function SelfNominationDialog({
  electionId,
  positionId,
  positionTitle,
  personId,
  onClose,
  onSuccess,
}: SelfNominationDialogProps) {
  const queryClient = useQueryClient()

  const nominateMutation = useMutation({
    mutationFn: createCandidateMutation().mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getElectionOptions({ path: { electionId } }).queryKey })
      toast.success('You have been nominated successfully')
      onSuccess()
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to submit nomination')
    },
  })

  function handleConfirm() {
    nominateMutation.mutate({
      body: {
        electionId,
        positionId,
        personId,
        nominatedBy: personId,
      },
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface)] border rounded-xl shadow-lg w-full max-w-sm p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon + title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5 text-[var(--color-primary)]" />
          </div>
          <div>
            <h3 className="text-h4">Nominate Yourself</h3>
            <p className="text-xs text-[var(--color-muted)]">Self-nomination</p>
          </div>
        </div>

        {/* Confirmation message */}
        <p className="text-sm text-[var(--color-text)]">
          You are nominating yourself for{' '}
          <span className="font-semibold">{positionTitle}</span>. Are you sure?
        </p>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={nominateMutation.isPending}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={nominateMutation.isPending}
            className="flex-1"
          >
            {nominateMutation.isPending ? 'Submitting...' : 'Yes, Nominate Me'}
          </Button>
        </div>
      </div>
    </div>
  )
}
