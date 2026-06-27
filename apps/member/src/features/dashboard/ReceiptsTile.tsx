import { Card, CardHeader, CardTitle, CardContent, EmptyState, ErrorState, Skeleton, centavosToPhp } from '@monobase/ui'
import { useMemberData } from './use-member-data'

/**
 * ReceiptsTile — lists the member's recent dues payments.
 *
 * Money: centavosToPhp(Number(payment.amount)) — amount comes from the handler as
 * Number but the listDuesPaymentsResponseTransformer reconverts it to bigint.
 * Number() coerces bigint → number safely so centavosToPhp can divide by 100.
 *
 * paidAt is a string ISO timestamp — format with toLocaleDateString for display.
 *
 * a11y: 18px base via tokens.css, role=alert on error.
 */
export function ReceiptsTile() {
  const { paymentsQuery } = useMemberData()
  const { isLoading, isError, data } = paymentsQuery

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-body font-semibold text-muted-foreground">Payment Receipts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-body font-semibold text-muted-foreground">Payment Receipts</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState message="Could not load your payment history. Please refresh." />
        </CardContent>
      </Card>
    )
  }

  const payments = data ?? []

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-body font-semibold text-muted-foreground">Payment Receipts</CardTitle>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <EmptyState headline="No payments yet." />
        ) : (
          <ul className="divide-y divide-border" aria-label="Payment receipts">
            {payments.map((p) => {
              // [review] amount is Number from handler but transformer→bigint; Number() at display
              const amountDisplay = centavosToPhp(Number(p.amount))
              const paidDate = p.paidAt
                ? new Date(p.paidAt).toLocaleDateString('en-PH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : '—'

              return (
                <li key={p.id} className="py-3 flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="text-body font-medium text-foreground">
                      {p.receiptNumber ?? p.id}
                    </p>
                    <p className="text-caption text-muted-foreground">
                      <span className="font-medium">Paid</span>{' '}{paidDate}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-body font-semibold text-foreground">{amountDisplay}</p>
                    <p className="text-caption text-muted-foreground capitalize">{p.status}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
