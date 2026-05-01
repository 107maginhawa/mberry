import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/org/$orgId/officer/events/')({
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
        <a
          href={`/org/${orgId}/officer/events/new`}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
        >
          Create Event
        </a>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Title</th>
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-left p-3 font-medium">Registrations</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td colSpan={5} className="p-8 text-center text-muted-foreground">
                No events yet. Create your first event.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
