import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { useOrg } from '@/hooks/useOrg'
import { TrendingUp, FileText, Users } from 'lucide-react'
import { Link } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/finances/')({
  component: FinancesOverviewPage,
})

function FinancesOverviewPage() {
  const { orgSlug } = useOrg()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finances Overview"
        subtitle="Collection metrics, trends, and recent activity"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Finances' },
        ]}
      />

      {/* Metric cards, area chart, and activity feed will be built in Phase 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-[var(--color-muted)]">Collection Rate</span>
          </div>
          <p className="text-2xl font-semibold">—</p>
          <p className="text-xs text-[var(--color-muted)] mt-1">vs last quarter</p>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-[var(--color-muted)]">Collected This Period</span>
          </div>
          <p className="text-2xl font-semibold">—</p>
          <p className="text-xs text-[var(--color-muted)] mt-1">vs last quarter</p>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-amber-600" />
            </div>
            <span className="text-sm font-medium text-[var(--color-muted)]">Outstanding Balance</span>
          </div>
          <p className="text-2xl font-semibold">—</p>
          <p className="text-xs text-[var(--color-muted)] mt-1">vs last quarter</p>
        </GlassCard>
      </div>

      <GlassCard className="p-5">
        <h2 className="text-h4 mb-4">Collections Over Time</h2>
        <div className="h-48 flex items-center justify-center text-[var(--color-muted)] text-sm">
          Area chart will be wired in Phase 2
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-h4">Recent Activity</h2>
          <Link
            to="/org/$orgSlug/officer/payments"
            params={{ orgSlug }}
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            View All Payments →
          </Link>
        </div>
        <div className="h-32 flex items-center justify-center text-[var(--color-muted)] text-sm">
          Activity feed will be wired in Phase 2
        </div>
      </GlassCard>
    </div>
  )
}
