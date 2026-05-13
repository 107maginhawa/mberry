import { createFileRoute } from '@tanstack/react-router'
import { DirectorySearch } from '@/features/directory/components/directory-search'
import { PageHeader } from '@/components/patterns/page-header'

export const Route = createFileRoute('/_authenticated/org/$orgId/members')({
  component: MembersDirectoryPage,
})

function MembersDirectoryPage() {
  const { orgId } = Route.useParams()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Member Directory"
        subtitle="Search and browse organization members"
        breadcrumbs={[
          { label: 'Organization', href: `/org/${orgId}/home` },
          { label: 'Members' },
        ]}
      />
      <DirectorySearch orgId={orgId} tenantId={orgId} />
    </div>
  )
}
