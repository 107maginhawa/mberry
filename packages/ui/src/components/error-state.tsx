import { AlertCircle } from "lucide-react"
import { Button } from "./button"

interface ErrorStateProps {
  message: string
  onRetry?: () => void
  // bare: drop the bordered/tinted box so the error fills its parent (e.g. a Card
  // body) without a second frame. Nested cards are always wrong (DESIGN.md).
  bare?: boolean
}

// Error UI state (DESIGN.md): role="alert" so it's announced; retry affordance.
export function ErrorState({ message, onRetry, bare = false }: ErrorStateProps) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={
        bare
          ? "flex flex-col items-center gap-3 py-8 px-4 text-center"
          : "flex flex-col items-center gap-3 p-6 rounded-md border border-[var(--color-error-bg)] bg-[var(--color-error-bg)] text-center"
      }
    >
      <AlertCircle className="h-8 w-8 text-[var(--color-error)]" aria-hidden="true" />
      <p className="text-body text-[var(--color-error)]">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
