import { useQuery } from '@tanstack/react-query'
import { searchEvents } from '@monobase/sdk-ts/generated'

export type OrgEvent = {
  id: string
  title: string
  status: string
  startDate: string | Date
  endDate?: string | Date | null
  registrationFee?: number
  registeredCount: number
  waitlistCount: number
}

export function useOrgEvents(
  orgId: string | null,
): { status: 'idle' | 'loading' | 'ready' | 'empty' | 'error'; events: OrgEvent[]; refetch: () => void } {
  const q = useQuery({
    queryKey: ['org-events', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      // ponytail: pageSize 100 (the engine cap) — filtering is client-side, so a chapter with
      // 100+ lifetime events would silently miss the oldest. Surface "showing first N" + paginate
      // if a real chapter ever crosses it (v1 known limit).
      const { data, error } = await searchEvents({ query: { organizationId: orgId!, pageSize: 100 } })
      if (!data) throw new Error((error as any)?.error ?? 'events failed')
      const rows = (data.data ?? []) as Array<{
        id: string
        title: string
        status: string
        startDate: string | Date
        endDate?: string | Date | null
        registrationFee?: bigint
        registeredCount?: number
        waitlistCount?: number
      }>
      return rows.map((e) => ({
        id: e.id,
        title: e.title,
        status: e.status,
        startDate: e.startDate,
        endDate: e.endDate ?? null,
        // registrationFee is bigint at runtime — coerce for display.
        ...(e.registrationFee != null ? { registrationFee: Number(e.registrationFee) } : {}),
        registeredCount: Number(e.registeredCount ?? 0),
        waitlistCount: Number(e.waitlistCount ?? 0),
      }))
    },
  })
  const refetch = () => void q.refetch()
  if (!orgId) return { status: 'idle', events: [], refetch }
  if (q.isLoading) return { status: 'loading', events: [], refetch }
  if (q.isError) return { status: 'error', events: [], refetch }
  const all = q.data ?? []
  // Drafts first (only actionable rows), otherwise preserve server order.
  const events = [...all].sort((a, b) => (a.status === 'draft' ? 0 : 1) - (b.status === 'draft' ? 0 : 1))
  return { status: events.length === 0 ? 'empty' : 'ready', events, refetch }
}
