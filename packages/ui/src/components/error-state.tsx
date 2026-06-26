import { AlertCircle } from "lucide-react"
import { Button } from "./button"

interface ErrorStateProps {
  message: string
  onRetry?: () => void
}

// Error UI state (DESIGN.md): role="alert" so it's announced; retry affordance.
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex flex-col items-center gap-3 p-6 rounded-md border border-[var(--color-error-bg)] bg-[var(--color-error-bg)] text-center"
    >
      <AlertCircle className="h-8 w-8 text-[var(--color-error)]" aria-hidden="true" />
      <p className="text-body text-[var(--color-error)]">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
