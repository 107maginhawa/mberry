import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/org/$orgId/officer/events/$eventId')({
  component: EventAttendance,
})

function EventAttendance() {
  const { orgId, eventId } = Route.useParams()

  return (
    <div className="space-y-6 p-6">
      <a href={`/org/${orgId}/officer/events`} className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to Events
      </a>
      <h1 className="text-2xl font-bold">Event Attendance</h1>
      <p className="text-sm text-muted-foreground">Track check-ins and manage attendance for this event</p>

      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Registered</p>
          <p className="text-2xl font-bold">0</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Checked In</p>
          <p className="text-2xl font-bold">0</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">No Show</p>
          <p className="text-2xl font-bold">0</p>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Member</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Check-in Time</th>
              <th className="text-left p-3 font-medium">Method</th>
              <th className="text-left p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td colSpan={5} className="p-8 text-center text-muted-foreground">
                No registrations yet.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
