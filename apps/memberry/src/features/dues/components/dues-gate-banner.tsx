import { Link } from '@tanstack/react-router'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@monobase/ui'
import type { FinancialStanding } from '@/hooks/use-financial-standing'

interface DuesGateBannerProps {
  standing: FinancialStanding
  orgSlug: string
  feature: string
  daysOverdue?: number | null
}

/**
 * Banner shown on gated pages when user's dues are not in good standing.
 * Blocks access to features like event registration, voting, certificates.
 */
export function DuesGateBanner({ standing, orgSlug, feature, daysOverdue }: DuesGateBannerProps) {
  if (standing === 'good' || standing === 'unknown') return null

  const isSuspended = standing === 'suspended'
  const message = isSuspended
    ? `Your membership is suspended. ${feature} is unavailable until your membership is restored.`
    : daysOverdue && daysOverdue > 90
      ? `Your dues are ${daysOverdue} days overdue. ${feature} is restricted until your dues are current.`
      : `Your dues are overdue. ${feature} requires current dues status.`

  return (
    <div className="rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning-bg)] p-4 flex items-start gap-3" role="alert">
      <AlertTriangle className="h-5 w-5 text-[var(--color-warning)] shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-[var(--color-warning)] font-medium">{message}</p>
        <div className="mt-2">
          <Link to={`/org/${orgSlug}/dues` as any}>
            <Button variant="warning" size="sm">
              Pay Dues Now
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
