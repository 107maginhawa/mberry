import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { EmptyState } from '@/components/patterns/empty-state'
import { ErrorState } from '@/components/patterns/error-state'
import { Skeleton } from '@monobase/ui'
import { Megaphone } from 'lucide-react'
import { useOrg } from '@/hooks/use-org'
import { api } from '@/lib/api'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/announcements/')({
  component: MemberAnnouncementFeed,
})

function formatDate(iso: string | null | undefined) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function MemberAnnouncementFeed() {
  const { orgId, orgSlug } = useOrg()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['announcements', orgId, 'sent'],
    queryFn: async () => {
      return api.get<{ data: Array<{ id: string; title: string; content?: string; publishedAt?: string; createdBy?: string }> }>(
        `/api/communications/announcements/${orgId}?status=sent`
      )
    },
  })

  const announcements = data?.data ?? []

  return (
    <PageShell
      title="Announcements"
      subtitle="Updates from your association"
      breadcrumbs={[
        { label: 'Home', href: `/org/${orgSlug}` },
        { label: 'Announcements' },
      ]}
    >
      <div className="space-y-6">
      {isError ? (
        <ErrorState message="Could not load announcements" onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <GlassCard className="p-8">
          <EmptyState
            icon={<Megaphone className="h-10 w-10" />}
            headline="No announcements yet"
            description="Check back later for updates from your association."
          />
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => (
            <Link
              key={ann.id}
              to="/org/$orgSlug/announcements/$announcementId"
              params={{ orgSlug, announcementId: ann.id }}
              className="block"
            >
              <GlassCard className="p-4 hover:ring-1 hover:ring-[var(--color-primary)]/30 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--color-text)] truncate">
                      {ann.title}
                    </h3>
                    {ann.content && (
                      <p className="text-xs text-[var(--color-muted)] mt-1 line-clamp-2">
                        {ann.content.replace(/<[^>]*>/g, '').slice(0, 120)}
                      </p>
                    )}
                  </div>
                  {ann.publishedAt && (
                    <span className="text-[10px] text-[var(--color-muted)] whitespace-nowrap">
                      {formatDate(ann.publishedAt)}
                    </span>
                  )}
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      )}
      </div>
    </PageShell>
  )
}
