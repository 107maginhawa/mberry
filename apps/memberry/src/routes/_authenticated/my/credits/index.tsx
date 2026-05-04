import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'

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

function MyCredits() {
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['credit-summary'],
    queryFn: () => api.get<{ totalCredits: number }>('/api/persons/me/credit-summary'),
  })

  const { data: entriesResp, isLoading: entriesLoading } = useQuery({
    queryKey: ['credit-entries'],
    queryFn: () => api.get<{ data: CreditEntry[] }>('/api/persons/me/credit-entries'),
  })

  const totalCredits = summary?.totalCredits || 0
  const entries = entriesResp?.data || []
  const loading = summaryLoading || entriesLoading

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[var(--color-muted)]">
        <Loader2 size={24} className="animate-spin mr-2" />
        Loading credits...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-display font-bold">CPD Credits</h1>
        <p className="text-[14px] text-[var(--color-muted)]">Your professional development credit summary across all organizations</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-4">
          <p className="text-[13px] text-[var(--color-muted)]">Earned</p>
          <p className="text-[24px] font-bold text-[var(--color-primary)]">{totalCredits}</p>
        </div>
        <div className="rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-4">
          <p className="text-[13px] text-[var(--color-muted)]">Required</p>
          <p className="text-[24px] font-bold">40</p>
        </div>
        <div className="rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-4">
          <p className="text-[13px] text-[var(--color-muted)]">Carryover</p>
          <p className="text-[24px] font-bold">0</p>
        </div>
        <div className="rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-4">
          <p className="text-[13px] text-[var(--color-muted)]">Remaining</p>
          <p className="text-[24px] font-bold">{Math.max(0, 40 - totalCredits)}</p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-[16px] font-semibold font-display">Credit Log</h2>
        <a href="/my/credits/log" className="text-[13px] font-semibold text-[var(--color-primary)] hover:underline">Manual Entry →</a>
      </div>

      <div className="rounded-[12px] border border-[var(--color-border-light)] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-[var(--color-surface-warm)]">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-[var(--color-muted)] text-[12px] uppercase tracking-wide">Activity</th>
              <th className="text-left px-4 py-3 font-semibold text-[var(--color-muted)] text-[12px] uppercase tracking-wide">Date</th>
              <th className="text-left px-4 py-3 font-semibold text-[var(--color-muted)] text-[12px] uppercase tracking-wide">Type</th>
              <th className="text-right px-4 py-3 font-semibold text-[var(--color-muted)] text-[12px] uppercase tracking-wide">Credits</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-[var(--color-muted)]">
                  No credits earned yet. Attend training sessions to earn credits automatically.
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="border-t border-[var(--color-border-light)]">
                  <td className="px-4 py-3 font-medium">{e.activityName || 'Training'}</td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">
                    {e.activityDate ? new Date(e.activityDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 capitalize">{e.type || 'auto'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[var(--color-primary)]">{e.creditAmount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
