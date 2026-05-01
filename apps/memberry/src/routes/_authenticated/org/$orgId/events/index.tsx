import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/org/$orgId/events/')({
  component: OrgEvents,
})

function OrgEvents() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Organization Events</h1>
      <p className="text-sm text-muted-foreground">Browse and register for upcoming events</p>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Event</th>
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-left p-3 font-medium">Location</th>
              <th className="text-left p-3 font-medium">Spots</th>
              <th className="text-left p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td colSpan={5} className="p-8 text-center text-muted-foreground">
                No upcoming events.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
