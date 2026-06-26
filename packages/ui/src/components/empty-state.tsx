import type { ReactNode } from "react"
import { Button } from "./button"

interface EmptyStateProps {
  icon?: ReactNode
  headline: string
  description?: string
  action?: { label: string; onClick: () => void }
}

// Empty UI state (DESIGN.md): icon + headline + description + optional action.
export function EmptyState({ icon, headline, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && <div className="text-[var(--color-primary-lighter)] mb-4">{icon}</div>}
      <h3 className="text-section text-[var(--color-primary)]">{headline}</h3>
      {description && (
        <p className="text-body text-[var(--color-muted)] mt-2 max-w-[400px]">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} className="mt-4">
          {action.label}
        </Button>
      )}
    </div>
  )
}
