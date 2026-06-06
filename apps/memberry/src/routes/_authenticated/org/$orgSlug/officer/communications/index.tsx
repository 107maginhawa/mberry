import { createFileRoute, Link } from '@tanstack/react-router'
import { AnnouncementList } from '@/features/communications/components/announcement-list'
import { PageShell } from '@/components/patterns/page-shell'
import { useOrg } from '@/hooks/use-org'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/communications/')({
  component: OfficerCommunications,
})

function OfficerCommunications() {
  const { orgId, orgSlug } = useOrg()

  return (
    <PageShell
      title="Communications"
      subtitle="Send announcements and messages to members"
      breadcrumbs={[
        { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
        { label: 'Communications' },
      ]}
      actions={
        <Link
          to="/org/$orgSlug/officer/communications/new"
          params={{ orgSlug }}
          search={{ edit: undefined }}
          className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-[8px] text-sm font-medium hover:bg-[var(--color-primary-mid)]"
        >
          New Message
        </Link>
      }
    >
      <AnnouncementList orgId={orgId} />
    </PageShell>
  )
}
