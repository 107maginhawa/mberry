import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { Megaphone, Calendar, MapPin, ArrowRight } from 'lucide-react'

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

  const { data: events, isLoading: loadingEvents, error: eventsError } = useQuery({
    queryKey: ['org-upcoming-events', orgId],
    queryFn: async () => {
      return api.get<{ data: any[] }>(`/api/events?orgId=${orgId}&limit=5`)
    },
  })

  const announcementItems = announcements?.data ?? []
  const eventItems = events?.data ?? []

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
          Organization Home
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Latest updates and upcoming events
        </p>
      </div>

      {/* Recent Announcements */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Megaphone className="w-5 h-5" />
            Recent Announcements
          </h2>
        </div>

        {loadingAnnouncements ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-[12px]" />
            ))}
          </div>
        ) : announcementsError ? (
          <div
            className="rounded-[12px] p-6 text-center text-destructive"
            style={{ border: '1px solid var(--color-border-light)' }}
          >
            Failed to load announcements.
          </div>
        ) : announcementItems.length === 0 ? (
          <div
            className="rounded-[12px] p-8 text-center"
            style={{ border: '1px solid var(--color-border-light)', color: 'var(--color-muted)' }}
          >
            No announcements yet.
          </div>
        ) : (
          <div className="space-y-3">
            {announcementItems.map((a: any) => (
              <div
                key={a.id}
                className="rounded-[12px] p-4 space-y-1"
                style={{ border: '1px solid var(--color-border-light)' }}
              >
                <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
                  {a.title ?? a.subject ?? 'Announcement'}
                </h3>
                {a.body && (
                  <p className="text-sm line-clamp-2" style={{ color: 'var(--color-muted)' }}>
                    {a.body}
                  </p>
                )}
                {a.sentAt && (
                  <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                    {formatDate(a.sentAt)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming Events */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Upcoming Events
          </h2>
          <Link
            to="/org/$orgId/events"
            params={{ orgId }}
            className="text-sm text-primary flex items-center gap-1 hover:underline"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loadingEvents ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-[12px]" />
            ))}
          </div>
        ) : eventsError ? (
          <div
            className="rounded-[12px] p-6 text-center text-destructive"
            style={{ border: '1px solid var(--color-border-light)' }}
          >
            Failed to load events.
          </div>
        ) : eventItems.length === 0 ? (
          <div
            className="rounded-[12px] p-8 text-center"
            style={{ border: '1px solid var(--color-border-light)', color: 'var(--color-muted)' }}
          >
            No upcoming events. Check back soon!
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {eventItems.map((event: any) => (
              <Link
                key={event.id}
                to="/org/$orgId/events/$eventId"
                params={{ orgId, eventId: event.id }}
                className="block rounded-[12px] p-4 space-y-2 hover:bg-muted/30 transition-colors"
                style={{ border: '1px solid var(--color-border-light)' }}
              >
                <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
                  {event.title}
                </h3>
                <div className="space-y-1 text-sm" style={{ color: 'var(--color-muted)' }}>
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
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
