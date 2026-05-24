import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/finances/members')({
  component: FinancialMembersPage,
})

function FinancialMembersPage() {
  const { orgSlug } = useOrg()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        subtitle="Financial view of all members"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Finances', href: `/org/${orgSlug}/officer/finances` },
          { label: 'Members' },
        ]}
      />

      {/* Filter bar and members table will be built in Phase 4 */}
      <GlassCard className="p-5">
        <div className="flex gap-2 mb-4">
          <span className="text-sm text-[var(--color-muted)]">+ Add filter</span>
        </div>
        <div className="h-64 flex items-center justify-center text-[var(--color-muted)] text-sm">
          Members financial table with filter bar, balances, and click-to-detail will be built in Phase 4
        </div>
      </GlassCard>
    </div>
  )
}
