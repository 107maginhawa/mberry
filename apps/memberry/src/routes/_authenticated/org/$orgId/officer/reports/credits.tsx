import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState } from 'react'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { CountUp } from '@/components/motion/count-up'
import { StaggerGrid, StaggerItem } from '@/components/motion/stagger-grid'
import { EmptyState } from '@/components/patterns/empty-state'
import { TableSkeleton, CardSkeleton } from '@/components/patterns/skeleton-loader'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/reports/credits')({
  component: CreditReport,
})

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  compliant: { label: 'Compliant', className: 'bg-green-100 text-green-800' },
  at_risk: { label: 'At Risk', className: 'bg-yellow-100 text-yellow-800' },
  non_compliant: { label: 'Non-Compliant', className: 'bg-red-100 text-red-800' },
}

function CreditReport() {
  const { orgId } = Route.useParams()
  const [filter, setFilter] = useState<string>('all')

  const { data, isLoading } = useQuery<any>({
    queryKey: ['credit-compliance', orgId],
    queryFn: () => api.get(`/api/credit-compliance/${orgId}`),
  })

  const summary = data?.summary ?? { compliant: 0, atRisk: 0, nonCompliant: 0, total: 0, requiredCredits: 40 }
  const allMembers: any[] = data?.data ?? []
  const members = filter === 'all' ? allMembers : allMembers.filter((m: any) => m.compliance_status === filter)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Credit Compliance Report"
          breadcrumbs={[
            { label: 'Officer', href: `/org/${orgId}/officer/dashboard` },
            { label: 'Reports' },
            { label: 'Credits' },
          ]}
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
        </div>
        <TableSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credit Compliance Report"
        subtitle={`Member CPD credit status — ${summary.requiredCredits} credits required per cycle`}
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgId}/officer/dashboard` },
          { label: 'Reports' },
          { label: 'Credits' },
        ]}
      />

      {/* Summary cards */}
      <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StaggerItem>
          <GlassCard className="p-4">
            <button onClick={() => setFilter('all')} className={`w-full text-left hover:bg-[var(--color-surface-warm)] rounded-lg ${filter === 'all' ? 'ring-2 ring-[var(--color-primary)]' : ''}`}>
              <p className="text-[14px] text-[var(--color-muted)]">Total Tracked</p>
              <p className="text-[26px] font-display font-bold"><CountUp value={summary.total} /></p>
            </button>
          </GlassCard>
        </StaggerItem>
        <StaggerItem>
          <GlassCard className="p-4">
            <button onClick={() => setFilter('compliant')} className={`w-full text-left hover:bg-[var(--color-surface-warm)] rounded-lg ${filter === 'compliant' ? 'ring-2 ring-green-500' : ''}`}>
              <p className="text-[14px] text-[var(--color-muted)]">Compliant</p>
              <p className="text-[26px] font-display font-bold text-green-600"><CountUp value={summary.compliant} /></p>
            </button>
          </GlassCard>
        </StaggerItem>
        <StaggerItem>
          <GlassCard className="p-4">
            <button onClick={() => setFilter('at_risk')} className={`w-full text-left hover:bg-[var(--color-surface-warm)] rounded-lg ${filter === 'at_risk' ? 'ring-2 ring-yellow-500' : ''}`}>
              <p className="text-[14px] text-[var(--color-muted)]">At Risk</p>
              <p className="text-[26px] font-display font-bold text-yellow-600"><CountUp value={summary.atRisk} /></p>
            </button>
          </GlassCard>
        </StaggerItem>
        <StaggerItem>
          <GlassCard className="p-4">
            <button onClick={() => setFilter('non_compliant')} className={`w-full text-left hover:bg-[var(--color-surface-warm)] rounded-lg ${filter === 'non_compliant' ? 'ring-2 ring-red-500' : ''}`}>
              <p className="text-[14px] text-[var(--color-muted)]">Non-Compliant</p>
              <p className="text-[26px] font-display font-bold text-red-600"><CountUp value={summary.nonCompliant} /></p>
            </button>
          </GlassCard>
        </StaggerItem>
      </StaggerGrid>

      {/* Table */}
      <GlassCard>
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead className="bg-[var(--color-surface-warm)]">
              <tr>
                <th className="text-left p-3 font-medium font-display">Member</th>
                <th className="text-left p-3 font-medium font-display">ID</th>
                <th className="text-right p-3 font-medium font-display">Earned</th>
                <th className="text-right p-3 font-medium font-display">Required</th>
                <th className="text-right p-3 font-medium font-display">Remaining</th>
                <th className="text-left p-3 font-medium font-display">Status</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr className="border-t">
                  <td colSpan={6} className="p-8">
                    <EmptyState headline="No members found" description="No members match this filter." />
                  </td>
                </tr>
              ) : (
                members.map((m: any) => {
                  const badge = STATUS_BADGE[m.compliance_status] ?? { label: 'Unknown', className: 'bg-gray-100 text-gray-800' }
                  const pct = m.required > 0 ? Math.min(100, Math.round((m.earned / m.required) * 100)) : 0
                  return (
                    <tr key={m.person_id} className="border-t hover:bg-[var(--color-surface-warm)]">
                      <td className="p-3 font-medium">
                        {[m.first_name, m.last_name].filter(Boolean).join(' ') || 'Unknown'}
                      </td>
                      <td className="p-3 text-[var(--color-muted)]">{m.member_number ?? '—'}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-[var(--color-surface-warm)] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span>{m.earned}</span>
                        </div>
                      </td>
                      <td className="p-3 text-right text-[var(--color-muted)]">{m.required}</td>
                      <td className="p-3 text-right">{m.remaining}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {members.length > 0 && (
        <p className="text-xs text-[var(--color-muted)]">
          Showing {members.length} of {allMembers.length} members
          {filter !== 'all' && ` (filtered: ${STATUS_BADGE[filter]?.label ?? filter})`}
        </p>
      )}
    </div>
  )
}
