import { Link } from '@tanstack/react-router'
import { ErrorState, EmptyState } from '@monobase/ui'
import type { PayState } from './use-pay-link'

type PayResultState = Extract<
  PayState,
  { kind: 'succeeded' | 'alreadyPaid' | 'expired' | 'invalid' | 'notConfigured' | 'temporaryError' }
>

interface PayResultProps {
  state: PayResultState
  onRetry?: () => void
}

// Terminal state UI (DESIGN.md): role="alert" on all error states (built into
// ErrorState), positive states via EmptyState. Every icon has a text label.
export function PayResult({ state, onRetry }: PayResultProps) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <ResultContent state={state} onRetry={onRetry} />
      </div>
    </main>
  )
}

// Inline icon nodes — decorative, aria-hidden. No lucide-react dep needed
// (lucide-react is not resolvable from app-level code in this Bun workspace).
const SuccessIcon = (
  <span aria-hidden="true" className="text-amount text-success">
    ✓
  </span>
)
const InfoIcon = (
  <span aria-hidden="true" style={{ fontSize: '2rem', color: 'var(--color-primary)' }}>
    ℹ
  </span>
)

function ResultContent({ state, onRetry }: PayResultProps) {
  switch (state.kind) {
    case 'succeeded':
      return (
        <>
          <EmptyState
            icon={SuccessIcon}
            headline="Payment successful"
            description="Your dues payment has been received. You'll get a receipt by email."
          />
          {/* Funnel CTA — sign-in is login-free upsell post payment (DESIGN.md) */}
          <Link
            to="/sign-in"
            className="mt-4 flex min-h-tap items-center justify-center text-center text-body text-primary underline"
          >
            Create an account to track your dues
          </Link>
        </>
      )
    case 'alreadyPaid':
      return (
        <EmptyState
          icon={InfoIcon}
          headline="Already paid"
          description="This payment has already been processed. No further action needed."
        />
      )
    // Error states: ErrorState already sets role="alert" aria-live="polite"
    case 'expired':
      return (
        <ErrorState message="This payment link has expired. Please ask your chapter officer for a new one." />
      )
    case 'invalid':
      return (
        <ErrorState message="This payment link is invalid or has been revoked. Please contact your chapter officer." />
      )
    case 'notConfigured':
      return (
        <ErrorState message="Online payment is not yet set up for this chapter. Please contact your chapter officer." />
      )
    case 'temporaryError':
      return (
        <ErrorState
          message="Something went wrong. Please try again."
          onRetry={onRetry}
        />
      )
  }
}
