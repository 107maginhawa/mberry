import { createFileRoute, Link } from '@tanstack/react-router'
import { AnnouncementList } from '@/features/communications/components/announcement-list'
import { PageHeader } from '@/components/patterns/page-header'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/communications/')({
  component: OfficerCommunications,
})

function OfficerCommunications() {
  const { orgId } = Route.useParams()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communications"
        subtitle="Send announcements and messages to members"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgId}/officer/dashboard` },
          { label: 'Communications' },
        ]}
        actions={
          <Link
            to="/org/$orgId/officer/communications/new"
            params={{ orgId }}
            search={{ edit: undefined }}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-[8px] text-[14px] font-medium hover:bg-[var(--color-primary-mid)]"
          >
            New Message
          </Link>
        }
      />
      <AnnouncementList orgId={orgId} />
    </div>
  )
}
