import { createFileRoute, Link } from '@tanstack/react-router'
import { AnnouncementList } from '@/features/communications/components/announcement-list'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/communications/')({
  component: OfficerCommunications,
})

function OfficerCommunications() {
  const { orgId } = Route.useParams()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-display font-bold">Communications</h1>
          <p className="text-[14px] text-[var(--color-muted)]">Send announcements and messages to members</p>
        </div>
        <Link
          to="/org/$orgId/officer/communications/new"
          params={{ orgId }}
          className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-[8px] text-[14px] font-medium hover:bg-[var(--color-primary-mid)]"
        >
          New Message
        </Link>
      </div>
      <AnnouncementList orgId={orgId} />
    </div>
  )
}
