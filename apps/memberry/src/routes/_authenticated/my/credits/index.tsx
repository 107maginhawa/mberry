import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

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
  const [totalCredits, setTotalCredits] = useState(0)
  const [entries, setEntries] = useState<CreditEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/persons/me/credit-summary', { credentials: 'include' })
        .then(r => r.ok ? r.json() : { totalCredits: 0 }),
      fetch('/api/persons/me/credit-entries', { credentials: 'include' })
        .then(r => r.ok ? r.json() : { data: [] })
        .catch(() => ({ data: [] })),
    ]).then(([summary, entriesResp]) => {
      setTotalCredits(summary.totalCredits || 0)
      setEntries(entriesResp.data || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

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
