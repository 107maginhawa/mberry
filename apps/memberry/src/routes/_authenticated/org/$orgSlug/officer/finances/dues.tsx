import { createFileRoute } from '@tanstack/react-router'
import { DuesConfigForm } from '@/features/dues/components/dues-config-form'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/finances/dues')({
  component: DuesSchedulePage,
})

function DuesSchedulePage() {
  const { orgId, orgSlug } = useOrg()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dues Schedule"
        subtitle="Configure dues rates and billing periods"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Finances', href: `/org/${orgSlug}/officer/finances` },
          { label: 'Dues Schedule' },
        ]}
      />
      <GlassCard className="p-6">
        <DuesConfigForm orgId={orgId} />
      </GlassCard>
    </div>
  )
}
