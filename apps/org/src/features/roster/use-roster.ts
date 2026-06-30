import { useQuery } from '@tanstack/react-query'
import { listRosterMembers } from '@monobase/sdk-ts/generated'

export type MemberFilter = 'all' | 'unpaid' | 'lapsed' | 'due'

// Chip → server membership-status filter. NOTE: 'unpaid' maps to pendingPayment only;
// the server filter doesn't catch active-with-open-invoice (refine once the duesStatus
// enum is confirmed). The per-row `unpaid` flag below still reflects the full derivation.
const FILTER_STATUS: Record<MemberFilter, 'pendingPayment' | 'lapsed' | 'gracePeriod' | undefined> = {
  all: undefined,
  unpaid: 'pendingPayment',
  lapsed: 'lapsed',
  due: 'gracePeriod',
}

const OPEN_INVOICE = new Set(['generated', 'sent', 'overdue'])

export type RosterMember = {
  membershipId: string
  personId: string
  name: string
  memberNumber?: string
  status: string
  /** joinedAt — a Date (coerced by the SDK response transformer); null when unknown. */
  joinedAt?: string | Date | null
  /** Membership category/tier display name. */
  tier?: string | null
  /** Derived: pendingPayment OR an open dues invoice (generated/sent/overdue). */
  unpaid?: boolean
}

type RosterRow = {
  id: string
  personId: string
  firstName?: string | null
  lastName?: string | null
  name?: string | null
  status: string
  memberNumber?: string | null
  joinedAt?: string | Date | null
  categoryName?: string | null
  duesInvoiceStatus?: string | null
}

export function useRoster(
  orgId: string | null,
  filter: MemberFilter = 'all',
): {
  status: 'idle' | 'loading' | 'ready' | 'empty' | 'error'
  members: RosterMember[]
  totalCount: number
  refetch: () => void
} {
  const q = useQuery({
    // filter is in the key so each chip is its own cached server query; useImportRoster
    // invalidates ['roster', orgId] which prefix-matches every filter variant.
    queryKey: ['roster', orgId, filter],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      const status = FILTER_STATUS[filter]
      const { data, response } = await listRosterMembers({
        query: { organizationId: orgId!, pageSize: 100, ...(status ? { status } : {}) },
      })
      // SDK doesn't throw on non-2xx; surface 403 (wrong role / no 2FA) as an error state.
      const res = response as Response | undefined
      if (res && res.status >= 400) throw new Error('roster failed')
      if (!data) throw new Error('roster failed')
      // Handler returns { data, totalCount } — NOT the generated validator's { data, pagination }
      // envelope. Anchor to the handler (drift guard); read totalCount off the real body.
      const body = data as unknown as { data?: RosterRow[]; totalCount?: number }
      const members: RosterMember[] = (body.data ?? []).map((m) => ({
        membershipId: m.id,
        personId: m.personId,
        name: m.name || [m.firstName, m.lastName].filter(Boolean).join(' ') || '(no name)',
        memberNumber: m.memberNumber ?? undefined,
        status: m.status,
        joinedAt: m.joinedAt ?? null,
        tier: m.categoryName ?? null,
        unpaid: m.status === 'pendingPayment' || OPEN_INVOICE.has(String(m.duesInvoiceStatus ?? '')),
      }))
      return { members, totalCount: body.totalCount ?? members.length }
    },
  })
  const refetch = () => void q.refetch()
  if (!orgId) return { status: 'idle', members: [], totalCount: 0, refetch }
  if (q.isLoading) return { status: 'loading', members: [], totalCount: 0, refetch }
  if (q.isError) return { status: 'error', members: [], totalCount: 0, refetch }
  const members = q.data?.members ?? []
  return {
    status: members.length === 0 ? 'empty' : 'ready',
    members,
    totalCount: q.data?.totalCount ?? 0,
    refetch,
  }
}
