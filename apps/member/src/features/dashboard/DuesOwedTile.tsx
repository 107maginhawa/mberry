import { Card, CardHeader, CardTitle, CardContent, CardFooter, EmptyState, ErrorState, Skeleton, centavosToPhp } from '@monobase/ui'
import { useMemberData } from './use-member-data'

/**
 * DuesOwedTile — shows outstanding dues invoices total.
 *
 * Outstanding = status ∈ { generated, sent, overdue } (matches engine filter set).
 * Money: centavosToPhp(Number(totalAmount)) — totalAmount is bigint via SDK transformer;
 * Number() coerces bigint to number so centavosToPhp can divide by 100.
 *
 * No self-serve pay endpoint exists — informational footer directs member to
 * the officer-issued pay-link they received by SMS/email.
 *
 * a11y: 18px base via tokens.css, role=alert on error.
 */
export function DuesOwedTile() {
  const { invoicesQuery, outstandingInvoices } = useMemberData()
  const { isLoading, isError } = invoicesQuery

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
      </CardContent>
      <CardFooter className="pt-0">
        <p className="text-caption text-muted-foreground">
          To pay, use the link your chapter sent you.
        </p>
      </CardFooter>
    </Card>
  )
}
