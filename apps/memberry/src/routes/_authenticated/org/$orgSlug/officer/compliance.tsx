import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Users, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { CardSkeleton } from '@/components/patterns/skeleton-loader'
import { ErrorState } from '@/components/patterns/error-state'
import { useOrg } from '@/hooks/use-org'
import { api } from '@/lib/api'
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { useState } from 'react'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/compliance')({
  component: OfficerCompliance,
})

function OfficerCompliance() {
  const { orgId } = useOrg()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['compliance-report', orgId, statusFilter],
    queryFn: () => api.get(`/api/association/member/compliance/${orgId}${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`),
    enabled: !!orgId,
  })

  const refreshMutation = useMutation({
    mutationFn: () => api.post(`/api/association/member/compliance/${orgId}/refresh`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-report'] })
      toast.success('Compliance report refreshed')
    },
    onError: (err: any) => {
      toast.error(err?.message ?? 'Failed to refresh compliance report')
    },
  })

  const report = (data as any)?.data

  if (isError) {
    return (
      <div className="p-6 max-w-2xl">
        <ErrorState message="Could not load compliance report" onRetry={() => refetch()} />
      </div>
    )
  }

  if (isLoading) {
    return (
      <PageShell title="Compliance Dashboard" subtitle="Monitor member CPD compliance">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
      </PageShell>
    )
  }

  const summary = report?.summary ?? { totalMembers: 0, compliant: 0, atRisk: 0, nonCompliant: 0, complianceRate: 0 }

  return (
    <PageShell
      title="Compliance Dashboard"
      subtitle="Monitor member CPD compliance"
      actions={
        <Button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          size="sm"
        >
          <RefreshCw className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      }
    >
      <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="p-5">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-[var(--color-muted)]" />
            <div>
              <p className="text-2xl font-bold">{summary.totalMembers}</p>
              <p className="text-xs text-[var(--color-muted)]">Total Members</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-[var(--color-success)]" />
            <div>
              <p className="text-2xl font-bold text-[var(--color-success)]">{summary.compliant}</p>
              <p className="text-xs text-[var(--color-muted)]">Compliant</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-[var(--color-warning)]" />
            <div>
              <p className="text-2xl font-bold text-[var(--color-warning)]">{summary.atRisk}</p>
              <p className="text-xs text-[var(--color-muted)]">At Risk</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="flex items-center gap-3">
            <XCircle className="w-6 h-6 text-[var(--color-error)]" />
            <div>
              <p className="text-2xl font-bold text-[var(--color-error)]">{summary.nonCompliant}</p>
              <p className="text-xs text-[var(--color-muted)]">Non-Compliant</p>
            </div>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Member Standings</h3>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="compliant">Compliant</SelectItem>
              <SelectItem value="at_risk">At Risk</SelectItem>
              <SelectItem value="non_compliant">Non-Compliant</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {report?.standings?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-border)]">
                  <th className="pb-2">Member</th>
                  <th className="pb-2">Credits</th>
                  <th className="pb-2">Required</th>
                  <th className="pb-2">Progress</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {report.standings.map((s: any) => (
                  <tr key={s.personId} className="py-2">
                    <td className="py-2 font-mono text-xs">{s.personId.slice(0, 8)}...</td>
                    <td className="py-2">{s.totalCredits}</td>
                    <td className="py-2">{s.requiredCredits}</td>
                    <td className="py-2">
                      <div className="w-24 bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${s.complianceStatus === 'compliant' ? 'bg-[var(--color-success)]' : s.complianceStatus === 'at_risk' ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-error)]'}`}
                          style={{ width: `${Math.min(s.compliancePercent, 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.complianceStatus === 'compliant' ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]' :
                        s.complianceStatus === 'at_risk' ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' :
                        'bg-[var(--color-error-bg)] text-[var(--color-error)]'
                      }`}>
                        {s.complianceStatus?.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">No compliance data available. Credits need to be recorded first.</p>
        )}
      </GlassCard>
      </div>
    </PageShell>
  )
}
