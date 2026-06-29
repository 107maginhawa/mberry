import { Link } from '@tanstack/react-router'
import { EmptyState } from '@monobase/ui'

// App-wide 404 (registered as the router's defaultNotFoundComponent in main.tsx).
// Calm, plain-language dead-end recovery for non-technical officers (DESIGN.md):
// one primary task — get back to a known place (the roster). No icon-only controls.
export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-6 text-center">
        <EmptyState
          headline="Page not found"
          description="We couldn't find the page you were looking for. It may have moved or the link was mistyped."
        />
        <Link
          to="/"
          className="inline-flex min-h-tap items-center justify-center rounded-md bg-primary px-6 text-body font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          Go to roster
        </Link>
      </div>
    </div>
  )
}
