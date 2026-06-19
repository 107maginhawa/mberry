import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  listDuesInvoicesOptions,
  listDuesInvoicesQueryKey,
  markDuesInvoicePaidMutation,
} from '@monobase/sdk-ts/generated/react-query'
import type { DuesInvoice } from '@monobase/sdk-ts/generated/types.gen'
import { FileText } from 'lucide-react'
import { Button, Skeleton } from '@monobase/ui'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@monobase/ui'
import { formatCents } from '../lib/money'
import { EmptyState } from '@/components/patterns/empty-state'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { DuesStatusBadge } from './dues-status-badge'

interface DuesInvoiceListProps {
  orgId: string
  tenantId: string
}


export function DuesInvoiceList({ orgId, tenantId }: DuesInvoiceListProps) {
  const queryClient = useQueryClient()
  const [confirmInv, setConfirmInv] = useState<DuesInvoice | null>(null)

  const { data, isLoading, error } = useQuery({
    ...listDuesInvoicesOptions({
      query: { organizationId: orgId },
      headers: { 'x-org-id': tenantId },
    }),
  })

  const invoiceQueryKey = listDuesInvoicesQueryKey()
  const markPaidMutation = useMutation({
    ...markDuesInvoicePaidMutation(),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: invoiceQueryKey })
      const previous = queryClient.getQueryData(invoiceQueryKey)
      queryClient.setQueryData(invoiceQueryKey, (old: any) => {
        if (!old?.data) return old
        return {
          ...old,
          data: old.data.map((inv: DuesInvoice) =>
            inv.id === variables.path.invoiceId ? { ...inv, status: 'paid' } : inv
          ),
        }
      })
      return { previous }
    },
    onError: (err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(invoiceQueryKey, context.previous)
      toast.error(err.message || 'Failed to mark invoice as paid')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: invoiceQueryKey })
    },
  })

  if (isLoading) return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg animate-shimmer" />
      ))}
    </div>
  )
  if (error) return <div role="alert" aria-live="polite" className="p-6 text-center text-[var(--color-error)]">Failed to load invoices</div>

  const invoices: DuesInvoice[] = data?.data ?? []

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
    <>
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
        {invoices.map((inv: DuesInvoice) => (
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
              <DuesStatusBadge status={inv.status} type="invoice" />
            </TableCell>
            <TableCell className="px-4 py-3">
              {['generated', 'sent', 'overdue'].includes(inv.status) && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setConfirmInv(inv)}
                  disabled={markPaidMutation.isPending}
                  className="text-xs text-[var(--color-success)]"
                >
                  Mark Paid
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>

    <ConfirmDialog
      open={confirmInv !== null}
      onOpenChange={(open) => { if (!open) setConfirmInv(null) }}
      variant="high-consequence"
      title="Mark invoice as paid?"
      description={
        confirmInv
          ? `This records a manual payment of ${formatCents(Number(confirmInv.totalAmount))} for invoice ${confirmInv.invoiceNumber}. Only confirm if the payment was actually received.`
          : ''
      }
      confirmLabel="Mark as Paid"
      onConfirm={() => {
        if (!confirmInv) return
        markPaidMutation.mutate({
          path: { invoiceId: confirmInv.id },
          body: { paymentId: `manual-${Date.now()}`, paidAt: new Date() },
          headers: { 'x-org-id': tenantId },
        })
        setConfirmInv(null)
      }}
    />
    </>
  )
}
