import { useQuery } from '@tanstack/react-query'
import { searchEvents } from '@monobase/sdk-ts/generated'

export type OrgEvent = {
  id: string
  title: string
  status: string
  startDate: string | Date
  registrationFee?: number
}

export function useOrgEvents(
  orgId: string | null,
): { status: 'idle' | 'loading' | 'ready' | 'empty' | 'error'; events: OrgEvent[] } {
  const q = useQuery({
    queryKey: ['org-events', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await searchEvents({ query: { organizationId: orgId!, pageSize: 50 } })
      if (!data) throw new Error((error as any)?.error ?? 'events failed')
      const rows = (data.data ?? []) as Array<{
        id: string
        title: string
        status: string
        startDate: string | Date
        registrationFee?: bigint
      }>
      return rows.map((e) => ({
        id: e.id,
        title: e.title,
        status: e.status,
        startDate: e.startDate,
        // registrationFee is bigint at runtime — coerce for display.
        ...(e.registrationFee != null ? { registrationFee: Number(e.registrationFee) } : {}),
      }))
    },
  })
  if (!orgId) return { status: 'idle', events: [] }
  if (q.isLoading) return { status: 'loading', events: [] }
  if (q.isError) return { status: 'error', events: [] }
  const all = q.data ?? []
  // Drafts first (only actionable rows), otherwise preserve server order.
  const events = [...all].sort((a, b) => (a.status === 'draft' ? 0 : 1) - (b.status === 'draft' ? 0 : 1))
  return { status: events.length === 0 ? 'empty' : 'ready', events }
}
