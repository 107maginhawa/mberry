import { createFileRoute, Link } from '@tanstack/react-router'
import { PageHeader } from '@/components/patterns/page-header'
import { EventList } from '@/features/events/components/event-list'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/events/')({
  component: OfficerEvents,
})

function OfficerEvents() {
  const { orgId } = Route.useParams()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        subtitle="Manage organization events and registrations"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgId}/officer/dashboard` },
          { label: 'Events' },
        ]}
        actions={
          <Link
            to="/org/$orgId/officer/events/new"
            params={{ orgId }}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-[8px] text-[14px] font-medium hover:bg-[var(--color-primary-mid)]"
          >
            Create Event
          </Link>
        }
      />

      <EventList orgId={orgId} />
    </div>
  )
}
