import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['org-events', orgId] }) },
    onSettled: () => { setPublishingId(null) },
  })

  return { publish: (id) => { if (!m.isPending) m.mutate(id) }, publishingId }
}
