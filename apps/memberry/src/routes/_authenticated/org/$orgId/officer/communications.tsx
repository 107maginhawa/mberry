import { createFileRoute, Link } from '@tanstack/react-router'
import { AnnouncementList } from '@/features/communications/components/announcement-list'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/communications')({
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
        <Link
          to="/org/$orgId/officer/communications/new"
          params={{ orgId }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
        >
          New Message
        </Link>
      </div>

      <AnnouncementList orgId={orgId} />
    </div>
  )
}
