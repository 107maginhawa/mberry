import { createFileRoute } from '@tanstack/react-router'
import { OfficerDashboard } from '@/features/admin/components/officer-dashboard'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/dashboard')({
  component: OfficerDashboardPage,
})

function OfficerDashboardPage() {
  const { orgId } = Route.useParams()
  return <OfficerDashboard orgId={orgId} />
}
