import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Users, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { CardSkeleton } from '@/components/patterns/skeleton-loader'
import { useOrg } from '@/hooks/useOrg'
import { api } from '@/lib/api'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { useState } from 'react'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/compliance')({
  component: OfficerCompliance,
})

function OfficerCompliance() {
  const { orgId } = useOrg()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['compliance-report', orgId, statusFilter],
    queryFn: () => api.get(`/api/association/member/compliance/${orgId}${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`),
    enabled: !!orgId,
  })

  const refreshMutation = useMutation({
    mutationFn: () => api.post(`/api/association/member/compliance/${orgId}/refresh`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['compliance-report'] }),
  })

  const report = (data as any)?.data

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Compliance Dashboard" subtitle="Monitor member CPD compliance" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
      </div>
    )
  }

  const summary = report?.summary ?? { totalMembers: 0, compliant: 0, atRisk: 0, nonCompliant: 0, complianceRate: 0 }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance Dashboard"
        subtitle="Monitor member CPD compliance"
        actions={
          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

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
            <CheckCircle className="w-6 h-6 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-600">{summary.compliant}</p>
              <p className="text-xs text-[var(--color-muted)]">Compliant</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
            <div>
              <p className="text-2xl font-bold text-amber-600">{summary.atRisk}</p>
              <p className="text-xs text-[var(--color-muted)]">At Risk</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="flex items-center gap-3">
            <XCircle className="w-6 h-6 text-red-600" />
            <div>
              <p className="text-2xl font-bold text-red-600">{summary.nonCompliant}</p>
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
                      <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${s.complianceStatus === 'compliant' ? 'bg-green-500' : s.complianceStatus === 'at_risk' ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(s.compliancePercent, 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.complianceStatus === 'compliant' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                        s.complianceStatus === 'at_risk' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' :
                        'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
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
  )
}
