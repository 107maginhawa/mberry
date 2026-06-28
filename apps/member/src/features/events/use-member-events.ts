import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { searchEvents, type Event } from '@monobase/sdk-ts/generated'
import { useMemberOrg } from '@/features/org/use-member-org'

/**
 * Upcoming published events in the member's own org.
 *
 * Uses searchEvents (GET /association/events, allows association:member) scoped to
 * the member's orgId with status=published. listPublicEvents was wrong here: it only
 * returns visibility=public events, but chapter events default to visibility=internal,
 * so members saw "No upcoming events" for every real event. searchEvents returns the
 * org's published events regardless of public/internal visibility.
 */
export function useMemberEvents(): UseQueryResult<Event[]> {
  const { orgId } = useMemberOrg()
  return useQuery({
    queryKey: ['member-events', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      const { data, response } = await searchEvents({
        query: { organizationId: orgId!, status: 'published', limit: 50 },
      })
      if (!response || !response.ok) throw new Error(`Events fetch failed: ${response?.status ?? 'no response'}`)
      const all = (data?.data ?? []) as Event[]
      const now = Date.now()
      // Defensive: keep the published + upcoming client filter (server already scopes
      // by org + status, but the RSVP handler also requires published + future).
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
