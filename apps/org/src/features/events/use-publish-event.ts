import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { publishEvent } from '@monobase/sdk-ts/generated'

export function usePublishEvent(
  orgId: string | null,
): { publish: (eventId: string) => void; publishingId: string | null } {
  const qc = useQueryClient()
  const [publishingId, setPublishingId] = useState<string | null>(null)

  const m = useMutation<void, Error, string>({
    mutationFn: async (eventId) => {
      const { data, error } = await publishEvent({ path: { eventId } })
      if (!data) throw new Error((error as any)?.error ?? 'Could not publish the event.')
    },
    onMutate: (eventId) => { setPublishingId(eventId) },
    onError: (e) => { toast.error(e.message) },
    // Refetch on BOTH success and error: success flips the row to Published; a 409
    // (already published in another tab/by another officer) reconciles the stale
    // draft row instead of leaving a dead Publish button.
    onSettled: () => { setPublishingId(null); qc.invalidateQueries({ queryKey: ['org-events', orgId] }) },
  })

  return { publish: (id) => { if (!m.isPending) m.mutate(id) }, publishingId }
}
