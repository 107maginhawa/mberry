import { createFileRoute, Link } from '@tanstack/react-router'
import { ElectionList } from '@/features/elections/components/election-list'
import { PageShell } from '@/components/patterns/page-shell'
import { useOrg } from '@/hooks/use-org'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/elections/')({
  component: OfficerElections,
})

function OfficerElections() {
  const { orgId, orgSlug } = useOrg()

  return (
    <PageShell
      title="Elections"
      subtitle="Manage officer elections and bylaw votes"
      breadcrumbs={[
        { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
        { label: 'Elections' },
      ]}
      actions={
        <Link
          to="/org/$orgSlug/officer/elections/new"
          params={{ orgSlug }}
          className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-sm text-sm font-medium hover:bg-[var(--color-primary-mid)]"
        >
          New Election
        </Link>
      }
    >
      <ElectionList orgId={orgId} />
    </PageShell>
  )
}
