import { createFileRoute } from '@tanstack/react-router'
import { ApplicationList } from '@/features/membership/components/application-list'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/applications')({
  component: ApplicationsPage,
})

function ApplicationsPage() {
  const { orgId } = Route.useParams()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Membership Applications</h1>
      </div>

      <ApplicationList orgId={orgId} tenantId={orgId} />
    </div>
  )
}
