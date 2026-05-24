import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@monobase/ui'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { ListSkeleton } from '@/components/patterns/skeleton-loader'
import { DeliveryFunnel } from '@/features/communications/components/delivery-funnel'
import { useOrg } from '@/hooks/useOrg'
import { api } from '@/lib/api'

export const Route = createFileRoute(
  '/_authenticated/org/$orgSlug/officer/communications/analytics',
)({
  component: AnalyticsDashboardPage,
})

interface AnnouncementWithStats {
  id: string
  title: string
  channelPush: boolean
  channelEmail: boolean
  status: string
  publishedAt: string | null
  stats?: {
    recipients: number
    emailSent: number
    pushDelivered: number
    inappViews: number
  }
}

function AnalyticsDashboardPage() {
  const { orgId, orgSlug } = useOrg()

  const { data, isLoading } = useQuery({
    queryKey: ['announcements-analytics', orgId],
    queryFn: () =>
      api.get<{ data: AnnouncementWithStats[]; total: number }>(
        `/api/communications/announcements?organizationId=${orgId}&status=sent`,
      ),
  })

  const announcements = data?.data ?? []

  // Client-side aggregation for KPI cards
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const thisMonthAnnouncements = announcements.filter(
    (a) => a.publishedAt && new Date(a.publishedAt) >= thisMonthStart,
  )

  const totalSentThisMonth = thisMonthAnnouncements.length
  const totalRecipients = announcements.reduce(
    (sum, a) => sum + (a.stats?.recipients ?? 0),
    0,
  )
  const totalEmailDelivered = announcements.reduce(
    (sum, a) => sum + (a.stats?.emailSent ?? 0),
    0,
  )
  const totalPushDelivered = announcements.reduce(
    (sum, a) => sum + (a.stats?.pushDelivered ?? 0),
    0,
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communications Analytics"
        subtitle="Delivery stats and performance metrics"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          {
            label: 'Communications',
            href: `/org/${orgSlug}/officer/communications`,
          },
          { label: 'Analytics' },
        ]}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-5">
          <p className="text-sm text-muted-foreground">Sent This Month</p>
          <p className="text-2xl font-bold tabular-nums" data-testid="kpi-sent">
            {isLoading ? '-' : totalSentThisMonth}
          </p>
        </GlassCard>
        <GlassCard className="p-5">
          <p className="text-sm text-muted-foreground">Total Recipients</p>
          <p
            className="text-2xl font-bold tabular-nums"
            data-testid="kpi-recipients"
          >
            {isLoading ? '-' : totalRecipients}
          </p>
        </GlassCard>
        <GlassCard className="p-5">
          <p className="text-sm text-muted-foreground">Email Delivered</p>
          <p
            className="text-2xl font-bold tabular-nums"
            data-testid="kpi-email"
          >
            {isLoading ? '-' : totalEmailDelivered}
          </p>
        </GlassCard>
        <GlassCard className="p-5">
          <p className="text-sm text-muted-foreground">Push Delivered</p>
          <p
            className="text-2xl font-bold tabular-nums"
            data-testid="kpi-push"
          >
            {isLoading ? '-' : totalPushDelivered}
          </p>
        </GlassCard>
      </div>

      {/* Delivery Funnel */}
      {!isLoading && (
        <DeliveryFunnel
          sent={totalRecipients}
          delivered={totalEmailDelivered + totalPushDelivered}
          opened={announcements.reduce((s, a) => s + (a.stats?.inappViews ?? 0), 0)}
          clicked={0}
        />
      )}

      {/* Announcements Table */}
      {isLoading ? (
        <ListSkeleton />
      ) : announcements.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <p className="text-muted-foreground">
            No announcements sent yet. Send your first announcement to see
            analytics here.
          </p>
        </GlassCard>
      ) : (
        <GlassCard className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left bg-muted/30">
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Date Sent</th>
                  <th className="px-4 py-3 font-medium text-right">
                    Recipients
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Email</th>
                  <th className="px-4 py-3 font-medium text-right">Push</th>
                  <th className="px-4 py-3 font-medium text-right">In-App</th>
                </tr>
              </thead>
              <tbody>
                {announcements
                  .sort((a, b) => {
                    const da = a.publishedAt
                      ? new Date(a.publishedAt).getTime()
                      : 0
                    const db = b.publishedAt
                      ? new Date(b.publishedAt).getTime()
                      : 0
                    return db - da
                  })
                  .map((ann) => (
                    <tr key={ann.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium">{ann.title}</p>
                        <div className="flex gap-1 mt-1">
                          <Badge variant="outline" className="text-xs">
                            In-App
                          </Badge>
                          {ann.channelPush && (
                            <Badge variant="outline" className="text-xs">
                              Push
                            </Badge>
                          )}
                          {ann.channelEmail && (
                            <Badge variant="outline" className="text-xs">
                              Email
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {ann.publishedAt
                          ? new Date(ann.publishedAt).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {ann.stats?.recipients ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {ann.stats?.emailSent ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {ann.stats?.pushDelivered ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {ann.stats?.inappViews ?? '-'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  )
}
