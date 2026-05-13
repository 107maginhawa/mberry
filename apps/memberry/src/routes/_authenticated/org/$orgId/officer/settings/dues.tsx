import { createFileRoute } from '@tanstack/react-router'
import { DuesConfigForm } from '@/features/dues/components/dues-config-form'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/settings/dues')({
  component: DuesSettingsPage,
})

function DuesSettingsPage() {
  const { orgId } = Route.useParams()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dues Configuration"
        subtitle="Set up dues rates and billing"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgId}/officer/dashboard` },
          { label: 'Settings' },
          { label: 'Dues' },
        ]}
      />
      <GlassCard className="p-6">
        <DuesConfigForm orgId={orgId} />
      </GlassCard>
    </div>
  )
}
