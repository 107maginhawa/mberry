import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { registerForCustomEvent, type EventRegistration } from '@monobase/sdk-ts/generated'
import { useMemberOrg } from '@/features/org/use-member-org'

function serverError(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'error' in error) {
    const e = (error as { error?: unknown }).error
    if (typeof e === 'string') return e
  }
  return undefined
}

// The wired handler returns EventRegistration (confirmed) OR a WaitlistEntry spread with { waitlisted: true }
// (capacity full). The waitlist branch has NO `status` field — detect waitlist via the flag, never status.
export type RsvpResult = EventRegistration | { waitlisted: true }

export function isWaitlisted(reg: RsvpResult): boolean {
  return typeof reg === 'object' && reg !== null && 'waitlisted' in reg && (reg as { waitlisted?: boolean }).waitlisted === true
}

export function useRsvp(): UseMutationResult<RsvpResult, Error, { eventId: string }> {
  const { orgId } = useMemberOrg()
  const qc = useQueryClient()
  return useMutation<RsvpResult, Error, { eventId: string }>({
    mutationFn: async ({ eventId }) => {
      // No 409 from this handler — a duplicate RSVP raises 23505 → 500 (no ConflictError catch).
      // The UI prevents re-submit by disabling the button after a successful RSVP.
      const { data, error } = await registerForCustomEvent({ path: { eventId } })
      if (!data) throw new Error(serverError(error) ?? 'Could not RSVP. Please try again.')
      return data as RsvpResult
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member-events', orgId] }),
  })
}
