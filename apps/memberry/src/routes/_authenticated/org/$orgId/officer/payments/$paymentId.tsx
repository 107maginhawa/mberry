import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCents } from '@/features/dues/lib/money'
import { RefundForm } from '@/features/dues/components/refund-form'
import { ArrowLeft } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/payments/$paymentId')({
  component: PaymentDetailPage,
})

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-600',
  partially_refunded: 'bg-gray-100 text-gray-600',
  expired: 'bg-orange-100 text-orange-800',
}

function PaymentDetailPage() {
  const { orgId, paymentId } = Route.useParams()

  const { data, isLoading, error } = useQuery({
    queryKey: ['dues-payment', paymentId],
    queryFn: async () => {
      const res = await fetch(`/api/dues/payments/${paymentId}`)
      if (!res.ok) throw new Error('Not found')
      return (await res.json()).data
    },
  })

  if (isLoading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>
  if (error || !data) return <div className="p-6 text-destructive">Payment not found.</div>

  const payment = data
  const allocations = payment.fundAllocations ?? []
  const origAllocations = allocations.filter((a: any) => !a.isReversal)
  const reversals = allocations.filter((a: any) => a.isReversal)
  const maxRefundable = payment.amount - payment.refundedAmount

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <Link to="/org/$orgId/officer/payments" params={{ orgId }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to payments
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold font-mono">{payment.receiptNumber}</h1>
        <Badge className={STATUS_COLORS[payment.status] ?? ''}>{payment.status}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-muted-foreground">Amount:</span> <span className="font-mono font-medium">{formatCents(payment.amount, payment.currency)}</span></div>
        <div><span className="text-muted-foreground">Method:</span> {payment.paymentMethod}</div>
        <div><span className="text-muted-foreground">Date:</span> {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : '—'}</div>
        <div><span className="text-muted-foreground">Reference:</span> {payment.referenceNumber || '—'}</div>
      </div>

      {origAllocations.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Fund Allocation</h3>
          <table className="w-full text-sm border">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left">Fund</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {origAllocations.map((a: any) => (
                <tr key={a.id} className="border-b">
                  <td className="px-3 py-2">{a.fundId}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatCents(a.amount, payment.currency)}</td>
                </tr>
              ))}
              {reversals.map((a: any) => (
                <tr key={a.id} className="border-b text-red-600">
                  <td className="px-3 py-2">Refund reversal</td>
                  <td className="px-3 py-2 text-right font-mono">{formatCents(a.amount, payment.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(payment.status === 'completed' || payment.status === 'partially_refunded') && maxRefundable > 0 && (
        <RefundForm paymentId={paymentId} maxAmount={maxRefundable} currency={payment.currency} />
      )}
      {payment.status === 'refunded' && (
        <p className="text-sm text-muted-foreground">This payment has been fully refunded.</p>
      )}
    </div>
  )
}
