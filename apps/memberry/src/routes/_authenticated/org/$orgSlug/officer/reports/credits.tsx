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
import { Download } from 'lucide-react'
import { useOrg } from '@/hooks/use-org'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/reports/credits')({
  component: CreditReport,
})

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  compliant: { label: 'Compliant', className: 'bg-[var(--color-success-bg)] text-[var(--color-success)]' },
  at_risk: { label: 'At Risk', className: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' },
  non_compliant: { label: 'Non-Compliant', className: 'bg-[var(--color-error-bg)] text-[var(--color-error)]' },
}

export interface ComplianceRow {
  person_id?: string
  first_name?: string
  last_name?: string
  member_number?: string
  earned?: number
  byCategory?: Record<string, number>
  required?: number
  remaining?: number
  compliance_status?: string
}

/**
 * FIX-012 (10.7): build a regulator-facing CSV from the compliance standings
 * already loaded on the page. Pure transform (rows → CSV text) so it is
 * testable and the download handler stays a thin wrapper.
 */
export function buildComplianceCsv(rows: ComplianceRow[]): string {
  const header = [
    'Member',
    'ID',
    'Earned',
    'General',
    'Major',
    'Self-Directed',
    'Required',
    'Remaining',
    'Status',
  ]
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v)
    // Quote fields containing commas, quotes, or newlines (RFC 4180).
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = rows.map((m) => {
    const name = [m.first_name, m.last_name].filter(Boolean).join(' ') || 'Unknown'
    const cat = m.byCategory ?? {}
    return [
      name,
      m.member_number ?? '',
      m.earned ?? 0,
      cat.General ?? 0,
      cat.Major ?? 0,
      cat['Self-Directed'] ?? 0,
      m.required ?? 0,
      m.remaining ?? 0,
      m.compliance_status ?? '',
    ]
      .map(escape)
      .join(',')
  })
  return [header.join(','), ...lines].join('\n') + '\n'
}

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function CreditReport() {
  const { orgId, orgSlug } = useOrg()
  const [filter, setFilter] = useState<string>('all')

  // FIX-006: required credits + cycle are resolved server-side from the org's
  // CPD config (org_cpd_config). Do NOT send a client requiredCredits override
  // — it is ignored by the server and previously produced a verdict that
  // disagreed with Settings → CPD.
  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ['credit-compliance', orgId],
    queryFn: () => api.get(`/api/credit-compliance/${orgId}`),
  })

  const summary = data?.summary ?? { compliant: 0, atRisk: 0, nonCompliant: 0, total: 0, requiredCredits: 0 }
  const allMembers: any[] = data?.data ?? []
  const members = filter === 'all' ? allMembers : allMembers.filter((m: any) => m.compliance_status === filter)

  // FIX-012 (10.7): export the currently-filtered standings to a regulator-
  // facing CSV. Client-side — the rows are already loaded, no extra request.
  const handleExport = () => {
    const csv = buildComplianceCsv(members as ComplianceRow[])
    const date = new Date().toISOString().slice(0, 10)
    downloadCsv(`credit-compliance-${orgSlug}-${date}.csv`, csv)
  }

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
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={members.length === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      }
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

      {/* PRC note — requirement reflects the org's CPD config (FIX-006) */}
      <p className="text-xs text-muted-foreground">
        PRC CPD Compliance: {summary.requiredCredits} units required per cycle (General + Major + Self-Directed)
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
