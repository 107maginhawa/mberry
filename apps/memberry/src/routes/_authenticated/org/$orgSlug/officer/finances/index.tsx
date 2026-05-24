import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getDuesFinancialDashboardOptions } from '@monobase/sdk-ts/generated/react-query'
import type { FinancialDashboard, GetDuesFinancialDashboardData } from '@monobase/sdk-ts/generated/types.gen'
import { PageHeader } from '@/components/patterns/page-header'
import { useOrg } from '@/hooks/useOrg'
import { TrendingUp, Banknote, AlertCircle } from 'lucide-react'
import { MetricCard, MetricCardSkeleton } from '@/features/dues/components/metric-card'
import { AlertBanner } from '@/features/dues/components/alert-banner'
import { CollectionsAreaChart } from '@/features/dues/components/collections-area-chart'
import { RecentActivityFeed } from '@/features/dues/components/recent-activity-feed'
import { api } from '@/lib/api'
import { useNavigate } from '@tanstack/react-router'

type GetDuesFinancialDashboardDataWithHeaders = GetDuesFinancialDashboardData & {
  headers?: Record<string, string>
}

interface MonthlyData {
  month: string
  collected: number
  outstanding: number
}

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/finances/')({
  component: FinancesOverviewPage,
})

function FinancesOverviewPage() {
  const { orgId, orgSlug } = useOrg()
  const navigate = useNavigate()

  // Metric cards data
  const { data: dashboardData, isLoading: dashLoading } = useQuery(
    getDuesFinancialDashboardOptions(
      { path: { organizationId: orgId }, headers: { 'x-org-id': orgId } } as unknown as GetDuesFinancialDashboardDataWithHeaders
    )
  )
  const dashboard = dashboardData as FinancialDashboard | undefined

  // Monthly trend data (hand-wired endpoint, no SDK hook)
  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['dues-metrics', orgId],
    queryFn: () => api.get<any>(`/api/association/member/dues-metrics/${orgId}`).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const collectionRate = dashboard?.collectionRate ?? 0
  const totalCollected = Number(dashboard?.totalCollected ?? 0)
  const totalOutstanding = Number(dashboard?.totalOutstanding ?? 0)
  const pendingCount = dashboard?.pendingCount ?? 0
  const expiringCount = dashboard?.expiringThisMonth ?? 0

  const rateColor = collectionRate > 80 ? 'text-emerald-600' : collectionRate > 50 ? 'text-amber-600' : 'text-red-600'

  const monthlyData: MonthlyData[] = metricsData?.monthlyBreakdown ?? []

  return (
    <div className="space-y-5">
      <PageHeader
        title="Finances Overview"
        subtitle="Collection metrics, trends, and recent activity"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Finances' },
        ]}
      />

      {/* Metric cards */}
      {dashLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            label="Collection Rate"
            value={collectionRate}
            format={(n) => `${Math.round(n)}%`}
            icon={
              <div className={`w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center`}>
                <TrendingUp className={`h-5 w-5 ${rateColor}`} />
              </div>
            }
          />
          <MetricCard
            label="Collected This Period"
            value={totalCollected / 100}
            prefix="₱"
            format={(n) => n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            icon={
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Banknote className="h-5 w-5 text-blue-600" />
              </div>
            }
          />
          <MetricCard
            label="Outstanding Balance"
            value={totalOutstanding / 100}
            prefix="₱"
            format={(n) => n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            icon={
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
            }
          />
        </div>
      )}

      {/* Alert banners */}
      {expiringCount > 0 && (
        <AlertBanner
          variant="warning"
          message={`${expiringCount} member${expiringCount > 1 ? 's' : ''} with dues expiring this month`}
          action={{
            label: 'View Members',
            onClick: () => navigate({ to: '/org/$orgSlug/officer/finances/members', params: { orgSlug } }),
          }}
        />
      )}
      {pendingCount > 0 && (
        <AlertBanner
          variant="info"
          message={`${pendingCount} pending payment${pendingCount > 1 ? 's' : ''} awaiting review`}
          action={{
            label: 'Review Payments',
            onClick: () => navigate({ to: '/org/$orgSlug/officer/payments', params: { orgSlug } }),
          }}
        />
      )}

      {/* Area chart */}
      <CollectionsAreaChart data={monthlyData} isLoading={metricsLoading} />

      {/* Recent activity */}
      <RecentActivityFeed orgId={orgId} orgSlug={orgSlug} />
    </div>
  )
}
