import { createFileRoute } from '@tanstack/react-router'
import { OfficerManagement } from '@/features/admin/components/officer-management'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/officers')({
  component: OfficersPage,
})

function OfficersPage() {
  const { orgId } = Route.useParams()
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Officer Management</h1>
      <OfficerManagement orgId={orgId} />
    </div>
  )
}
