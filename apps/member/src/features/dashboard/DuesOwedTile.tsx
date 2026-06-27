import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardFooter, Button, EmptyState, ErrorState, Skeleton, centavosToPhp } from '@monobase/ui'
import { useMemberData } from './use-member-data'
import { usePayNow } from './use-pay-now'

/**
 * DuesOwedTile — shows outstanding dues invoices total.
 *
 * Outstanding = status ∈ { generated, sent, overdue } (matches engine filter set).
 * Money: centavosToPhp(Number(totalAmount)) — totalAmount is bigint via SDK transformer;
 * Number() coerces bigint to number so centavosToPhp can divide by 100.
 *
 * When outstanding invoices exist: shows a "Pay now" button that mints a self-serve
 * pay-link and redirects to /pay/:token. Button is disabled while pending or after
 * success (before redirect) to prevent double-tap (engine also guards via CAS mutex).
 *
 * When no outstanding invoices: informational footer directs member to the
 * officer-issued pay-link they received by SMS/email.
 *
 * a11y: 18px base via tokens.css, role=alert on error, min-h-[48px] tap target.
 */
export function DuesOwedTile() {
  const { invoicesQuery, outstandingInvoices } = useMemberData()
  const { isLoading, isError } = invoicesQuery
  const pay = usePayNow()
  const [payErr, setPayErr] = useState<string | null>(null)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-body font-semibold text-muted-foreground">Dues Owed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-body font-semibold text-muted-foreground">Dues Owed</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState message="Could not load your dues. Please refresh." />
        </CardContent>
      </Card>
    )
  }

  const totalCentavos = outstandingInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0)
  const count = outstandingInvoices.length

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-body font-semibold text-muted-foreground">Dues Owed</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {count === 0 ? (
          <EmptyState
            headline="You're all paid up."
            description="No outstanding dues at this time."
          />
        ) : (
          <div className="space-y-1">
            <p className="text-2xl font-bold text-foreground">{centavosToPhp(totalCentavos)}</p>
            <p className="text-body text-muted-foreground">
              {count === 1 ? '1 outstanding invoice' : `${count} outstanding invoices`}
            </p>
          </div>
        )}
        {payErr && (
          <p role="alert" className="text-caption text-destructive">
            {payErr}
          </p>
        )}
      </CardContent>
      <CardFooter className="pt-0">
        {count > 0 ? (
          <Button
            className="w-full min-h-[48px]"
            disabled={pay.isPending || pay.isSuccess}
            onClick={() => {
              setPayErr(null)
              pay.mutate(
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              { invoiceId: outstandingInvoices[0]!.id },
                {
                  onSuccess: ({ paymentUrl }) => {
                    window.location.href = paymentUrl
                  },
                  onError: (e) => setPayErr(e.message),
                },
              )
            }}
          >
            Pay now
          </Button>
        ) : (
          <p className="text-caption text-muted-foreground">
            To pay, use the link your chapter sent you.
          </p>
        )}
      </CardFooter>
    </Card>
  )
}
