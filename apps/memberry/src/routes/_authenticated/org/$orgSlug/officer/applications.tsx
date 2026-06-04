import { createFileRoute } from '@tanstack/react-router'
import { ApplicationList } from '@/features/membership/components/application-list'
import { PageShell } from '@/components/patterns/page-shell'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/applications')({
  component: ApplicationsPage,
})

function ApplicationsPage() {
  const { orgId, orgSlug } = useOrg()
  return (
    <PageShell
      title="Membership Applications"
      subtitle="Review and process membership requests"
      breadcrumbs={[
        { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
        { label: 'Applications' },
      ]}
    >
      <ApplicationList orgId={orgId} />
    </PageShell>
  )
}
