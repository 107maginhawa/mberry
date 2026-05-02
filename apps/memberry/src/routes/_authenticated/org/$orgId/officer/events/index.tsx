import { createFileRoute, Link } from '@tanstack/react-router'
import { EventList } from '@/features/events/components/event-list'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/events/')({
  component: OfficerEvents,
})

function OfficerEvents() {
  const { orgId } = Route.useParams()

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-sm text-muted-foreground">Manage organization events and registrations</p>
        </div>
        <Link
          to="/org/$orgId/officer/events/new"
          params={{ orgId }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
        >
          Create Event
        </Link>
      </div>

      <EventList orgId={orgId} />
    </div>
  )
}
