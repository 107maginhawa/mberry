import { createFileRoute } from '@tanstack/react-router'
import { OrgSettingsForm } from '@/features/admin/components/org-settings-form'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/settings/org')({
  component: OrgSettingsPage,
})

function OrgSettingsPage() {
  const { orgId } = Route.useParams()
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Organization Settings</h1>
      <OrgSettingsForm orgId={orgId} />
    </div>
  )
}
