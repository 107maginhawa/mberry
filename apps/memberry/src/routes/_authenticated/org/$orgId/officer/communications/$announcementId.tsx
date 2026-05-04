import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'

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
  draft: 'bg-muted text-muted-foreground',
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
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    )
  }

  if (error || !ann) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Announcement not found.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <Link
          to="/org/$orgId/officer/communications"
          params={{ orgId }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to Communications
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{ann.title}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[ann.status] ?? ''}`}>
              {ann.status}
            </span>
            <span>{ann.audienceType === 'all' ? 'All members' : 'Selected categories'}</span>
            {ann.channelPush && <span>· Push</span>}
            {ann.channelEmail && <span>· Email</span>}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="border rounded-lg p-5 bg-card whitespace-pre-wrap text-sm leading-relaxed">
        {ann.content}
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Created</p>
          <p>{formatDate(ann.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Published</p>
          <p>{formatDate(ann.publishedAt)}</p>
        </div>
        {ann.scheduledAt && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Scheduled For</p>
            <p>{formatDate(ann.scheduledAt)}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Visibility</p>
          <p className="capitalize">{ann.visibility}</p>
        </div>
      </div>

      {/* Delivery stats */}
      {ann.stats && (
        <div>
          <h2 className="text-base font-semibold mb-3">Delivery Stats</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Recipients', value: ann.stats.recipients },
              { label: 'In-app Views', value: ann.stats.inappViews },
              { label: 'Push Delivered', value: ann.stats.pushDelivered },
              { label: 'Email Opened', value: ann.stats.emailOpened },
            ].map((stat) => (
              <div key={stat.label} className="p-3 border rounded-lg bg-card text-center">
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2 border-t">
        {ann.status === 'draft' && (
          <button
            type="button"
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {publishMutation.isPending ? 'Publishing…' : 'Publish Now'}
          </button>
        )}
        {ann.status === 'sent' && (
          <button
            type="button"
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
            className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            Resend
          </button>
        )}
        {ann.status !== 'archived' && (
          <button
            type="button"
            onClick={() => archiveMutation.mutate()}
            disabled={archiveMutation.isPending}
            className="px-4 py-2 border rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
          >
            {archiveMutation.isPending ? 'Archiving…' : 'Archive'}
          </button>
        )}
        {ann.status === 'draft' && (
          <Link
            to="/org/$orgId/officer/communications/new"
            params={{ orgId }}
            search={{ edit: announcementId }}
            className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-muted"
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
            className="px-4 py-2 border border-red-200 rounded-md text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}
