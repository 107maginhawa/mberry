import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCents } from '../lib/money'

interface PaymentHistoryTableProps {
  orgId?: string
  scope: 'member' | 'org'
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  pending: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  failed: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
  refunded: 'bg-gray-100 text-gray-600',
  partially_refunded: 'bg-gray-100 text-gray-600',
  expired: 'bg-orange-100 text-orange-800',
}

const METHOD_LABELS: Record<string, string> = {
  online: 'Online',
  cash: 'Cash',
  check: 'Check',
  bank_transfer: 'Bank Transfer',
  gcash: 'GCash',
  other: 'Other',
}

export function PaymentHistoryTable({ orgId, scope }: PaymentHistoryTableProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [methodFilter, setMethodFilter] = useState<string>('all')
  const [offset, setOffset] = useState(0)
  const limit = 25

  const { data, isLoading } = useQuery({
    queryKey: ['dues-payments', scope, orgId, statusFilter, methodFilter, offset],
    queryFn: async () => {
      const params = new URLSearchParams({ scope, limit: String(limit), offset: String(offset) })
      if (orgId) params.set('organizationId', orgId)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (methodFilter !== 'all') params.set('method', methodFilter)
      return api.get<any>(`/api/dues/payments?${params}`)
    },
  })

  const payments = data?.data ?? []
  const total = data?.meta?.total ?? 0

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setOffset(0) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={(v) => { setMethodFilter(v); setOffset(0) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Method" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="check">Check</SelectItem>
            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
            <SelectItem value="gcash">GCash</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : payments.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No payments match your filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-surface-warm)] border-b text-left">
                <th className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Date</th>
                <th className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Receipt #</th>
                <th className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Amount</th>
                <th className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Method</th>
                <th className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p: any, idx: number) => (
                <tr key={p.id} className={`hover:bg-muted/50 cursor-pointer ${idx % 2 === 1 ? 'bg-[var(--color-surface-warm)]' : ''}`} onClick={() => orgId && window.location.assign(`/org/${orgId}/officer/payments/${p.id}`)}>
                  <td className="px-3 py-2 text-body-sm tabular-nums">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '—'}</td>
                  <td className="px-3 py-2 text-mono tabular-nums">{p.receiptNumber}</td>
                  <td className="px-3 py-2 text-mono tabular-nums">{formatCents(p.amount, p.currency)}</td>
                  <td className="px-3 py-2 text-body-sm">{METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod}</td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary" className={STATUS_COLORS[p.status] ?? ''}>
                      {p.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > limit && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
          <div className="flex gap-2">
            <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0} className="px-3 py-1 border rounded disabled:opacity-50">Previous</button>
            <button onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
