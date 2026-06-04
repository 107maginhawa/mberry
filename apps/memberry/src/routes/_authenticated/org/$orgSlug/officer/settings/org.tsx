import { createFileRoute } from '@tanstack/react-router'
import { OrgSettingsForm } from '@/features/admin/components/org-settings-form'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/settings/org')({
  component: OrgSettingsPage,
})

function OrgSettingsPage() {
  const { orgId, orgSlug } = useOrg()
  return (
    <PageShell
      title="Organization Settings"
      subtitle="Configure your organization profile"
      breadcrumbs={[
        { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
        { label: 'Settings' },
        { label: 'Organization' },
      ]}
    >
      <GlassCard className="p-6">
        <OrgSettingsForm orgId={orgId} />
      </GlassCard>
    </PageShell>
  )
}
