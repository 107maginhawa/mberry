import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelMyAccountDeletionMutation,
  getPersonOptions,
  getPersonQueryKey,
} from '@monobase/sdk-ts/generated/react-query'
import { Button } from '@monobase/ui'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'

// FIX-010 (G-09 / AC-M02-003): when a member has a pending account deletion,
// `deletionScheduledAt` previously surfaced only inside Settings → General, so
// a member could forget the request and lose data by surprise. This banner
// renders app-wide in the authenticated layout off getPerson('me') and offers
// an inline Cancel-deletion CTA wired to the existing cancel-delete endpoint.
//
// Deletion fields are stored in the DB but not yet exposed in TypeSpec — cast
// until the spec is updated (mirrors settings/account.tsx).
type PersonWithDeletion = {
  deletionScheduledAt?: string | null
}

export function DeletionGraceBanner() {
  const queryClient = useQueryClient()
  const { data: person } = useQuery(getPersonOptions({ path: { person: 'me' } }))

  const cancelDeletion = useMutation({
    ...cancelMyAccountDeletionMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getPersonQueryKey({ path: { person: 'me' } }),
      })
      toast.success('Deletion request cancelled. Your account is safe.')
    },
    onError: () => toast.error('Failed to cancel deletion'),
  })

  const personWithDeletion = person as (typeof person & PersonWithDeletion) | undefined
  const scheduledAt = personWithDeletion?.deletionScheduledAt
  if (!scheduledAt) return null

  const daysRemaining = Math.max(
    0,
    Math.ceil((new Date(scheduledAt).getTime() - Date.now()) / 86400000),
  )

  return (
    <div
      data-testid="deletion-grace-banner"
      role="alert"
      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--color-warning)]/30 bg-[var(--color-warning-bg)] px-5 md:px-6 py-3 text-[var(--color-warning)]"
    >
      <div className="flex items-start gap-2 text-body-sm">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p>
          <span className="font-medium">Your account is scheduled for deletion</span>{' '}
          in {daysRemaining} day{daysRemaining === 1 ? '' : 's'}. All your data will be
          permanently removed. Cancel now to keep your account.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 self-start sm:self-auto"
        onClick={() => cancelDeletion.mutate({})}
        disabled={cancelDeletion.isPending}
      >
        {cancelDeletion.isPending ? 'Cancelling…' : 'Cancel deletion'}
      </Button>
    </div>
  )
}
