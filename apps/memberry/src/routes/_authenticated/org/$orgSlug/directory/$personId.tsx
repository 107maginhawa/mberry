import { createFileRoute } from '@tanstack/react-router'
import { PageShell } from '@/components/patterns/page-shell'
import { MemberProfile } from '@/features/directory/components/member-profile'
import { useOrg } from '@/hooks/use-org'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/directory/$personId')({
  component: MemberProfilePage,
})

function MemberProfilePage() {
  const { orgId, orgSlug } = useOrg()
  const { personId } = Route.useParams()

  return (
    <PageShell
      title="Member Profile"
      subtitle="View member details and credentials"
      breadcrumbs={[
        { label: 'Organization', href: `/org/${orgSlug}/home` },
        { label: 'Directory', href: `/org/${orgSlug}/directory` },
        { label: 'Profile' },
      ]}
    >
      <div className="space-y-6">
        <MemberProfile personId={personId} orgId={orgId} orgSlug={orgSlug} />
      </div>
    </PageShell>
  )
}
