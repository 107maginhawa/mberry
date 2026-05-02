import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { EventForm } from '@/features/events/components/event-form'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/events/new')({
  component: NewEvent,
})

function NewEvent() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      <div>
        <a
          href={`/org/${orgId}/officer/events`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to Events
        </a>
        <h1 className="text-2xl font-bold mt-2">Create Event</h1>
        <p className="text-sm text-muted-foreground">Fill in the details for your new event</p>
      </div>

      <div className="border rounded-lg p-6">
        <EventForm
          orgId={orgId}
          onSuccess={(event) => {
            navigate({
              to: '/org/$orgId/officer/events/$eventId',
              params: { orgId, eventId: event.id },
            })
          }}
          onCancel={() => {
            navigate({
              to: '/org/$orgId/officer/events',
              params: { orgId },
            })
          }}
        />
      </div>
    </div>
  )
}
