import { createFileRoute } from '@tanstack/react-router'
import { ApplicationList } from '@/features/membership/components/application-list'
import { PageHeader } from '@/components/patterns/page-header'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/applications')({
  component: ApplicationsPage,
})

function ApplicationsPage() {
  const { orgId } = Route.useParams()
  return (
    <div className="space-y-6">
      <PageHeader
        title="Membership Applications"
        subtitle="Review and process membership requests"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgId}/officer/dashboard` },
          { label: 'Applications' },
        ]}
      />
      <ApplicationList orgId={orgId} />
    </div>
  )
}
