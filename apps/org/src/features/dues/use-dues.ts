import { useQuery } from '@tanstack/react-query'
import { getDuesDashboard, listDuesPayments, listDuesInvoices } from '@monobase/sdk-ts/generated'

export type DuesStats = {
  totalCollected: number
  totalOutstanding: number
  paidCount: number
  unpaidCount: number
  overdueCount: number
  collectionRate: number
  memberCount: number
}

export function useDuesDashboard(orgId: string | null): {
  data?: DuesStats
  isLoading: boolean
  isError: boolean
} {
  const q = useQuery({
    queryKey: ['dues', 'dashboard', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      const { data } = await getDuesDashboard({ path: { organizationId: orgId! } })
      if (!data) throw new Error('dashboard failed')
      // engine type/impl drift — handler returns collectionRate+memberCount
      // the generated type omits them; read defensively with fallback.
      const d = ((data as any).data ?? data) as {
        totalCollected: number
        totalOutstanding: number
        paidCount: number
        unpaidCount: number
        overdueCount: number
        collectionRate?: number
        memberCount?: number
      }
      const mc = Number(
        d.memberCount ?? (Number(d.paidCount) + Number(d.unpaidCount) + Number(d.overdueCount)),
      )
      return {
        totalCollected: Number(d.totalCollected),
        totalOutstanding: Number(d.totalOutstanding),
        paidCount: Number(d.paidCount),
        unpaidCount: Number(d.unpaidCount),
        overdueCount: Number(d.overdueCount),
        collectionRate: Number(
          d.collectionRate ?? (mc > 0 ? Math.round((Number(d.paidCount) / mc) * 100) : 0),
        ),
        memberCount: mc,
      } as DuesStats
    },
  })
  return { data: q.data, isLoading: q.isLoading, isError: q.isError }
}

export function useRecentPayments(orgId: string | null) {
  return useQuery({
    queryKey: ['dues', 'payments', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      const { data } = await listDuesPayments({ query: { pageSize: 20 } })
      if (!data) throw new Error('payments failed')
      // x-org-id auto-injected by configureApiClient interceptor
      return (data.data as any[]).map((p) => ({
        ...p,
        amount: Number(p.amount),
        // Coerce refundedAmount to prevent bigint leaking into RQ cache / DevTools serialize crash
        refundedAmount: Number(p.refundedAmount),
      }))
    },
  })
}

export function useOutstandingInvoices(orgId: string | null) {
  // Fetch both 'sent' and 'overdue' — showing only 'sent' contradicts the
  // overdueCount dashboard tile (which counts overdue invoices too).
  const sentQ = useQuery({
    queryKey: ['dues', 'outstanding', 'sent', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      const { data } = await listDuesInvoices({ query: { status: 'sent', limit: 50 } })
      if (!data) throw new Error('invoices failed')
      // x-org-id auto-injected by configureApiClient interceptor
      // CRIT-1 fix: invoice money field is `totalAmount` (NOT `amount`)
      return (data.data as any[]).map((i) => ({ ...i, amount: Number(i.totalAmount) }))
    },
  })

  const overdueQ = useQuery({
    queryKey: ['dues', 'outstanding', 'overdue', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      const { data } = await listDuesInvoices({ query: { status: 'overdue', limit: 50 } })
      if (!data) throw new Error('invoices failed')
      return (data.data as any[]).map((i) => ({ ...i, amount: Number(i.totalAmount) }))
    },
  })

  const sentData = sentQ.data ?? []
  const overdueData = overdueQ.data ?? []

  // Merge and dedupe by id (defensive: API could return same invoice for both)
  const seen = new Set<string>()
  const merged: any[] = []
  for (const inv of [...sentData, ...overdueData]) {
    if (!seen.has(inv.id)) {
      seen.add(inv.id)
      merged.push(inv)
    }
  }

  const hasAnyData = sentQ.isSuccess || overdueQ.isSuccess

  return {
    data: hasAnyData ? merged : undefined,
    isLoading: sentQ.isLoading || overdueQ.isLoading,
    isError: (sentQ.isError || overdueQ.isError) && !hasAnyData,
    refetch: () => {
      void sentQ.refetch()
      void overdueQ.refetch()
    },
  }
}
