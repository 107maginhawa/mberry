import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/my/events')({
  component: MyEvents,
})

function MyEvents() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">My Events</h1>
      <p className="text-sm text-muted-foreground">Events you're registered for across all organizations</p>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Event</th>
              <th className="text-left p-3 font-medium">Organization</th>
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-left p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td colSpan={4} className="p-8 text-center text-muted-foreground">
                No upcoming events.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
