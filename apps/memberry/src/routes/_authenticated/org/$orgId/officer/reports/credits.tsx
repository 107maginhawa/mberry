import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { useState } from 'react'

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
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Credit Compliance Report</h1>
        <p className="text-sm text-muted-foreground">
          Member CPD credit status — {summary.requiredCredits} credits required per cycle
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button onClick={() => setFilter('all')} className={`border rounded-lg p-4 text-left hover:bg-muted/50 ${filter === 'all' ? 'ring-2 ring-primary' : ''}`}>
          <p className="text-sm text-muted-foreground">Total Tracked</p>
          <p className="text-2xl font-bold">{summary.total}</p>
        </button>
        <button onClick={() => setFilter('compliant')} className={`border rounded-lg p-4 text-left hover:bg-muted/50 ${filter === 'compliant' ? 'ring-2 ring-green-500' : ''}`}>
          <p className="text-sm text-muted-foreground">Compliant</p>
          <p className="text-2xl font-bold text-green-600">{summary.compliant}</p>
        </button>
        <button onClick={() => setFilter('at_risk')} className={`border rounded-lg p-4 text-left hover:bg-muted/50 ${filter === 'at_risk' ? 'ring-2 ring-yellow-500' : ''}`}>
          <p className="text-sm text-muted-foreground">At Risk</p>
          <p className="text-2xl font-bold text-yellow-600">{summary.atRisk}</p>
        </button>
        <button onClick={() => setFilter('non_compliant')} className={`border rounded-lg p-4 text-left hover:bg-muted/50 ${filter === 'non_compliant' ? 'ring-2 ring-red-500' : ''}`}>
          <p className="text-sm text-muted-foreground">Non-Compliant</p>
          <p className="text-2xl font-bold text-red-600">{summary.nonCompliant}</p>
        </button>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Member</th>
              <th className="text-left p-3 font-medium">ID</th>
              <th className="text-right p-3 font-medium">Earned</th>
              <th className="text-right p-3 font-medium">Required</th>
              <th className="text-right p-3 font-medium">Remaining</th>
              <th className="text-left p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr className="border-t">
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No members found for this filter.
                </td>
              </tr>
            ) : (
              members.map((m: any) => {
                const badge = STATUS_BADGE[m.compliance_status] ?? { label: 'Unknown', className: 'bg-gray-100 text-gray-800' }
                const pct = Math.min(100, Math.round((m.earned / m.required) * 100))
                return (
                  <tr key={m.person_id} className="border-t hover:bg-muted/30">
                    <td className="p-3 font-medium">
                      {[m.first_name, m.last_name].filter(Boolean).join(' ') || 'Unknown'}
                    </td>
                    <td className="p-3 text-muted-foreground">{m.member_number ?? '—'}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span>{m.earned}</span>
                      </div>
                    </td>
                    <td className="p-3 text-right text-muted-foreground">{m.required}</td>
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

      {members.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {members.length} of {allMembers.length} members
          {filter !== 'all' && ` (filtered: ${STATUS_BADGE[filter]?.label ?? filter})`}
        </p>
      )}
    </div>
  )
}
