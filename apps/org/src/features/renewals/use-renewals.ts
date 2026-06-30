import { useQuery } from '@tanstack/react-query'
import { listRosterMembers } from '@monobase/sdk-ts/generated'

export type RenewalMember = {
  membershipId: string
  personId: string
  name: string
  memberNumber?: string | null
  status: string
  duesExpiryDate?: string | Date | null
  daysLeft: number | null
}

export type RenewalBuckets = { dueSoon: RenewalMember[]; grace: RenewalMember[]; lapsed: RenewalMember[] }

const DUE_SOON_DAYS = 30

// null/epoch (the transformer coerces a null date to 1970) → no countdown.
function daysUntil(d: string | Date | null | undefined): number | null {
  if (!d) return null
  const t = new Date(d).getTime()
  if (Number.isNaN(t) || t <= 0) return null
  return Math.ceil((t - Date.now()) / 86_400_000)
}

export function useRenewals(orgId: string | null): {
  status: 'idle' | 'loading' | 'ready' | 'empty' | 'error'
  buckets: RenewalBuckets
  total: number
  shown: number
  refetch: () => void
} {
  const q = useQuery({
    queryKey: ['renewals', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      const { data, response } = await listRosterMembers({ query: { organizationId: orgId!, pageSize: 100 } })
      const res = response as Response | undefined
      if (res && res.status >= 400) throw new Error('renewals failed')
      if (!data) throw new Error('renewals failed')
      const rows = (((data as any).data ?? []) as any[]).map((m) => ({
        membershipId: m.id,
        personId: m.personId,
        name: m.name || [m.firstName, m.lastName].filter(Boolean).join(' ') || '(no name)',
        memberNumber: m.memberNumber ?? null,
        status: m.status,
        duesExpiryDate: m.duesExpiryDate ?? null,
        daysLeft: daysUntil(m.duesExpiryDate),
      })) as RenewalMember[]

      const lapsed = rows.filter((m) => m.status === 'lapsed' || m.status === 'expired')
      const grace = rows.filter((m) => m.status === 'gracePeriod')
      const dueSoon = rows
        .filter((m) => m.status === 'active' && m.daysLeft != null && m.daysLeft >= 0 && m.daysLeft <= DUE_SOON_DAYS)
        .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0)) // soonest first
      return { buckets: { dueSoon, grace, lapsed }, total: Number((data as any).totalCount ?? rows.length), shown: rows.length }
    },
  })

  const refetch = () => void q.refetch()
  const empty: RenewalBuckets = { dueSoon: [], grace: [], lapsed: [] }
  if (!orgId) return { status: 'idle', buckets: empty, total: 0, shown: 0, refetch }
  if (q.isLoading) return { status: 'loading', buckets: empty, total: 0, shown: 0, refetch }
  if (q.isError) return { status: 'error', buckets: empty, total: 0, shown: 0, refetch }
  const b = q.data?.buckets ?? empty
  const anyRows = b.dueSoon.length + b.grace.length + b.lapsed.length > 0
  return {
    status: anyRows ? 'ready' : 'empty',
    buckets: b,
    total: q.data?.total ?? 0,
    shown: q.data?.shown ?? 0,
    refetch,
  }
}
