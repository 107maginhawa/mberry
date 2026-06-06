import { createFileRoute } from '@tanstack/react-router'
import { OfficerManagement } from '@/features/admin/components/officer-management'
import { PageShell } from '@/components/patterns/page-shell'
import { useOrg } from '@/hooks/use-org'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/officers')({
  component: OfficersPage,
})

function OfficersPage() {
  const { orgId, orgSlug } = useOrg()
  return (
    <PageShell
      title="Officer Management"
      subtitle="Manage organization officer roles"
      breadcrumbs={[
        { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
        { label: 'Officers' },
      ]}
    >
      <OfficerManagement orgId={orgId} />
    </PageShell>
  )
}
