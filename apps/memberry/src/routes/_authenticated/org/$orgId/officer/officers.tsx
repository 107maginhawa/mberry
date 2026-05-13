import { createFileRoute } from '@tanstack/react-router'
import { OfficerManagement } from '@/features/admin/components/officer-management'
import { PageHeader } from '@/components/patterns/page-header'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/officers')({
  component: OfficersPage,
})

function OfficersPage() {
  const { orgId } = Route.useParams()
  return (
    <div className="space-y-6">
      <PageHeader
        title="Officer Management"
        subtitle="Manage organization officer roles"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgId}/officer/dashboard` },
          { label: 'Officers' },
        ]}
      />
      <OfficerManagement orgId={orgId} />
    </div>
  )
}
