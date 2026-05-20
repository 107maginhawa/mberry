import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listDuesInvoicesOptions,
  listDuesInvoicesQueryKey,
  markDuesInvoicePaidMutation,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import { FileText } from 'lucide-react'
import { Button, Skeleton } from '@monobase/ui'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@monobase/ui'
import { formatCents } from '../lib/money'
import { EmptyState } from '@/components/patterns/empty-state'

interface DuesInvoiceListProps {
  orgId: string
  tenantId: string
}

const STATUS_BADGES: Record<string, string> = {
  generated: 'bg-gray-100 text-gray-800',
  sent: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  paid: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  overdue: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
  cancelled: 'bg-gray-100 text-gray-500',
  writtenOff: 'bg-orange-100 text-orange-800',
}

export function DuesInvoiceList({ orgId, tenantId }: DuesInvoiceListProps) {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    ...listDuesInvoicesOptions({
      query: { organizationId: orgId },
      headers: { 'x-org-id': tenantId },
    }),
  })

  const markPaidMutation = useMutation({
    ...markDuesInvoicePaidMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listDuesInvoicesQueryKey() })
    },
  })

  if (isLoading) return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg animate-shimmer" />
      ))}
    </div>
  )
  if (error) return <div className="p-6 text-center text-[var(--color-error)]">Failed to load invoices</div>

  const invoices = (data as any)?.data ?? []

  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="w-10 h-10" />}
        headline="No Invoices Yet"
        description="Invoices will appear here once the treasurer generates them for this organization."
      />
    )
  }

  return (
    <Table className="text-sm">
      <TableHeader>
        <TableRow>
          <TableHead className="px-4 py-3">Invoice #</TableHead>
          <TableHead className="px-4 py-3">Member</TableHead>
          <TableHead className="px-4 py-3">Period</TableHead>
          <TableHead className="px-4 py-3">Amount</TableHead>
          <TableHead className="px-4 py-3">Status</TableHead>
          <TableHead className="px-4 py-3">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((inv: any) => (
          <TableRow key={inv.id} className="hover:bg-[var(--color-surface-warm)]">
            <TableCell className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</TableCell>
            <TableCell className="px-4 py-3">{inv.personId}</TableCell>
            <TableCell className="px-4 py-3 text-xs">
              {inv.periodStart instanceof Date ? inv.periodStart.toLocaleDateString() : inv.periodStart} — {inv.periodEnd instanceof Date ? inv.periodEnd.toLocaleDateString() : inv.periodEnd}
            </TableCell>
            <TableCell className="px-4 py-3 font-mono">
              {formatCents(Number(inv.totalAmount))}
            </TableCell>
            <TableCell className="px-4 py-3">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGES[inv.status] || STATUS_BADGES.generated}`}>
                {inv.status}
              </span>
            </TableCell>
            <TableCell className="px-4 py-3">
              {['generated', 'sent', 'overdue'].includes(inv.status) && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => markPaidMutation.mutate({
                    path: { invoiceId: inv.id },
                    body: { paymentId: `manual-${Date.now()}` },
                    headers: { 'x-org-id': tenantId },
                  } as any)}
                  disabled={markPaidMutation.isPending}
                  className="text-xs text-green-700"
                >
                  Mark Paid
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
