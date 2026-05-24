import { GlassCard } from '@/components/motion/glass-card'
import { computeBillingDates, type BillingFrequency } from '../lib/billing-dates'
import { formatCents } from '../lib/money'

export interface BillingSchedulePreviewProps {
  frequency: BillingFrequency
  cycleStartMonth: number // 1-12
  dueDateDay: number // 1-28
  amount?: number // cents
  currency?: string // default PHP
  gracePeriodDays?: number
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}

/**
 * Visual preview card showing upcoming billing dates as a timeline.
 * Replaces inline computed date text in the config form.
 */
export function BillingSchedulePreview({
  frequency,
  cycleStartMonth,
  dueDateDay,
  amount,
  currency = 'PHP',
  gracePeriodDays,
}: BillingSchedulePreviewProps) {
  if (!frequency) {
    return (
      <GlassCard className="p-4">
        <p className="text-sm text-[var(--color-muted)]">
          Configure billing frequency to see schedule
        </p>
      </GlassCard>
    )
  }

  const dates = computeBillingDates(frequency, cycleStartMonth, dueDateDay, 6)

  return (
    <GlassCard className="p-4 space-y-3">
      <h4 className="text-sm font-semibold">Billing Schedule</h4>

      {dates.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">
          Configure billing frequency to see schedule
        </p>
      ) : (
        <ul className="space-y-1.5" role="list" aria-label="Upcoming billing dates">
          {dates.map((date, i) => (
            <li key={i} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full bg-[var(--color-primary)]"
                  aria-hidden="true"
                />
                {date.toLocaleDateString('en-US', DATE_FORMAT)}
              </span>
              {amount != null && amount > 0 && (
                <span className="text-[var(--color-muted)] tabular-nums">
                  {formatCents(amount, currency)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {gracePeriodDays != null && gracePeriodDays > 0 && (
        <p className="text-xs text-[var(--color-muted)] pt-1 border-t border-[var(--color-surface-border-glass)]">
          {gracePeriodDays}-day grace period after each due date
        </p>
      )}
    </GlassCard>
  )
}
