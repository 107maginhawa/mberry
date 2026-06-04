/**
 * Member Announcement View — read-only announcement detail page.
 * VS-031: Wave 4b Communications.
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@monobase/ui'
import { api } from '@/lib/api'
import { PageShell } from '@/components/patterns/page-shell'
import { EmptyState } from '@/components/patterns/empty-state'
import { ListSkeleton } from '@/components/patterns/skeleton-loader'
import { AnnouncementContent } from '@/features/communications/components/announcement-content'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/announcements/$announcementId')({
  component: MemberAnnouncementPage,
})

function MemberAnnouncementPage() {
  const { orgSlug, announcementId } = Route.useParams()
  const orgId = orgSlug
  const navigate = useNavigate()

  const { data, isLoading, error } = useQuery({
    queryKey: ['announcement', announcementId],
    queryFn: () =>
      api.get<{ data: any }>(
        `/api/communications/announcements/detail/${announcementId}`
      ),
  })

  const ann = data?.data

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <ListSkeleton rows={3} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div role="alert" className="p-4 rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">
          Unable to load this announcement. Please try refreshing the page.
        </div>
      </div>
    )
  }

  if (!ann) {
    return (
      <div className="space-y-6 max-w-3xl">
        <EmptyState
          headline="Announcement not found"
          description="This announcement may have been removed or is no longer available."
          action={{
            label: 'Go Back',
            onClick: () => navigate({ to: -1 as any }),
          }}
        />
      </div>
    )
  }

  return (
    <PageShell
      title={ann.title}
      actions={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: -1 as any })}
          className="gap-1.5"
        >
          <ArrowLeft size={16} />
          Back
        </Button>
      }
    >
      <div className="space-y-6 max-w-3xl">
        <AnnouncementContent
          announcement={ann}
          showActions={false}
          showStats={false}
        />
      </div>
    </PageShell>
  )
}
