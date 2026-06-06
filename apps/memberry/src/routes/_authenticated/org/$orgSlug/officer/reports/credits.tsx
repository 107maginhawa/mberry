import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState } from 'react'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { CountUp } from '@/components/motion/count-up'
import { StaggerGrid, StaggerItem } from '@/components/motion/stagger-grid'
import { EmptyState } from '@/components/patterns/empty-state'
import { TableSkeleton, CardSkeleton } from '@/components/patterns/skeleton-loader'
import { Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@monobase/ui'
import { useOrg } from '@/hooks/use-org'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/reports/credits')({
  component: CreditReport,
})

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  compliant: { label: 'Compliant', className: 'bg-[var(--color-success-bg)] text-[var(--color-success)]' },
  at_risk: { label: 'At Risk', className: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' },
  non_compliant: { label: 'Non-Compliant', className: 'bg-[var(--color-error-bg)] text-[var(--color-error)]' },
}

function CreditReport() {
  const { orgId, orgSlug } = useOrg()
  const [filter, setFilter] = useState<string>('all')

  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ['credit-compliance', orgId],
    queryFn: () => api.get(`/api/credit-compliance/${orgId}?requiredCredits=45&cyclePeriodYears=3`),
  })

  const summary = data?.summary ?? { compliant: 0, atRisk: 0, nonCompliant: 0, total: 0, requiredCredits: 45 }
  const allMembers: any[] = data?.data ?? []
  const members = filter === 'all' ? allMembers : allMembers.filter((m: any) => m.compliance_status === filter)

  const creditsBreadcrumbs = [
    { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
    { label: 'Reports' },
    { label: 'Credits' },
  ]

  if (isLoading) {
    return (
      <PageShell title="Credit Compliance Report" breadcrumbs={creditsBreadcrumbs}>
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
          </div>
          <TableSkeleton />
        </div>
      </PageShell>
    )
  }

  if (isError) {
    return (
      <PageShell title="Credit Compliance Report" breadcrumbs={creditsBreadcrumbs}>
        <div role="alert" className="p-4 rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">
          Unable to load credit compliance report. Please try refreshing the page.
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Credit Compliance Report"
      subtitle={`Member CPD credit status — ${summary.requiredCredits} credits required per cycle`}
      breadcrumbs={creditsBreadcrumbs}
    >
      <div className="space-y-6">
      {/* Summary cards */}
      <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StaggerItem>
          <GlassCard className="p-2">
            <Button variant="ghost" onClick={() => setFilter('all')} className={`w-full text-left p-2 h-auto flex-col items-start ${filter === 'all' ? 'ring-2 ring-[var(--color-primary)]' : ''}`}>
              <p className="text-sm text-[var(--color-muted)]">Total Tracked</p>
              <p className="text-[26px] font-display font-bold"><CountUp value={summary.total} /></p>
            </Button>
          </GlassCard>
        </StaggerItem>
        <StaggerItem>
          <GlassCard className="p-2">
            <Button variant="ghost" onClick={() => setFilter('compliant')} className={`w-full text-left p-2 h-auto flex-col items-start ${filter === 'compliant' ? 'ring-2 ring-[var(--color-success)]' : ''}`}>
              <p className="text-sm text-[var(--color-muted)]">Compliant</p>
              <p className="text-[26px] font-display font-bold text-[var(--color-success)]"><CountUp value={summary.compliant} /></p>
            </Button>
          </GlassCard>
        </StaggerItem>
        <StaggerItem>
          <GlassCard className="p-2">
            <Button variant="ghost" onClick={() => setFilter('at_risk')} className={`w-full text-left p-2 h-auto flex-col items-start ${filter === 'at_risk' ? 'ring-2 ring-[var(--color-warning)]' : ''}`}>
              <p className="text-sm text-[var(--color-muted)]">At Risk</p>
              <p className="text-[26px] font-display font-bold text-[var(--color-warning)]"><CountUp value={summary.atRisk} /></p>
            </Button>
          </GlassCard>
        </StaggerItem>
        <StaggerItem>
          <GlassCard className="p-2">
            <Button variant="ghost" onClick={() => setFilter('non_compliant')} className={`w-full text-left p-2 h-auto flex-col items-start ${filter === 'non_compliant' ? 'ring-2 ring-[var(--color-error)]' : ''}`}>
              <p className="text-sm text-[var(--color-muted)]">Non-Compliant</p>
              <p className="text-[26px] font-display font-bold text-[var(--color-error)]"><CountUp value={summary.nonCompliant} /></p>
            </Button>
          </GlassCard>
        </StaggerItem>
      </StaggerGrid>

      {/* PRC note */}
      <p className="text-xs text-muted-foreground">
        PRC CPD Compliance: 45 units required per 3-year cycle (General + Major + Self-Directed)
      </p>

      {/* Table */}
      <GlassCard>
        <Table className="text-sm">
          <TableHeader className="bg-[var(--color-surface-warm)]">
            <TableRow>
              <TableHead className="p-3 font-display">Member</TableHead>
              <TableHead className="p-3 font-display">ID</TableHead>
              <TableHead className="p-3 text-right font-display">Earned</TableHead>
              <TableHead className="p-3 text-right font-display text-muted-foreground">General</TableHead>
              <TableHead className="p-3 text-right font-display text-muted-foreground">Major</TableHead>
              <TableHead className="p-3 text-right font-display text-muted-foreground">Self-Directed</TableHead>
              <TableHead className="p-3 text-right font-display">Required</TableHead>
              <TableHead className="p-3 text-right font-display">Remaining</TableHead>
              <TableHead className="p-3 font-display">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow className="border-t">
                <TableCell colSpan={9} className="p-8">
                  <EmptyState headline="No members found" description="No members match this filter." />
                </TableCell>
              </TableRow>
            ) : (
              members.map((m: any) => {
                const badge = STATUS_BADGE[m.compliance_status] ?? { label: 'Unknown', className: 'bg-muted text-muted-foreground' }
                const pct = m.required > 0 ? Math.min(100, Math.round((m.earned / m.required) * 100)) : 0
                return (
                  <TableRow key={m.person_id} className="border-t hover:bg-[var(--color-surface-warm)]">
                    <TableCell className="p-3 font-medium">
                      {[m.first_name, m.last_name].filter(Boolean).join(' ') || 'Unknown'}
                    </TableCell>
                    <TableCell className="p-3 text-[var(--color-muted)]">{m.member_number ?? '—'}</TableCell>
                    <TableCell className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-[var(--color-surface-warm)] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 100 ? 'bg-[var(--color-success)]' : pct >= 50 ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-error)]'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span>{m.earned}</span>
                      </div>
                    </TableCell>
                    <TableCell className="p-3 text-right text-sm text-muted-foreground">{m.byCategory?.General ?? 0}</TableCell>
                    <TableCell className="p-3 text-right text-sm text-muted-foreground">{m.byCategory?.Major ?? 0}</TableCell>
                    <TableCell className="p-3 text-right text-sm text-muted-foreground">{m.byCategory?.['Self-Directed'] ?? 0}</TableCell>
                    <TableCell className="p-3 text-right text-[var(--color-muted)]">{m.required}</TableCell>
                    <TableCell className="p-3 text-right">{m.remaining}</TableCell>
                    <TableCell className="p-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </GlassCard>

      {members.length > 0 && (
        <p className="text-xs text-[var(--color-muted)]">
          Showing {members.length} of {allMembers.length} members
          {filter !== 'all' && ` (filtered: ${STATUS_BADGE[filter]?.label ?? filter})`}
        </p>
      )}
      </div>
    </PageShell>
  )
}
