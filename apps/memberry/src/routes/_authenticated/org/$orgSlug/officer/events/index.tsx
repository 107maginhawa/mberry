import { createFileRoute, Link } from '@tanstack/react-router'
import { PageHeader } from '@/components/patterns/page-header'
import { EventList } from '@/features/events/components/event-list'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/events/')({
  component: OfficerEvents,
})

function OfficerEvents() {
  const { orgId, orgSlug } = useOrg()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        subtitle="Manage organization events and registrations"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Events' },
        ]}
        actions={
          <Link
            to="/org/$orgSlug/officer/events/new"
            params={{ orgSlug }}
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
