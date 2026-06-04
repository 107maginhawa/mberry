import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getDuesInvoiceOptions,
  markDuesInvoicePaidMutation,
  listDuesInvoicesQueryKey,
} from '@monobase/sdk-ts/generated/react-query'
import type { DuesInvoice } from '@monobase/sdk-ts/generated/types.gen'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { DuesStatusBadge } from '@/features/dues/components/dues-status-badge'
import { formatCents } from '@/features/dues/lib/money'
import { useOrg } from '@/hooks/useOrg'
import { Button, Skeleton } from '@monobase/ui'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@monobase/ui'
import { MoreHorizontal, CheckCircle, Send, XCircle, FileDown } from 'lucide-react'
import { toast } from 'sonner'
import { extractErrorMessage } from '@/utils/error'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/finances/invoices/$invoiceId')({
  component: InvoiceDetailPage,
})

function InvoiceDetailPage() {
  const { orgId, orgSlug } = useOrg()
  const { invoiceId } = Route.useParams()
  const queryClient = useQueryClient()

  const { data, isLoading, isError, error } = useQuery(
    getDuesInvoiceOptions({
      path: { invoiceId },
      headers: { 'x-org-id': orgId },
    } as any)
  )

  const invoice = data as DuesInvoice | undefined

  const markPaidMut = useMutation({
    ...markDuesInvoicePaidMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listDuesInvoicesQueryKey() })
      queryClient.invalidateQueries({ queryKey: ['getDuesInvoice', invoiceId] })
      toast.success('Invoice marked as paid')
    },
    onError: (err) => toast.error('Failed to mark invoice as paid', { description: extractErrorMessage(err, 'Please try again.') }),
  })

  const invoiceBreadcrumbs = [
    { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
    { label: 'Finances', href: `/org/${orgSlug}/officer/finances` },
    { label: 'Invoices', href: `/org/${orgSlug}/officer/finances/invoices` },
  ]

  if (isLoading) {
    return (
      <PageShell title="Invoice" breadcrumbs={invoiceBreadcrumbs}>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-6">
            <Skeleton className="h-64 flex-1" />
            <Skeleton className="h-64 w-[280px]" />
          </div>
        </div>
      </PageShell>
    )
  }

  if (isError) {
    return (
      <PageShell title="Invoice" breadcrumbs={invoiceBreadcrumbs}>
        <div role="alert" className="p-4 rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">
          Unable to load invoice detail. Please try refreshing the page.
        </div>
      </PageShell>
    )
  }

  if (error || !invoice) {
    return (
      <PageShell title="Invoice Not Found" breadcrumbs={invoiceBreadcrumbs}>
        <div className="text-center py-12 text-[var(--color-muted)]">
          Invoice not found or you don't have permission to view it.
        </div>
      </PageShell>
    )
  }

  const isActionable = ['generated', 'sent', 'overdue'].includes(invoice.status)
  const periodLabel = `${new Date(invoice.periodStart).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })} — ${new Date(invoice.periodEnd).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}`

  function handleMarkPaid() {
    markPaidMut.mutate({
      path: { invoiceId },
      body: { paymentId: `manual-${Date.now()}`, paidAt: new Date() },
      headers: { 'x-org-id': orgId },
    } as any)
  }

  return (
    <PageShell
      title={invoice.invoiceNumber}
      breadcrumbs={[...invoiceBreadcrumbs, { label: invoice.invoiceNumber }]}
      actions={
        isActionable ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="h-4 w-4 mr-1.5" /> Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleMarkPaid} disabled={markPaidMut.isPending}>
                <CheckCircle className="h-4 w-4 mr-2" /> Mark Paid
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info('Send invoice coming soon')}>
                <Send className="h-4 w-4 mr-2" /> Send to Member
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info('Void invoice coming soon')}>
                <XCircle className="h-4 w-4 mr-2" /> Void Invoice
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info('PDF download coming soon')}>
                <FileDown className="h-4 w-4 mr-2" /> Download PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : undefined
      }
    >
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Main content */}
        <div className="flex-1 space-y-5 min-w-0">
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-[var(--color-muted)] uppercase tracking-wider">Invoice Details</h3>
              <DuesStatusBadge status={invoice.status} type="invoice" />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[var(--color-muted)]">Invoice Number</p>
                <p className="font-mono">{invoice.invoiceNumber}</p>
              </div>
              <div>
                <p className="text-[var(--color-muted)]">Amount</p>
                <p className="font-mono text-lg font-bold">{formatCents(Number(invoice.totalAmount))}</p>
              </div>
              <div>
                <p className="text-[var(--color-muted)]">Period</p>
                <p>{periodLabel}</p>
              </div>
              <div>
                <p className="text-[var(--color-muted)]">Due Date</p>
                <p>{new Date(invoice.periodEnd).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
              </div>
              <div>
                <p className="text-[var(--color-muted)]">Generated</p>
                <p>{new Date(invoice.generatedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
              </div>
              {invoice.sentAt && (
                <div>
                  <p className="text-[var(--color-muted)]">Sent</p>
                  <p>{new Date(invoice.sentAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
              )}
              {invoice.paidAt && (
                <div>
                  <p className="text-[var(--color-muted)]">Paid</p>
                  <p>{new Date(invoice.paidAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Fund allocations */}
          {invoice.fundAllocations && invoice.fundAllocations.length > 0 && (
            <GlassCard className="p-5">
              <h3 className="text-sm font-medium text-[var(--color-muted)] uppercase tracking-wider mb-3">Fund Allocations</h3>
              <div className="space-y-2">
                {invoice.fundAllocations.map((alloc, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span>{alloc.fundName}</span>
                    <span className="font-mono">{formatCents(Number(alloc.amount))}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Timeline */}
          <GlassCard className="p-5">
            <h3 className="text-sm font-medium text-[var(--color-muted)] uppercase tracking-wider mb-3">Timeline</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-xs text-[var(--color-muted)] w-24 shrink-0">
                  {new Date(invoice.generatedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                </span>
                <span>Invoice generated</span>
              </div>
              {invoice.sentAt && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-xs text-[var(--color-muted)] w-24 shrink-0">
                    {new Date(invoice.sentAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                  </span>
                  <span>Sent to member</span>
                </div>
              )}
              {invoice.paidAt && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-xs text-[var(--color-muted)] w-24 shrink-0">
                    {new Date(invoice.paidAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                  </span>
                  <span>Payment received</span>
                </div>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-[280px] shrink-0 space-y-4">
          <GlassCard className="p-5">
            <h3 className="text-sm font-medium mb-2">Member</h3>
            <p className="text-sm font-medium">{(invoice as any).memberName ?? 'Unknown'}</p>
            <p className="text-xs text-[var(--color-muted)] font-mono">{invoice.personId}</p>
            <Link
              to="/org/$orgSlug/officer/finances/members/$memberId"
              params={{ orgSlug, memberId: invoice.membershipId }}
              className="text-sm text-[var(--color-primary)] hover:underline mt-2 block"
            >
              View Member →
            </Link>
          </GlassCard>

          <GlassCard className="p-5">
            <h3 className="text-sm font-medium mb-2">Metadata</h3>
            <div className="space-y-1 text-xs text-[var(--color-muted)] font-mono">
              <p>invoice_id: {invoice.id}</p>
              <p>membership_id: {invoice.membershipId}</p>
              <p>person_id: {invoice.personId}</p>
              <p>org_id: {invoice.organizationId}</p>
              {invoice.paymentId && <p>payment_id: {invoice.paymentId}</p>}
            </div>
          </GlassCard>
        </div>
      </div>
    </PageShell>
  )
}
