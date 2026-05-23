import { createFileRoute } from '@tanstack/react-router'
import { DuesConfigForm } from '@/features/dues/components/dues-config-form'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/settings/dues')({
  component: DuesSettingsPage,
})

function DuesSettingsPage() {
  const { orgId, orgSlug } = useOrg()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dues Configuration"
        subtitle="Set up dues rates and billing"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
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
