import { createFileRoute } from '@tanstack/react-router'
import { DuesConfigForm } from '@/features/dues/components/dues-config-form'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/settings/dues')({
  component: DuesSettingsPage,
})

function DuesSettingsPage() {
  const { orgId } = Route.useParams()

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dues Configuration</h1>
      <DuesConfigForm orgId={orgId} />
    </div>
  )
}
