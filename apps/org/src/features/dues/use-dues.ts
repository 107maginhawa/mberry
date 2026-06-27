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

export function useDuesDashboard(orgId: string | null): { data?: DuesStats; isLoading: boolean } {
  const q = useQuery({
    queryKey: ['dues', 'dashboard', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      const { data } = await getDuesDashboard({ path: { organizationId: orgId! } })
      if (!data) throw new Error('dashboard failed')
      // Handle both { data: {...} } and flat response shapes
      const d = (data as any).data ?? data
      return {
        totalCollected: Number(d.totalCollected),
        totalOutstanding: Number(d.totalOutstanding),
        paidCount: Number(d.paidCount),
        unpaidCount: Number(d.unpaidCount),
        overdueCount: Number(d.overdueCount),
        collectionRate: Number(d.collectionRate),
        memberCount: Number(d.memberCount),
      } as DuesStats
    },
  })
  return { data: q.data, isLoading: q.isLoading }
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
      return (data.data as any[]).map((p) => ({ ...p, amount: Number(p.amount) }))
    },
  })
}

export function useOutstandingInvoices(orgId: string | null) {
  return useQuery({
    queryKey: ['dues', 'outstanding', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      const { data } = await listDuesInvoices({ query: { status: 'sent', limit: 50 } })
      if (!data) throw new Error('invoices failed')
      // x-org-id auto-injected by configureApiClient interceptor
      return (data.data as any[]).map((i) => ({ ...i, amount: Number(i.amount) }))
    },
  })
}
