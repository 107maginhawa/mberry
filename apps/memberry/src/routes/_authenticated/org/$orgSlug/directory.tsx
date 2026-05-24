import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/patterns/page-header'
import { TrustDirectory } from '@/features/directory/components/trust-directory'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/directory')({
  component: DirectoryPage,
})

function DirectoryPage() {
  const { orgId, orgSlug } = useOrg()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Member Directory"
        subtitle="Search and discover organization members"
        breadcrumbs={[
          { label: 'Organization', href: `/org/${orgSlug}/home` },
          { label: 'Directory' },
        ]}
      />
      <TrustDirectory orgId={orgId} orgSlug={orgSlug} />
    </div>
  )
}
