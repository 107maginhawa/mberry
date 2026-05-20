import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { EmptyState } from '@/components/patterns/empty-state'
import { ListSkeleton } from '@/components/patterns/skeleton-loader'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/communications/$announcementId')({
  component: AnnouncementDetailPage,
})

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-[var(--color-surface-warm)] text-[var(--color-muted)]',
  scheduled: 'bg-blue-100 text-blue-800',
  sent: 'bg-green-100 text-green-800',
  scheduled_failed: 'bg-red-100 text-red-800',
  archived: 'bg-gray-100 text-gray-600',
}

function AnnouncementDetailPage() {
  const { orgId, announcementId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['announcement', announcementId],
    queryFn: () => api.get<{ data: any }>(`/api/communications/announcements/detail/${announcementId}`),
  })

  const publishMutation = useMutation({
    mutationFn: () => api.post(`/api/communications/announcements/${announcementId}/publish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcement', announcementId] })
      queryClient.invalidateQueries({ queryKey: ['announcements', orgId] })
    },
  })

  const archiveMutation = useMutation({
    mutationFn: () => api.post(`/api/communications/announcements/${announcementId}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcement', announcementId] })
      queryClient.invalidateQueries({ queryKey: ['announcements', orgId] })
    },
  })

  const ann = data?.data

  if (isLoading) {
    return (
      <div className="space-y-6">
        <ListSkeleton rows={3} />
      </div>
    )
  }

  if (error || !ann) {
    return (
      <div className="space-y-6">
        <EmptyState
          headline="Announcement not found"
          description="This announcement may have been removed or you don't have access."
          action={{ label: 'Back to Communications', onClick: () => navigate({ to: `/org/${orgId}/officer/communications` }) }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={ann.title}
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgId}/officer/dashboard` },
          { label: 'Communications', href: `/org/${orgId}/officer/communications` },
          { label: 'Details' },
        ]}
      />

      {/* Status bar */}
      <div className="flex items-center gap-3 text-[14px] text-[var(--color-muted)]">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[12px] font-medium ${STATUS_BADGE[ann.status] ?? ''}`}>
          {ann.status.charAt(0).toUpperCase() + ann.status.slice(1).replace('_', ' ')}
        </span>
        <span>{ann.audienceType === 'all' ? 'All members' : 'Selected categories'}</span>
        {ann.channelPush && <span>· Push</span>}
        {ann.channelEmail && <span>· Email</span>}
      </div>

      {/* Content */}
      <GlassCard className="p-5">
        <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--color-text)]">
          {ann.content}
        </div>
      </GlassCard>

      {/* Metadata */}
      <GlassCard className="p-5">
        <div className="grid grid-cols-2 gap-4 text-[14px]">
          <div>
            <p className="text-[12px] text-[var(--color-muted)] uppercase tracking-wide mb-0.5">Created</p>
            <p>{formatDate(ann.createdAt)}</p>
          </div>
          <div>
            <p className="text-[12px] text-[var(--color-muted)] uppercase tracking-wide mb-0.5">Published</p>
            <p>{formatDate(ann.publishedAt)}</p>
          </div>
          {ann.scheduledAt && (
            <div>
              <p className="text-[12px] text-[var(--color-muted)] uppercase tracking-wide mb-0.5">Scheduled For</p>
              <p>{formatDate(ann.scheduledAt)}</p>
            </div>
          )}
          <div>
            <p className="text-[12px] text-[var(--color-muted)] uppercase tracking-wide mb-0.5">Visibility</p>
            <p className="capitalize">{ann.visibility}</p>
          </div>
        </div>
      </GlassCard>

      {/* Delivery stats */}
      {ann.stats && (
        <GlassCard className="p-5">
          <h2 className="text-h4 mb-3">Delivery Stats</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Recipients', value: ann.stats.recipients },
              { label: 'In-app Views', value: ann.stats.inappViews },
              { label: 'Push Delivered', value: ann.stats.pushDelivered },
              { label: 'Email Opened', value: ann.stats.emailOpened },
            ].map((stat) => (
              <div key={stat.label} className="p-3 border rounded-[8px] text-center">
                <p className="text-[20px] font-bold">{stat.value}</p>
                <p className="text-[12px] text-[var(--color-muted)] mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2 border-t">
        {ann.status === 'draft' && (
          <button
            type="button"
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-[8px] text-[14px] font-medium hover:bg-[var(--color-primary-mid)] disabled:opacity-50"
          >
            {publishMutation.isPending ? 'Publishing…' : 'Publish Now'}
          </button>
        )}
        {ann.status === 'sent' && (
          <button
            type="button"
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
            className="px-4 py-2 border rounded-[8px] text-[14px] font-medium hover:bg-[var(--color-surface-warm)] disabled:opacity-50"
          >
            Resend
          </button>
        )}
        {ann.status !== 'archived' && (
          <button
            type="button"
            onClick={() => archiveMutation.mutate()}
            disabled={archiveMutation.isPending}
            className="px-4 py-2 border rounded-[8px] text-[14px] font-medium text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-warm)] disabled:opacity-50"
          >
            {archiveMutation.isPending ? 'Archiving…' : 'Archive'}
          </button>
        )}
        {ann.status === 'draft' && (
          <Link
            to="/org/$orgId/officer/communications/new"
            params={{ orgId }}
            search={{ edit: announcementId }}
            className="px-4 py-2 border rounded-[8px] text-[14px] font-medium hover:bg-[var(--color-surface-warm)]"
          >
            Edit
          </Link>
        )}
        {ann.status === 'draft' && (
          <button
            onClick={async () => {
              if (!confirm('Delete this draft?')) return
              await api.delete(`/api/communications/announcements/${announcementId}`)
              navigate({ to: `/org/${orgId}/officer/communications` })
            }}
            className="px-4 py-2 border border-red-200 rounded-[8px] text-[14px] font-medium text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}
