import { Button, Card, CardContent, Skeleton } from '@monobase/ui'
import { centavosToPhp } from './money'
import type { PayState } from './use-pay-link'

type PayCardState = Extract<PayState, { kind: 'payable' | 'cancelled' }>

interface PayCardProps {
  state: PayCardState
  paying: boolean
  onPay: () => void
}

// Payable/cancelled card (DESIGN.md: single primary task, touch-first).
// dueDate here is the token's 72h expiresAt — NOT the invoice due date.
// Copy says "Pay by" / "Link valid until", never "Due date" (brief review N1).
export function PayCard({ state, paying, onPay }: PayCardProps) {
  // Guard: cancelled arrives with zero/empty fields while validate still loading
  // OR while validate returned already_paid. Show neutral skeleton — never
  // "₱0.00 — PDA" which would be misleading (Task 5 spec N1).
  const hasFields = state.amount > 0 && state.orgName !== ''

  if (!hasFields) {
    return (
      <div
        role="status"
        aria-label="Loading payment details"
        className="min-h-screen flex items-center justify-center bg-background p-4"
      >
        <div className="w-full max-w-sm space-y-4">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-12 w-3/4 mx-auto" />
          <Skeleton className="h-6 w-1/2 mx-auto" />
          <Skeleton className="min-h-tap w-full" />
        </div>
      </div>
    )
  }

  const isCancelled = state.kind === 'cancelled'

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm overflow-hidden">
        {/* Org header band — primary color background */}
        <div className="bg-primary px-6 py-5 text-primary-foreground text-center">
          <p className="text-caption font-medium text-primary-foreground/90">
            Dues payment
          </p>
          <p className="text-section font-semibold mt-1">{state.orgName}</p>
        </div>

        <CardContent className="pt-6 pb-6 space-y-5">
          {/* Cancelled banner — tell the member it wasn't a glitch; they can retry. */}
          {isCancelled && (
            <p
              role="status"
              className="rounded-md bg-[var(--color-warning-bg)] px-4 py-3 text-center text-body font-medium text-[var(--color-warning)]"
            >
              Payment cancelled. You can try again below.
            </p>
          )}
          {/* Big tabular amount (DESIGN.md: .tabular-amount, GCash lesson) */}
          <p
            className="tabular-amount text-amount font-bold text-center text-foreground"
            aria-label={`Amount due: ${centavosToPhp(state.amount)}`}
          >
            {centavosToPhp(state.amount)}
          </p>

          {/* Member name */}
          <p className="text-body text-center text-muted-foreground">
            {state.memberName}
          </p>

          {/* Token expiry — "Pay by", never "Due date" (brief N1) */}
          {state.dueDate && (
            <p className="text-caption text-center text-muted-foreground">
              {'Pay by '}
              <time dateTime={state.dueDate}>
                {new Date(state.dueDate).toLocaleDateString('en-PH', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </time>
            </p>
          )}

          {/* Pay now — min-h-tap = 48px tap target (DESIGN.md accessibility) */}
          <Button
            className="w-full min-h-tap text-body font-semibold"
            onClick={onPay}
            disabled={paying}
            aria-busy={paying}
          >
            {paying ? 'Processing…' : isCancelled ? 'Try payment again' : 'Pay now'}
          </Button>

          <p className="text-caption text-center text-muted-foreground">
            Secure payment via GCash, Maya, or card
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
