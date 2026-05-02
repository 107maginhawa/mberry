import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCents } from '../lib/money'

interface PaymentHistoryTableProps {
  orgId?: string
  scope: 'member' | 'org'
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-red-100 text-red-800',
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
      const res = await fetch(`/api/dues/payments?${params}`)
      return res.json()
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
              <tr className="border-b text-left">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Receipt #</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p: any) => (
                <tr key={p.id} className="border-b hover:bg-muted/50 cursor-pointer">
                  <td className="px-4 py-3">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{p.receiptNumber}</td>
                  <td className="px-4 py-3 font-mono">{formatCents(p.amount, p.currency)}</td>
                  <td className="px-4 py-3">{METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod}</td>
                  <td className="px-4 py-3">
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
