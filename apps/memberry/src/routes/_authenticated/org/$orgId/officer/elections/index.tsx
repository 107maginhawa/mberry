import { createFileRoute, Link } from '@tanstack/react-router'
import { ElectionList } from '@/features/elections/components/election-list'
import { PageHeader } from '@/components/patterns/page-header'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/elections/')({
  component: OfficerElections,
})

function OfficerElections() {
  const { orgId } = Route.useParams()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Elections"
        subtitle="Manage officer elections and bylaw votes"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgId}/officer/dashboard` },
          { label: 'Elections' },
        ]}
        actions={
          <Link
            to="/org/$orgId/officer/elections/new"
            params={{ orgId }}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-[8px] text-[14px] font-medium hover:bg-[var(--color-primary-mid)]"
          >
            New Election
          </Link>
        }
      />

      <ElectionList orgId={orgId} />
    </div>
  )
}
