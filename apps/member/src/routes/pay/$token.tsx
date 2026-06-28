import { createFileRoute } from '@tanstack/react-router'
import { Skeleton } from '@monobase/ui'
import { usePayLink } from '@/features/pay/use-pay-link'
import { PayCard } from '@/features/pay/PayCard'
import { PayResult } from '@/features/pay/PayResult'

// Plain search validator — no zod dep. Coerces the raw query-string value to
// the union type; anything else becomes undefined (safe, not a throw).
function validateSearch(search: Record<string, unknown>): { status?: 'success' | 'cancelled' } {
  const s = search.status
  return {
    status: s === 'success' || s === 'cancelled' ? s : undefined,
  }
}

export const Route = createFileRoute('/pay/$token')({
  validateSearch,
  component: PayTokenPage,
})

function PayTokenPage() {
  const { token } = Route.useParams()
  const { status } = Route.useSearch()
  const { state, pay } = usePayLink(token, { returnStatus: status })

  if (state.kind === 'loading') {
    return (
      <main
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
      </main>
    )
  }

  if (state.kind === 'paying') {
    return (
      <main
        role="status"
        aria-label="Processing payment"
        className="min-h-screen flex items-center justify-center bg-background p-4"
      >
        <p className="text-body text-muted-foreground animate-pulse">Processing your payment…</p>
      </main>
    )
  }

  if (state.kind === 'payable' || state.kind === 'cancelled') {
    return <PayCard state={state} paying={false} onPay={pay} />
  }

  return (
    <PayResult
      state={state}
      onRetry={state.kind === 'temporaryError' ? pay : undefined}
    />
  )
}
