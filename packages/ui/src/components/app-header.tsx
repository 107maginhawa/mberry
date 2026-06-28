import type { ReactNode } from "react"
import { Button } from "./button"

interface AppHeaderProps {
  /** App or section title shown at the left (orientation — answers "where am I?"). */
  title: string
  /** Optional nav slot (links/menu) rendered before the sign-out action. */
  nav?: ReactNode
  /** Sign-out handler. When provided, a labeled "Sign out" button is shown. */
  onSignOut?: () => void
  signingOut?: boolean
}

// Shared authed-app chrome (console + org). Gives every authed screen a persistent
// header with orientation + the "emergency exit" sign-out (Nielsen #3). One
// component, no per-app fork (DESIGN.md). Tokens + ≥48px tap targets.
//
// Title + sign-out share the top row; nav (when given) sits on its own row that
// scrolls horizontally so many links survive a phone width without wrapping.
// ponytail: z-10 is enough — Radix modals/toasts portal above their own stacking
// context; promote to a z-index token scale if real overlap appears.
export function AppHeader({ title, nav, onSignOut, signingOut }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-center justify-between gap-4 py-3">
          <span className="text-large font-semibold text-foreground">{title}</span>
          {onSignOut && (
            <Button
              variant="ghost"
              className="text-muted-foreground"
              disabled={signingOut}
              onClick={onSignOut}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          )}
        </div>
        {nav && (
          <nav
            aria-label="Primary"
            className="flex items-center gap-4 overflow-x-auto whitespace-nowrap pb-2"
          >
            {nav}
          </nav>
        )}
      </div>
    </header>
  )
}
