import { useState } from 'react'
import { Card, CardContent, StatusBadge, ErrorState, Skeleton, Button, centavosToPhp } from '@monobase/ui'
import { useMemberData } from './use-member-data'
import { usePayNow } from './use-pay-now'

/**
 * StandingHero — the member home "poster" (DESIGN.md: large good-standing status
 * + one obvious primary action). Answers the member's #1 question at a glance:
 * "Am I OK, and do I owe money?" — then offers a single Pay CTA when dues exist.
 *
 * Absorbs the former MembershipTile + DuesOwedTile so membership status and dues
 * live in ONE focal block instead of competing equal-weight cards.
 *
 * Money reads at a glance via .tabular-amount + text-amount (the GCash lesson).
 *
 * a11y: chapter name is the page h1; status = text + color (StatusBadge), never
 * color alone; primary CTA is ≥48px (Button default); role=alert on errors.
 */
export function StandingHero() {
  const { membershipsQuery, invoicesQuery, outstandingInvoices } = useMemberData()
  const pay = usePayNow()
  const [payErr, setPayErr] = useState<string | null>(null)

  const loading = membershipsQuery.isLoading || invoicesQuery.isLoading
  const errored = membershipsQuery.isError || invoicesQuery.isError

  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-4 py-8">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-12 w-1/2" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (errored) {
    return (
      <Card>
        <CardContent className="py-6">
          <ErrorState
            bare
            message="We couldn't load your membership."
            onRetry={() => {
              void membershipsQuery.refetch()
              void invoicesQuery.refetch()
            }}
          />
        </CardContent>
      </Card>
    )
  }

  const membership = membershipsQuery.data && membershipsQuery.data.length > 0 ? membershipsQuery.data[0] : null
  const orgName = membership?.orgName ?? 'Your Chapter'

  // status must match StatusBadge's MembershipStatus union
  const safeStatus = membership && ['active', 'grace', 'lapsed', 'pending', 'suspended'].includes(membership.status)
    ? (membership.status as 'active' | 'grace' | 'lapsed' | 'pending' | 'suspended')
    : 'pending'

  // [review m8] duesExpiryDate is a plain date STRING — transformer does NOT convert it.
  const renewalLabel = membership?.duesExpiryDate
    ? new Date(membership.duesExpiryDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  const count = outstandingInvoices.length
  const owes = count > 0
  // mintMyPaymentLink charges ONE invoice. Charge (and therefore display) the
  // first outstanding invoice — the server returns them oldest-first — so the
  // focal amount always equals what the Pay button actually charges.
  // ponytail: pay-one-at-a-time; multi-invoice batch mint isn't in the frozen engine.
  const payInvoice = owes ? outstandingInvoices[0]! : null
  const chargeCentavos = payInvoice ? Number(payInvoice.totalAmount) : 0
  const totalCentavos = outstandingInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0)

  return (
    <Card className="overflow-hidden shadow-medium">
      {/* Chapter band — primary color, the poster header */}
      <div className="bg-primary px-6 py-5 text-primary-foreground">
        <h1 className="text-title font-bold">{orgName}</h1>
        <div className="mt-2">
          <StatusBadge status={safeStatus} />
        </div>
      </div>

      <CardContent className="space-y-5 py-6">
        {owes ? (
          <>
            <div className="space-y-1 text-center">
              <p className="text-body text-muted-foreground">You have dues to pay</p>
              <p
                className="tabular-amount text-amount font-bold text-foreground"
                aria-label={`Dues due now: ${centavosToPhp(chargeCentavos)}`}
              >
                {centavosToPhp(chargeCentavos)}
              </p>
              {count === 1 ? (
                <p className="text-body text-muted-foreground">1 outstanding invoice</p>
              ) : (
                <p className="text-body text-muted-foreground">
                  Paying your oldest of {count} invoices ({centavosToPhp(totalCentavos)} total)
                </p>
              )}
            </div>

            {payErr && (
              <p role="alert" className="text-caption text-center text-destructive">
                {payErr}
              </p>
            )}

            <Button
              className="w-full text-large font-semibold"
              disabled={pay.isPending || pay.isSuccess}
              onClick={() => {
                setPayErr(null)
                pay.mutate(
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  { invoiceId: payInvoice!.id },
                  {
                    onSuccess: ({ paymentUrl }) => {
                      window.location.href = paymentUrl
                    },
                    onError: (e) => setPayErr(e.message),
                  },
                )
              }}
            >
              Pay dues
            </Button>

            <p className="text-caption text-center text-muted-foreground">
              Secure payment via GCash, Maya, or card
            </p>
          </>
        ) : (
          <div className="space-y-3 text-center">
            <p className="text-section font-semibold text-success">
              You&rsquo;re in good standing
            </p>
            <p className="text-body text-muted-foreground">No dues to pay right now.</p>
            {renewalLabel && (
              <p className="text-body text-muted-foreground">
                <span className="font-medium">Renews</span> {renewalLabel}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
