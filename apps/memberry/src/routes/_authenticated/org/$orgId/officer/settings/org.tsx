import { createFileRoute } from '@tanstack/react-router'
import { OrgSettingsForm } from '@/features/admin/components/org-settings-form'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/settings/org')({
  component: OrgSettingsPage,
})

function OrgSettingsPage() {
  const { orgId } = Route.useParams()
  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization Settings"
        subtitle="Configure your organization profile"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgId}/officer/dashboard` },
          { label: 'Settings' },
          { label: 'Organization' },
        ]}
      />
      <GlassCard className="p-6">
        <OrgSettingsForm orgId={orgId} />
      </GlassCard>
    </div>
  )
}
