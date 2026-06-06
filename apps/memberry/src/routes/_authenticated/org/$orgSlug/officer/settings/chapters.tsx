import { createFileRoute } from '@tanstack/react-router'
import { AffiliationList } from '@/features/chapters/components/affiliation-list'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { useOrg } from '@/hooks/use-org'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/settings/chapters')({
  component: ChaptersSettingsPage,
})

function ChaptersSettingsPage() {
  const { orgId, orgSlug } = useOrg()

  return (
    <PageShell
      title="Chapter Affiliations"
      subtitle="Manage chapter relationships"
      breadcrumbs={[
        { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
        { label: 'Settings' },
        { label: 'Chapters' },
      ]}
    >
      <GlassCard className="p-6">
        <AffiliationList orgId={orgId} tenantId={orgId} />
      </GlassCard>
    </PageShell>
  )
}
