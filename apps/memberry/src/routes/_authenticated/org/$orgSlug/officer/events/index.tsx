import { createFileRoute, Link } from '@tanstack/react-router'
import { PageShell } from '@/components/patterns/page-shell'
import { EventList } from '@/features/events/components/event-list'
import { useOrg } from '@/hooks/use-org'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/events/')({
  component: OfficerEvents,
})

function OfficerEvents() {
  const { orgId, orgSlug } = useOrg()

  return (
    <PageShell
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
          className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-sm text-sm font-medium hover:bg-[var(--color-primary-mid)]"
        >
          Create Event
        </Link>
      }
    >
      <EventList orgId={orgId} />
    </PageShell>
  )
}
