import { createFileRoute } from '@tanstack/react-router'
import { ApplicationList } from '@/features/membership/components/application-list'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/applications')({
  component: ApplicationsPage,
})

function ApplicationsPage() {
  const { orgId } = Route.useParams()
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Membership Applications</h1>
      <ApplicationList orgId={orgId} />
    </div>
  )
}
