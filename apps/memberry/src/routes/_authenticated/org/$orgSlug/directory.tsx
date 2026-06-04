import { createFileRoute } from '@tanstack/react-router'
import { PageShell } from '@/components/patterns/page-shell'
import { TrustDirectory } from '@/features/directory/components/trust-directory'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/directory')({
  component: DirectoryPage,
})

function DirectoryPage() {
  const { orgId, orgSlug } = useOrg()

  return (
    <PageShell
      title="Member Directory"
      subtitle="Search and discover organization members"
      breadcrumbs={[
        { label: 'Organization', href: `/org/${orgSlug}/home` },
        { label: 'Directory' },
      ]}
      maxWidth="wide"
    >
      <TrustDirectory orgId={orgId} orgSlug={orgSlug} />
    </PageShell>
  )
}
