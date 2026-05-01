import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/org/$orgId/officer/communications')({
  component: OfficerCommunications,
})

function OfficerCommunications() {
  const { orgId } = Route.useParams()

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Communications</h1>
          <p className="text-sm text-muted-foreground">Send announcements and messages to members</p>
        </div>
        <a
          href={`/org/${orgId}/officer/communications/new`}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
        >
          New Message
        </a>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Subject</th>
              <th className="text-left p-3 font-medium">Channel</th>
              <th className="text-left p-3 font-medium">Recipients</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Sent</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td colSpan={5} className="p-8 text-center text-muted-foreground">
                No messages yet. Send your first announcement.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
