import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listDuesInvoicesOptions,
  listDuesInvoicesQueryKey,
  markDuesInvoicePaidMutation,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import { formatCents } from '../lib/money'

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

  if (isLoading) return <div className="p-6 text-center text-muted-foreground">Loading invoices...</div>
  if (error) return <div className="p-6 text-center text-destructive">Failed to load invoices</div>

  const invoices = (data as any)?.data ?? []

  if (invoices.length === 0) {
    return <div className="p-6 text-center text-muted-foreground">No invoices yet.</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="px-4 py-3 font-medium">Invoice #</th>
            <th className="px-4 py-3 font-medium">Member</th>
            <th className="px-4 py-3 font-medium">Period</th>
            <th className="px-4 py-3 font-medium">Amount</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv: any) => (
            <tr key={inv.id} className="border-b hover:bg-muted/50">
              <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
              <td className="px-4 py-3">{inv.personId}</td>
              <td className="px-4 py-3 text-xs">
                {inv.periodStart instanceof Date ? inv.periodStart.toLocaleDateString() : inv.periodStart} — {inv.periodEnd instanceof Date ? inv.periodEnd.toLocaleDateString() : inv.periodEnd}
              </td>
              <td className="px-4 py-3 font-mono">
                {formatCents(Number(inv.totalAmount))}
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGES[inv.status] || STATUS_BADGES.generated}`}>
                  {inv.status}
                </span>
              </td>
              <td className="px-4 py-3">
                {['generated', 'sent', 'overdue'].includes(inv.status) && (
                  <button
                    onClick={() => markPaidMutation.mutate({
                      path: { invoiceId: inv.id },
                      body: { paymentId: `manual-${Date.now()}` },
                      headers: { 'x-org-id': tenantId },
                    } as any)}
                    disabled={markPaidMutation.isPending}
                    className="text-xs text-green-700 hover:underline disabled:opacity-50"
                  >
                    Mark Paid
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
