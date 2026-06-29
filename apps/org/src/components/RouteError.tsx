import { Link } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { ErrorState } from '@monobase/ui'

// App-wide render-error fallback (registered as the router's
// defaultErrorComponent in main.tsx). Any unexpected throw during a route's
// render lands here instead of a blank white screen.
//
// DESIGN.md plain-language law: never show a raw error message / stack to the
// user (non-technical older dentists). We surface a calm, fixed sentence and a
// path OUT (retry via the router's reset, or home). The raw error goes to the
// console for developers only.
export function RouteError({ error, reset }: ErrorComponentProps) {
  console.error('[RouteError] route render threw:', error)
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-6 text-center">
        <ErrorState message="Something went wrong on this page." onRetry={reset} />
        <Link
          to="/"
          className="inline-flex min-h-tap items-center justify-center text-body font-medium text-[var(--color-primary)] underline underline-offset-4 hover:opacity-90"
        >
          Go to roster
        </Link>
      </div>
    </div>
  )
}
