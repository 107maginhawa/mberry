import type { ReactNode } from "react"
import { Button } from '@monobase/ui'

interface EmptyStateProps {
  icon?: ReactNode
  headline: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon, headline, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && <div className="text-[var(--color-primary-lighter)] mb-4">{icon}</div>}
      <h3 className="text-h3 text-[var(--color-primary)]">{headline}</h3>
      {description && (
        <p className="text-[14px] text-[var(--color-muted)] mt-2 max-w-[400px]">{description}</p>
      )}
      {action && (
        <Button
          onClick={action.onClick}
          className="mt-4"
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}
