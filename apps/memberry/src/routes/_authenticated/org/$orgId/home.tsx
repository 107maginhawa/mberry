import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { searchEventsOptions } from '@monobase/sdk-ts/generated/react-query'
import { Megaphone, Calendar, MapPin, ArrowRight } from 'lucide-react'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { EmptyState } from '@/components/patterns/empty-state'
import { ListSkeleton } from '@/components/patterns/skeleton-loader'

export const Route = createFileRoute('/_authenticated/org/$orgId/home')({
  component: OrgHome,
})

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function OrgHome() {
  const { orgId } = Route.useParams()

  const { data: announcements, isLoading: loadingAnnouncements, error: announcementsError } = useQuery({
    queryKey: ['org-announcements', orgId],
    queryFn: async () => {
      return api.get<{ data: any[] }>(`/api/communications/announcements/${orgId}?status=sent&limit=5`)
    },
  })

  const { data: events, isLoading: loadingEvents, error: eventsError } = useQuery(
    searchEventsOptions({ query: { organizationId: orgId, limit: 5 } })
  )

  const announcementItems = announcements?.data ?? []
  const eventItems = events?.data ?? []

  return (
    <div className="space-y-8">
      <PageHeader
        title="Organization Home"
        subtitle="Latest updates and upcoming events"
        breadcrumbs={[
          { label: 'Organization' },
          { label: 'Home' },
        ]}
      />

      {/* Recent Announcements */}
      <section className="space-y-4">
        <h2 className="text-h4 flex items-center gap-2">
          <Megaphone className="w-5 h-5" />
          Recent Announcements
        </h2>

        {loadingAnnouncements ? (
          <ListSkeleton rows={3} />
        ) : announcementsError ? (
          <GlassCard className="p-6 text-center text-[var(--color-error)]">
            Failed to load announcements.
          </GlassCard>
        ) : announcementItems.length === 0 ? (
          <GlassCard className="p-0">
            <EmptyState
              icon={<Megaphone className="w-8 h-8" />}
              headline="No announcements yet"
              description="Check back soon for updates from your organization."
            />
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {announcementItems.map((a: any) => (
              <GlassCard key={a.id} className="p-4 space-y-1">
                <h3 className="text-h4 text-[var(--color-text)]">
                  {a.title ?? a.subject ?? 'Announcement'}
                </h3>
                {a.body && (
                  <p className="text-sm line-clamp-2 text-[var(--color-muted)]">
                    {a.body}
                  </p>
                )}
                {a.sentAt && (
                  <p className="text-xs text-[var(--color-muted)]">
                    {formatDate(a.sentAt)}
                  </p>
                )}
              </GlassCard>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming Events */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-h4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Upcoming Events
          </h2>
          <Link
            to="/org/$orgId/events"
            params={{ orgId }}
            className="text-sm text-[var(--color-primary)] flex items-center gap-1 hover:underline"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loadingEvents ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <ListSkeleton rows={4} />
          </div>
        ) : eventsError ? (
          <GlassCard className="p-6 text-center text-[var(--color-error)]">
            Failed to load events.
          </GlassCard>
        ) : eventItems.length === 0 ? (
          <GlassCard className="p-0">
            <EmptyState
              icon={<Calendar className="w-8 h-8" />}
              headline="No upcoming events"
              description="Check back soon!"
            />
          </GlassCard>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {eventItems.map((event: any) => (
              <Link
                key={event.id}
                to="/org/$orgId/events/$eventId"
                params={{ orgId, eventId: event.id }}
                className="block"
              >
                <GlassCard className="p-4 space-y-2">
                  <h3 className="text-h4 text-[var(--color-text)]">
                    {event.title}
                  </h3>
                  <div className="space-y-1 text-sm text-[var(--color-muted)]">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>{formatDate(event.startDate)}</span>
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span>{event.location}</span>
                      </div>
                    )}
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
