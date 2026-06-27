import { useQuery } from '@tanstack/react-query'
import { getPlatformSummary } from '@monobase/sdk-ts/generated'
import type { GetPlatformSummaryResponse } from '@monobase/sdk-ts/generated'

export type PlatformStats = {
  totalMembers: number
  activeMembers: number
  totalRevenueCents: number
  avgCollectionRate: number
}

export function usePlatformStats(): { status: 'loading' | 'ready' | 'error'; hasSnapshot: boolean; stats: PlatformStats } {
  const q = useQuery({
    queryKey: ['platform-stats'],
    retry: false,
    queryFn: async () => {
      const { data } = await getPlatformSummary({ query: {} })
      if (!data) throw new Error('stats failed')
      // getPlatformSummary is TRUSTWORTHY — bind directly to the generated type.
      const rows = (data as GetPlatformSummaryResponse).data
      const n = rows.length
      return {
        // I1: snapshot-cron derived. [] means "no snapshot yet for this month", not real zeros.
        hasSnapshot: n > 0,
        totalMembers: rows.reduce((s, r) => s + r.totalMembers, 0),
        activeMembers: rows.reduce((s, r) => s + r.activeMembers, 0),
        totalRevenueCents: rows.reduce((s, r) => s + r.totalRevenueCents, 0),
        avgCollectionRate: n > 0 ? rows.reduce((s, r) => s + r.collectionRate, 0) / n : 0,
      }
    },
  })
  const zero: PlatformStats = { totalMembers: 0, activeMembers: 0, totalRevenueCents: 0, avgCollectionRate: 0 }
  if (q.isLoading) return { status: 'loading', hasSnapshot: false, stats: zero }
  if (q.isError || !q.data) return { status: 'error', hasSnapshot: false, stats: zero }
  return { status: 'ready', hasSnapshot: q.data.hasSnapshot, stats: q.data }
}
