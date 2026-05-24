import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { listDuesPaymentsOptions } from '@monobase/sdk-ts/generated/react-query'
import type { DuesPaymentStatus, DuesPayment } from '@monobase/sdk-ts/generated/types.gen'
import { Button } from '@monobase/ui'
import { Skeleton } from '@monobase/ui'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@monobase/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { Receipt } from 'lucide-react'
import { formatCents } from '../lib/money'
import { EmptyState } from '@/components/patterns/empty-state'
import { GlassCard } from '@/components/motion/glass-card'
import { DuesStatusBadge } from './dues-status-badge'

interface PaymentHistoryTableProps {
  orgId?: string
  scope: 'member' | 'org'
}


const METHOD_LABELS: Record<string, string> = {
  online: 'Online',
  cash: 'Cash',
  check: 'Check',
  bankTransfer: 'Bank Transfer',
  gcash: 'GCash',
  other: 'Other',
}

export function PaymentHistoryTable({ orgId, scope }: PaymentHistoryTableProps) {
  const [statusFilter, setStatusFilter] = useState<DuesPaymentStatus | 'all'>('all')
  const [methodFilter, setMethodFilter] = useState<string>('all')
  const [offset, setOffset] = useState(0)
  const limit = 25

  const { data, isLoading } = useQuery({
    ...listDuesPaymentsOptions({
      query: {
        ...(orgId ? { organizationId: orgId } : {}),
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        limit,
        offset,
      },
      ...(orgId ? { headers: { 'x-org-id': orgId } } : {}),
    }),
    enabled: !!orgId,
  })

  const payments = data?.data ?? []
  const total = data?.pagination?.totalCount ?? 0

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as DuesPaymentStatus | 'all'); setOffset(0) }}>
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
            <SelectItem value="bankTransfer">Bank Transfer</SelectItem>
            <SelectItem value="gcash">GCash</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg animate-shimmer" />)}</div>
      ) : payments.length === 0 ? (
        <EmptyState
          icon={<Receipt className="w-10 h-10" />}
          headline="No Payments Found"
          description="No payments match your current filters. Try adjusting or clearing filters."
        />
      ) : (
        <GlassCard className="overflow-hidden">
        <Table className="text-sm">
          <TableHeader>
            <TableRow className="bg-[var(--color-surface-warm)]">
              {scope === 'org' && <TableHead className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Member</TableHead>}
              <TableHead className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Date</TableHead>
              <TableHead className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Receipt #</TableHead>
              <TableHead className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Amount</TableHead>
              <TableHead className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Method</TableHead>
              <TableHead className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p: DuesPayment, idx: number) => (
              <TableRow key={p.id} className={`hover:bg-[var(--color-surface-warm)] cursor-pointer ${idx % 2 === 1 ? 'bg-[var(--color-surface-warm)]' : ''}`} onClick={() => orgId && window.location.assign(`/org/${orgId}/officer/payments/${p.id}`)}>
                {scope === 'org' && <TableCell className="px-3 py-2 text-body-sm">{[(p as any).person?.firstName, (p as any).person?.lastName].filter(Boolean).join(' ') || (p.personId?.slice(0, 8) + '...')}</TableCell>}
                <TableCell className="px-3 py-2 text-body-sm tabular-nums">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '—'}</TableCell>
                <TableCell className="px-3 py-2 text-mono tabular-nums">{p.receiptNumber}</TableCell>
                <TableCell className="px-3 py-2 text-mono tabular-nums">{formatCents(Number(p.amount), p.currency)}</TableCell>
                <TableCell className="px-3 py-2 text-body-sm">{METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod}</TableCell>
                <TableCell className="px-3 py-2">
                  <DuesStatusBadge status={p.status} type="payment" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </GlassCard>
      )}

      {total > limit && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-[var(--color-muted)]">Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total}>Next</Button>
          </div>
        </div>
      )}
    </div>
  )
}
