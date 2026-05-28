import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { InstitutionalMembershipForm } from '@/features/membership/components/institutional-membership-form'
import { PageHeader } from '@/components/patterns/page-header'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/institutional-memberships/new')({
  component: NewInstitutionalMembershipPage,
})

function NewInstitutionalMembershipPage() {
  const { orgId, orgSlug } = useOrg()
  const navigate = useNavigate()

  function handleSuccess() {
    navigate({ to: '/org/$orgSlug/officer/institutional-memberships', params: { orgSlug } })
  }

  function handleCancel() {
    navigate({ to: '/org/$orgSlug/officer/institutional-memberships', params: { orgSlug } })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Institutional Membership"
        subtitle="Create a new organizational membership with seat allocation"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Institutions', href: `/org/${orgSlug}/officer/institutional-memberships` },
          { label: 'New' },
        ]}
      />
      <div className="max-w-2xl">
        <InstitutionalMembershipForm
          orgId={orgId}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </div>
    </div>
  )
}
