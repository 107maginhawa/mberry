import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronDown, Users } from 'lucide-react'
import { Button } from '@monobase/ui'

type ActionPriority = 0 | 1 | 2
type ActionVariant = 'error' | 'warning' | 'info' | 'success'

export interface ActionItem {
  id: string
  icon: React.ReactNode
  title: string
  description: string
  href: string
  priority: ActionPriority
  variant: ActionVariant
}

interface ActionQueueProps {
  items: ActionItem[]
  maxVisible?: number
}

const VARIANT_STYLES: Record<ActionVariant, string> = {
  error: 'border-[var(--color-error-bg)] bg-[var(--color-error-bg)]',
  warning: 'border-[var(--color-warning-bg)] bg-[var(--color-warning-bg)]',
  info: 'border-[var(--color-info-bg)] bg-[var(--color-info-bg)]',
  success: 'border-[var(--color-success-bg)] bg-[var(--color-success-bg)]',
}

export function ActionQueue({ items, maxVisible = 5 }: ActionQueueProps) {
  const [expanded, setExpanded] = useState(false)

  // Sort by priority (P0 first), then by variant severity
  const sorted = [...items].sort((a, b) => a.priority - b.priority)

  const hasP0orP1 = sorted.some((item) => item.priority <= 1)
  const visible = expanded ? sorted : sorted.slice(0, maxVisible)
  const hiddenCount = sorted.length - maxVisible

  // "All clear" when no P0/P1 items
  if (sorted.length === 0 || !hasP0orP1) {
    return (
      <section className="space-y-3">
        <h2 className="text-h4 mb-2">
          Action Items
          {sorted.length > 0 && (
            <span className="ml-2 text-xs font-medium text-[var(--color-muted)] bg-[var(--color-surface-elevated)] px-2 py-0.5 rounded-full">
              {sorted.length}
            </span>
          )}
        </h2>

        <div className="rounded-[12px] border border-[var(--color-success-bg)] bg-[var(--color-success-bg)] p-5 flex items-center gap-3">
          <Users size={20} className="text-[var(--color-success)] shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[var(--color-success)]">All clear</p>
            <p className="text-sm font-medium text-[var(--color-muted)]">
              No urgent action items. Keep up the great work!
            </p>
          </div>
        </div>

        {/* Still show P2 items below the banner */}
        {sorted.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-3">
            {sorted.slice(0, maxVisible).map((item) => (
              <ActionCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <h2 className="text-h4 mb-2">
        Action Items
        <span className="ml-2 text-xs font-medium text-[var(--color-on-primary)] bg-[var(--color-error)] px-2 py-0.5 rounded-full">
          {sorted.length}
        </span>
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {visible.map((item) => (
          <ActionCard key={item.id} item={item} />
        ))}
      </div>

      {hiddenCount > 0 && !expanded && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] hover:underline mt-2"
        >
          View {hiddenCount} more item{hiddenCount !== 1 ? 's' : ''}
          <ChevronDown size={14} />
        </Button>
      )}
    </section>
  )
}

function ActionCard({ item }: { item: ActionItem }) {
  return (
    <Link
      to={item.href as any}
      className={`block rounded-[12px] border p-4 hover:shadow-soft transition-shadow ${VARIANT_STYLES[item.variant]}`}
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0 mt-0.5">{item.icon}</span>
        <div>
          <p className="text-sm font-semibold">{item.title}</p>
          <p className="text-sm font-medium text-[var(--color-muted)] mt-0.5">{item.description}</p>
        </div>
      </div>
      <p className="text-xs font-semibold text-[var(--color-primary)] mt-3">View &rarr;</p>
    </Link>
  )
}
