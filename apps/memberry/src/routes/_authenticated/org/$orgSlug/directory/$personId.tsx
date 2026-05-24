import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/patterns/page-header'
import { MemberProfile } from '@/features/directory/components/member-profile'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/directory/$personId')({
  component: MemberProfilePage,
})

function MemberProfilePage() {
  const { orgId, orgSlug } = useOrg()
  const { personId } = Route.useParams()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Member Profile"
        subtitle="View member details and credentials"
        breadcrumbs={[
          { label: 'Organization', href: `/org/${orgSlug}/home` },
          { label: 'Directory', href: `/org/${orgSlug}/directory` },
          { label: 'Profile' },
        ]}
      />
      <MemberProfile personId={personId} orgId={orgId} orgSlug={orgSlug} />
    </div>
  )
}
