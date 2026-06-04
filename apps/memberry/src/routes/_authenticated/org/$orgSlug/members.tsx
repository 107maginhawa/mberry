import { createFileRoute } from '@tanstack/react-router'
import { DirectorySearch } from '@/features/directory/components/directory-search'
import { PageShell } from '@/components/patterns/page-shell'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/members')({
  component: MembersDirectoryPage,
})

function MembersDirectoryPage() {
  const { orgId, orgSlug } = useOrg()

  return (
    <PageShell
      title="Member Directory"
      subtitle="Search and browse organization members"
      breadcrumbs={[
        { label: 'Organization', href: `/org/${orgSlug}/home` },
        { label: 'Members' },
      ]}
    >
      <div className="space-y-6">
        <DirectorySearch orgId={orgId} tenantId={orgId} />
      </div>
    </PageShell>
  )
}
