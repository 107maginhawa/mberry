import { createFileRoute } from '@tanstack/react-router'
import { DuesConfigForm } from '@/features/dues/components/dues-config-form'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { useOrg } from '@/hooks/use-org'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/finances/dues')({
  component: DuesSchedulePage,
})

function DuesSchedulePage() {
  const { orgId, orgSlug } = useOrg()

  return (
    <PageShell
      title="Dues Schedule"
      subtitle="Configure dues rates and billing periods"
      breadcrumbs={[
        { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
        { label: 'Finances', href: `/org/${orgSlug}/officer/finances` },
        { label: 'Dues Schedule' },
      ]}
    >
      <GlassCard className="p-6">
        <DuesConfigForm orgId={orgId} />
      </GlassCard>
    </PageShell>
  )
}
