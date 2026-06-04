import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { InstitutionalMembershipForm } from '@/features/membership/components/institutional-membership-form'
import { PageShell } from '@/components/patterns/page-shell'
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
    <PageShell
      title="New Institutional Membership"
      subtitle="Create a new organizational membership with seat allocation"
      breadcrumbs={[
        { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
        { label: 'Institutions', href: `/org/${orgSlug}/officer/institutional-memberships` },
        { label: 'New' },
      ]}
    >
      <div className="max-w-2xl">
        <InstitutionalMembershipForm
          orgId={orgId}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </div>
    </PageShell>
  )
}
