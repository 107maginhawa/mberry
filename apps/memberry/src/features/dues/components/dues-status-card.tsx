import { Button } from '@monobase/ui'
import { GlassCard } from '@/components/motion/glass-card'
import { formatCents } from '@/features/dues/lib/money'
import { Calendar, Clock, CreditCard } from 'lucide-react'

const STATUS_CONFIG = {
  active: {
    label: 'Active',
    dotClass: 'bg-[var(--color-success)]',
    badgeClass: 'text-[var(--color-success)] bg-[var(--color-success-bg)]',
  },
  gracePeriod: {
    label: 'Grace Period',
    dotClass: 'bg-[var(--color-warning)]',
    badgeClass: 'text-[var(--color-warning)] bg-[var(--color-warning-bg)]',
  },
  lapsed: {
    label: 'Lapsed',
    dotClass: 'bg-[var(--color-error)]',
    badgeClass: 'text-[var(--color-error)] bg-[var(--color-error-bg)]',
  },
  overdue: {
    label: 'Overdue',
    dotClass: 'bg-[var(--color-error)]',
    badgeClass: 'text-[var(--color-error)] bg-[var(--color-error-bg)]',
  },
  pendingPayment: {
    label: 'Pending Payment',
    dotClass: 'bg-[var(--color-info)]',
    badgeClass: 'text-[var(--color-info)] bg-[var(--color-info-bg)]',
  },
} as const

export interface DuesStatusCardProps {
  status: 'active' | 'gracePeriod' | 'lapsed' | 'overdue' | 'pendingPayment'
  expiryDate?: string // ISO date — optional for new members
  nextPaymentAmount?: number // cents
  nextPaymentDueDate?: string // ISO date
  currency?: string // default 'PHP'
  onPayNow?: () => void
}

function getDaysRemaining(expiryDate: string): number {
  const expiry = new Date(expiryDate)
  return Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
  })
}

export function DuesStatusCard({
  status,
  expiryDate,
  nextPaymentAmount,
  nextPaymentDueDate,
  currency = 'PHP',
  onPayNow,
}: DuesStatusCardProps) {
  const config = STATUS_CONFIG[status]
  const daysRemaining = expiryDate ? getDaysRemaining(expiryDate) : NaN
  const hasValidExpiry = !Number.isNaN(daysRemaining)
  const isOverdue = hasValidExpiry && daysRemaining < 0

  return (
    <GlassCard className="p-5">
      {/* Header row: status badge + valid-until */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <span
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[12px] font-semibold ${config.badgeClass}`}
          aria-label={`Membership status: ${config.label}`}
        >
          <span className={`w-2 h-2 rounded-full ${config.dotClass}`} />
          {config.label}
        </span>
        <span className="text-[13px] text-[var(--color-muted)] flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          {expiryDate ? `Valid until ${formatDate(expiryDate)}` : 'No expiry set'}
        </span>
      </div>

      {/* Details row */}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          {/* Next payment info */}
          {nextPaymentAmount != null && nextPaymentDueDate ? (
            <p className="text-[14px] text-[var(--color-text)] flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-[var(--color-muted)]" />
              Next payment: <span className="font-semibold">{formatCents(nextPaymentAmount, currency)}</span>
              <span className="text-[var(--color-muted)] ml-1">
                Due: {formatShortDate(nextPaymentDueDate)}
              </span>
            </p>
          ) : (
            <p className="text-[14px] text-[var(--color-muted)] flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-[var(--color-muted)]" />
              No upcoming payment
            </p>
          )}

          {/* Days remaining / overdue */}
          <p
            className="text-[13px] text-[var(--color-muted)] flex items-center gap-1.5"
            role="status"
            aria-live="polite"
          >
            <Clock className="w-3.5 h-3.5" />
            {!hasValidExpiry
              ? 'No expiry set'
              : isOverdue
                ? `${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? 's' : ''} overdue`
                : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`}
          </p>
        </div>

        {/* Pay Now button */}
        {onPayNow && (
          <Button onClick={onPayNow} size="sm">
            Pay Now
          </Button>
        )}
      </div>
    </GlassCard>
  )
}
