/**
 * Billing date computation utilities.
 *
 * Computes upcoming billing dates based on frequency, cycle start month,
 * and due date day. Used by BillingSchedulePreview card and config form.
 */

export type BillingFrequency = 'annual' | 'semi-annual' | 'quarterly'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

/**
 * How many billing dates per year for each frequency.
 */
const DATES_PER_YEAR: Record<BillingFrequency, number> = {
  annual: 1,
  'semi-annual': 2,
  quarterly: 4,
}

/**
 * Month interval between billing dates for each frequency.
 */
const MONTH_INTERVAL: Record<BillingFrequency, number> = {
  annual: 12,
  'semi-annual': 6,
  quarterly: 3,
}

/**
 * Compute upcoming billing dates from configuration.
 *
 * @param frequency - annual, semi-annual, or quarterly
 * @param cycleStartMonth - 1-12, the month the billing cycle starts
 * @param dueDateDay - 1-28, the day of month dues are due
 * @param count - number of dates to return (default 8)
 * @returns Array of Date objects for upcoming billing dates
 */
export function computeBillingDates(
  frequency: BillingFrequency,
  cycleStartMonth: number,
  dueDateDay: number,
  count: number = 8,
): Date[] {
  const month = Math.max(1, Math.min(12, cycleStartMonth))
  const day = Math.max(1, Math.min(28, dueDateDay))
  const interval = MONTH_INTERVAL[frequency]

  const now = new Date()
  const dates: Date[] = []

  // Generate billing months starting from cycleStartMonth, stepping by interval.
  // We look far enough ahead to find `count` dates that are >= today.
  // Start from current year - 1 to catch near-future dates.
  const startYear = now.getFullYear() - 1

  for (let yearOffset = 0; yearOffset < count + 3 && dates.length < count; yearOffset++) {
    for (let i = 0; i < 12 / interval && dates.length < count; i++) {
      const billingMonth = ((month - 1) + i * interval) % 12 // 0-indexed
      const billingYear = startYear + yearOffset + Math.floor(((month - 1) + i * interval) / 12)
      const date = new Date(billingYear, billingMonth, day)

      if (date >= now) {
        dates.push(date)
      }
    }
  }

  return dates
}

/**
 * Format a billing schedule as a human-readable string.
 * Backward-compatible text formatter for inline use.
 *
 * @param frequency - annual, semi-annual, or quarterly
 * @param cycleStartMonth - 1-12
 * @param dueDateDay - 1-28
 * @returns Formatted string like "Annual billing — due January 15"
 */
export function formatBillingSchedule(
  frequency: BillingFrequency,
  cycleStartMonth: number,
  dueDateDay: number,
): string {
  const month = Math.max(1, Math.min(12, cycleStartMonth))
  const day = Math.max(1, Math.min(28, dueDateDay))
  const monthName = MONTH_NAMES[month - 1]

  const labels: Record<BillingFrequency, string> = {
    annual: 'Annual',
    'semi-annual': 'Semi-annual',
    quarterly: 'Quarterly',
  }

  const label = labels[frequency]

  if (frequency === 'annual') {
    return `${label} billing — due ${monthName} ${day}`
  }

  const perYear = DATES_PER_YEAR[frequency]
  return `${label} billing (${perYear}x/year) — starting ${monthName} ${day}`
}
