import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getDuesPaymentOptions } from '@monobase/sdk-ts/generated/react-query'
import { Badge } from '@monobase/ui'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@monobase/ui'
import { formatCents } from '@/features/dues/lib/money'
import { RefundForm } from '@/features/dues/components/refund-form'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { CardSkeleton } from '@/components/patterns/skeleton-loader'
import { useOrg } from '@/hooks/use-org'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/payments/$paymentId')({
  component: PaymentDetailPage,
})

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  pending: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  failed: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
  refunded: 'bg-muted text-muted-foreground',
  partiallyRefunded: 'bg-muted text-muted-foreground',
  submitted: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  underReview: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  confirmed: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  rejected: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
  expired: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
}

function PaymentDetailPage() {
  const { orgId, orgSlug } = useOrg()
  const { paymentId } = Route.useParams()

  const { data, isLoading, isError, error } = useQuery({
    ...getDuesPaymentOptions({ path: { paymentId } }),
    select: (d: any) => d?.data ?? d,
  })

  const paymentBreadcrumbs = [
    { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
    { label: 'Payments', href: `/org/${orgSlug}/officer/payments` },
  ]

  if (isLoading) {
    return (
      <PageShell title="Payment" breadcrumbs={paymentBreadcrumbs}>
        <div className="space-y-4"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
      </PageShell>
    )
  }
  if (isError) {
    return (
      <PageShell title="Payment" breadcrumbs={paymentBreadcrumbs}>
        <div role="alert" className="p-6 rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">
          Unable to load payment detail. Please try refreshing the page.
        </div>
      </PageShell>
    )
  }
  if (error || !data) {
    return (
      <PageShell title="Payment" breadcrumbs={paymentBreadcrumbs}>
        <div className="p-6 text-[var(--color-error)]">Payment not found.</div>
      </PageShell>
    )
  }

  const payment = data
  const allocations = payment.fundAllocations ?? []
  const origAllocations = allocations.filter((a: any) => !a.isReversal)
  const reversals = allocations.filter((a: any) => a.isReversal)
  const maxRefundable = Number(payment.amount) - Number(payment.refundedAmount)

  return (
    <PageShell
      title={payment.receiptNumber}
      breadcrumbs={[...paymentBreadcrumbs, { label: payment.receiptNumber }]}
      actions={<Badge className={STATUS_COLORS[payment.status] ?? ''}>{payment.status}</Badge>}
    >
      <div className="space-y-6 max-w-3xl">
      <GlassCard className="p-5">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-[var(--color-muted)]">Amount:</span> <span className="font-mono font-medium">{formatCents(payment.amount, payment.currency)}</span></div>
          <div><span className="text-[var(--color-muted)]">Method:</span> {payment.paymentMethod}</div>
          <div><span className="text-[var(--color-muted)]">Date:</span> {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : '—'}</div>
          <div><span className="text-[var(--color-muted)]">Reference:</span> {payment.referenceNumber || '—'}</div>
        </div>
      </GlassCard>

      {origAllocations.length > 0 && (
        <GlassCard className="p-5">
          <h3 className="text-h4 mb-3">Fund Allocation</h3>
          <Table className="text-sm">
            <TableHeader>
              <TableRow className="border-b border-[var(--color-border-light)]">
                <TableHead className="px-3 py-2 text-xs uppercase tracking-wide">Fund</TableHead>
                <TableHead className="px-3 py-2 text-right text-xs uppercase tracking-wide">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {origAllocations.map((a: any) => (
                <TableRow key={a.id} className="border-b border-[var(--color-border-light)]">
                  <TableCell className="px-3 py-2">{a.fundId}</TableCell>
                  <TableCell className="px-3 py-2 text-right font-mono">{formatCents(a.amount, payment.currency)}</TableCell>
                </TableRow>
              ))}
              {reversals.map((a: any) => (
                <TableRow key={a.id} className="border-b border-[var(--color-border-light)] text-[var(--color-error)]">
                  <TableCell className="px-3 py-2">Refund reversal</TableCell>
                  <TableCell className="px-3 py-2 text-right font-mono">{formatCents(a.amount, payment.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GlassCard>
      )}

      {(payment.status === 'completed' || payment.status === 'partiallyRefunded') && maxRefundable > 0 && (
        <GlassCard className="p-5">
          <RefundForm paymentId={paymentId} maxAmount={maxRefundable} currency={payment.currency} />
        </GlassCard>
      )}
      {payment.status === 'refunded' && (
        <p className="text-sm text-[var(--color-muted)]">This payment has been fully refunded.</p>
      )}
      </div>
    </PageShell>
  )
}
