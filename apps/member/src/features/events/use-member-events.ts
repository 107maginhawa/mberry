import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { listPublicEvents, type Event } from '@monobase/sdk-ts/generated'
import { useMemberOrg } from '@/features/org/use-member-org'

/** Upcoming events in the member's org (listPublicEvents is network-wide → client-filter). */
export function useMemberEvents(): UseQueryResult<Event[]> {
  const { orgId } = useMemberOrg()
  return useQuery({
    queryKey: ['member-events', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      const { data, response } = await listPublicEvents({ query: { limit: 50, dateFrom: new Date() } })
      if (!response || !response.ok) throw new Error(`Events fetch failed: ${response?.status ?? 'no response'}`)
      const all = (data?.data ?? []) as Event[]
      const now = Date.now()
      // status==='published' only — the wired RSVP handler rejects non-published; also drops cancelled/completed/draft.
      return all
        .filter(
          (e) =>
            e.organizationId === orgId &&
            e.status === 'published' &&
            new Date(e.startDate as unknown as string | Date).getTime() >= now,
        )
        .sort((a, b) => new Date(a.startDate as unknown as string | Date).getTime() - new Date(b.startDate as unknown as string | Date).getTime())
        .slice(0, 5)
    },
  })
}
