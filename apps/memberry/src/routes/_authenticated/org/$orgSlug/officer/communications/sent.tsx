import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@monobase/ui'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { ListSkeleton } from '@/components/patterns/skeleton-loader'
import { useOrg } from '@/hooks/useOrg'
import { api } from '@/lib/api'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/communications/sent')({
  component: SentHistoryPage,
})

interface SentAnnouncement {
  id: string
  title: string
  content: string
  channelPush: boolean
  channelEmail: boolean
  audienceType: string
  status: string
  publishedAt: string | null
  createdAt: string
  stats?: {
    recipients: number
    emailSent: number
    pushDelivered: number
    inappViews: number
  }
}

function SentHistoryPage() {
  const { orgId, orgSlug } = useOrg()

  const { data, isLoading } = useQuery({
    queryKey: ['announcements-sent', orgId],
    queryFn: () =>
      api.get<{ data: SentAnnouncement[]; total: number }>(
        `/api/communications/announcements?organizationId=${orgId}&status=sent`,
      ),
  })

  const announcements = data?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sent History"
        subtitle="View delivery stats for sent announcements"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Communications', href: `/org/${orgSlug}/officer/communications` },
          { label: 'Sent' },
        ]}
      />

      {isLoading ? (
        <ListSkeleton />
      ) : announcements.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <p className="text-muted-foreground">No sent announcements yet.</p>
        </GlassCard>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-3 font-medium">Subject</th>
                <th className="pb-3 font-medium">Recipients</th>
                <th className="pb-3 font-medium">Channels</th>
                <th className="pb-3 font-medium">Sent</th>
                <th className="pb-3 font-medium">Delivery</th>
              </tr>
            </thead>
            <tbody>
              {announcements.map((ann) => (
                <tr key={ann.id} className="border-b last:border-0">
                  <td className="py-3 pr-4">
                    <p className="font-medium">{ann.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {ann.content.substring(0, 80)}
                    </p>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="tabular-nums">{ann.stats?.recipients ?? '-'}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex gap-1">
                      <Badge variant="outline" className="text-xs">In-App</Badge>
                      {ann.channelPush && <Badge variant="outline" className="text-xs">Push</Badge>}
                      {ann.channelEmail && <Badge variant="outline" className="text-xs">Email</Badge>}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {ann.publishedAt
                      ? new Date(ann.publishedAt).toLocaleDateString()
                      : '-'}
                  </td>
                  <td className="py-3">
                    {ann.stats ? (
                      <div className="text-xs space-y-0.5">
                        {ann.stats.emailSent > 0 && (
                          <p>Email: {ann.stats.emailSent}</p>
                        )}
                        {ann.stats.pushDelivered > 0 && (
                          <p>Push: {ann.stats.pushDelivered}</p>
                        )}
                        {ann.stats.inappViews > 0 && (
                          <p>Views: {ann.stats.inappViews}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
