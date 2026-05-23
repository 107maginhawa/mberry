import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'
import { useOrg } from '@/hooks/useOrg'
import { Skeleton } from '@monobase/ui'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

const CollectionRateCard = lazy(() =>
  import('@/features/dues/components/collection-rate-card').then(m => ({ default: m.CollectionRateCard }))
)
const MonthlyTrendChart = lazy(() =>
  import('@/features/dues/components/monthly-trend-chart').then(m => ({ default: m.MonthlyTrendChart }))
)
const StatusDistributionChart = lazy(() =>
  import('@/features/dues/components/status-distribution-chart').then(m => ({ default: m.StatusDistributionChart }))
)
const TopUnpaidList = lazy(() =>
  import('@/features/dues/components/top-unpaid-list').then(m => ({ default: m.TopUnpaidList }))
)

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/dues/treasurer')({
  component: TreasurerDashboardPage,
})

function TreasurerDashboardPage() {
  const { orgId } = useOrg()

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['dues-metrics', orgId],
    queryFn: () => api.get<any>(`/api/association/member/dues-metrics/${orgId}`).then(r => r.data),
    enabled: !!orgId,
  })

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold">Treasurer Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-80" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Treasurer Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Suspense fallback={<Skeleton className="h-32" />}>
          <CollectionRateCard
            currentRate={metrics?.trailingRates?.days30 ?? 0}
            previousRate={metrics?.trailingRates?.days90 ?? 0}
          />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Suspense fallback={<Skeleton className="h-80" />}>
          <MonthlyTrendChart data={metrics?.monthlyBreakdown ?? []} />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-80" />}>
          <StatusDistributionChart data={metrics?.statusDistribution ?? { active: 0, dueSoon: 0, overdue: 0, lapsed: 0 }} />
        </Suspense>
      </div>

      <Suspense fallback={<Skeleton className="h-64" />}>
        <TopUnpaidList members={[]} />
      </Suspense>
    </div>
  )
}
