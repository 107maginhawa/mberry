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
// ponytail: z-10 is enough — Radix modals/toasts portal above their own stacking
// context; promote to a z-index token scale if real overlap appears.
export function AppHeader({ title, nav, onSignOut, signingOut }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <span className="text-large font-semibold text-foreground">{title}</span>
        <div className="flex items-center gap-2">
          {nav}
          {onSignOut && (
            <Button
              variant="ghost"
              size="sm"
              className="min-h-tap text-muted-foreground"
              disabled={signingOut}
              onClick={onSignOut}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
