import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Award, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { CardSkeleton } from '@/components/patterns/skeleton-loader'
import { useOrg } from '@/hooks/use-org'
import { api } from '@/lib/api'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/my-cpd')({
  component: MyCpdDashboard,
})

function MyCpdDashboard() {
  const { orgId, orgSlug } = useOrg()

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-credits', orgId],
    queryFn: () => api.get(`/api/persons/me/credits`),
    enabled: !!orgId,
  })

  const credits = (data as any)?.data

  if (isLoading) {
    return (
      <PageShell title="My CPD Credits" subtitle="Track your continuing professional development">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell title="My CPD Credits" subtitle="Track your continuing professional development">
        <div className="space-y-6">
          <div role="alert" className="p-4 rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">
            Unable to load your CPD credits. Please try refreshing the page.
          </div>
        </div>
      </PageShell>
    )
  }

  const compliancePercent = credits?.compliancePercent ?? 0
  const statusColor = compliancePercent >= 100 ? 'text-green-600' : compliancePercent >= 60 ? 'text-amber-600' : 'text-red-600'
  const StatusIcon = compliancePercent >= 100 ? CheckCircle : compliancePercent >= 60 ? TrendingUp : AlertTriangle

  return (
    <PageShell title="My CPD Credits" subtitle="Track your continuing professional development">
      <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-muted)]">Total Credits</p>
              <p className="text-2xl font-bold">{credits?.totalCredits ?? 0}</p>
              <p className="text-xs text-[var(--color-muted)]">of {credits?.requiredCredits ?? 60} required</p>
            </div>
            <Award className="w-8 h-8 text-[var(--color-primary)]" />
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-muted)]">Compliance</p>
              <p className={`text-2xl font-bold ${statusColor}`}>{compliancePercent}%</p>
            </div>
            <StatusIcon className={`w-8 h-8 ${statusColor}`} />
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div>
            <p className="text-sm text-[var(--color-muted)]">Category Breakdown</p>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between"><span>General</span><span className="font-medium">{credits?.categoryBreakdown?.general ?? 0}</span></div>
              <div className="flex justify-between"><span>Major</span><span className="font-medium">{credits?.categoryBreakdown?.major ?? 0}</span></div>
              <div className="flex justify-between">
                <span>Self-Directed</span>
                <span className={`font-medium ${credits?.sdlCap?.exceeded ? 'text-red-600' : ''}`}>
                  {credits?.categoryBreakdown?.selfDirected ?? 0}{credits?.sdlCap ? `/${credits.sdlCap.max}` : ''}
                </span>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {credits?.sdlCap?.exceeded && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 inline mr-1" />
            Self-Directed Learning cap exceeded. Additional SDL credits may not count toward compliance.
          </p>
        </div>
      )}

      <GlassCard className="p-5">
        <h3 className="font-semibold mb-4">Credit History</h3>
        {credits?.history?.length > 0 ? (
          <div className="divide-y divide-[var(--color-border)]">
            {credits.history.map((entry: any) => (
              <div key={entry.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{entry.activityName}</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {entry.activityDate ? new Date(entry.activityDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '--'}
                    {entry.category && ` | ${entry.category}`}
                    {entry.sourceType && ` | ${entry.sourceType.replace('_', ' ')}`}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 text-xs font-medium">
                  <Award className="w-3 h-3" />
                  {entry.creditAmount} CPE
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">No credit entries yet. Attend training or events to earn credits.</p>
        )}
      </GlassCard>

      <div className="flex gap-3">
        <Link to={'/org/$orgSlug/training' as any} params={{ orgSlug } as any} className="text-sm text-[var(--color-primary)] hover:underline">
          Browse Training
        </Link>
        <Link to={'/org/$orgSlug/events' as any} params={{ orgSlug } as any} className="text-sm text-[var(--color-primary)] hover:underline">
          Browse Events
        </Link>
      </div>
      </div>
    </PageShell>
  )
}
