import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageShell } from '@/components/patterns/page-shell'
import { EmptyState } from '@/components/patterns/empty-state'
import { CardSkeleton, TableSkeleton } from '@/components/patterns/skeleton-loader'
import { GlassCard } from '@/components/motion/glass-card'
import { CountUp } from '@/components/motion/count-up'
import { StaggerGrid, StaggerItem } from '@/components/motion/stagger-grid'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@monobase/ui'
import { Award } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/my/credits/')({
  component: MyCredits,
})

interface CreditEntry {
  id: string
  activityName: string
  organizationId: string
  activityDate: string
  type: string
  creditAmount: number
}

interface CreditSummary {
  totalCredits: number
  requiredCredits?: number
  remaining?: number
}

function MyCredits() {
  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useQuery({
    queryKey: ['credit-summary'],
    queryFn: () => api.get<CreditSummary>('/api/persons/me/credit-summary'),
  })

  const { data: entriesResp, isLoading: entriesLoading, isError: entriesError } = useQuery({
    queryKey: ['credit-entries'],
    queryFn: () => api.get<{ data: CreditEntry[] }>('/api/persons/me/credit-entries'),
  })

  const totalCredits = summary?.totalCredits || 0
  const requiredCredits = summary?.requiredCredits || 60
  const remainingCredits = summary?.remaining ?? Math.max(0, requiredCredits - totalCredits)
  const entries = entriesResp?.data || []
  const navigate = useNavigate()
  const loading = summaryLoading || entriesLoading
  const hasError = summaryError || entriesError

  if (hasError && !loading) {
    return (
      <PageShell title="CPD Credits" subtitle="Your professional development credit summary across all organizations">
        <div className="space-y-6">
          <div role="alert" className="p-4 rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">
            Unable to load credit data. Please try refreshing the page.
          </div>
        </div>
      </PageShell>
    )
  }

  if (loading) {
    return (
      <PageShell title="CPD Credits" subtitle="Your professional development credit summary across all organizations">
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <TableSkeleton rows={4} cols={4} />
        </div>
      </PageShell>
    )
  }

  const stats = [
    { label: 'Earned', value: totalCredits, highlight: true },
    { label: 'Required', value: requiredCredits, highlight: false },
    { label: 'Carryover', value: 0, highlight: false },
    { label: 'Remaining', value: remainingCredits, highlight: false },
  ]

  return (
    <PageShell
      title="CPD Credits"
      subtitle="Your professional development credit summary across all organizations"
      actions={
        <Link
          to="/my/credits/log"
          className="px-[16px] py-[8px] rounded-[8px] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-mid)] transition-colors"
        >
          Log Manual Credit
        </Link>
      }
    >
      <div className="space-y-6">
      <StaggerGrid className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <StaggerItem key={s.label}>
            <GlassCard className="p-4">
              <p className="text-sm text-[var(--color-muted)]">{s.label}</p>
              <p className={`text-2xl font-bold font-display ${s.highlight ? 'text-[var(--color-primary)]' : ''}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                <CountUp value={s.value} />
              </p>
            </GlassCard>
          </StaggerItem>
        ))}
      </StaggerGrid>

      <div className="flex justify-between items-center">
        <h2 className="text-h4">Credit Log</h2>
      </div>

      {entries.length === 0 ? (
        // ui-c-exempt: empty-state-emphasis — no-credits EmptyState
        <EmptyState
          icon={<Award size={32} />}
          headline="No credits earned yet"
          description="Attend training sessions to earn credits automatically, or log manual credits from external activities."
          action={{ label: 'Log Manual Credit', onClick: () => navigate({ to: '/my/credits/log' }) }}
        />
      ) : (
        <GlassCard className="overflow-hidden">
          <Table className="text-sm min-w-[500px]">
            <TableHeader className="bg-[var(--color-surface-warm)]">
              <TableRow>
                <TableHead className="px-4 py-3 font-semibold text-xs uppercase tracking-wide">Activity</TableHead>
                <TableHead className="px-4 py-3 font-semibold text-xs uppercase tracking-wide">Date</TableHead>
                <TableHead className="px-4 py-3 font-semibold text-xs uppercase tracking-wide">Type</TableHead>
                <TableHead className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Credits</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id} className="border-t border-[var(--color-border-light)]">
                  <TableCell className="px-4 py-3 font-medium">{e.activityName || 'Training'}</TableCell>
                  <TableCell className="px-4 py-3 text-[var(--color-muted)]">
                    {e.activityDate ? new Date(e.activityDate).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell className="px-4 py-3 capitalize">{e.type || 'auto'}</TableCell>
                  <TableCell className="px-4 py-3 text-right font-semibold text-[var(--color-primary)]">{e.creditAmount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GlassCard>
      )}
      </div>
    </PageShell>
  )
}
