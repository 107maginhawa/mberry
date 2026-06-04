import { Link } from '@tanstack/react-router'
import { Award, BookOpen } from 'lucide-react'
import { CreditRing } from './action-widget'
import { EmptyState } from '@/components/patterns/empty-state'
import { GlassCard } from '@/components/motion/glass-card'
import { CountUp } from '@/components/motion/count-up'

interface CreditBreakdownProps {
  totalCredits: number
  requiredCredits: number
  isError?: boolean
}

export function CreditBreakdown({ totalCredits, requiredCredits, isError }: CreditBreakdownProps) {
  const deficit = requiredCredits > 0 ? Math.max(0, requiredCredits - totalCredits) : 0

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Award size={20} className="text-[var(--color-muted)]" aria-hidden="true" />
          <h3 className="text-h4">Credit Progress</h3>
        </div>
        <Link to="/my/credits" className="text-xs font-semibold text-[var(--color-primary)] hover:underline">
          View transcript
        </Link>
      </div>

      {isError ? (
        <p role="alert" aria-live="polite" className="text-sm text-[var(--color-error)]">Unable to load credit data</p>
      ) : totalCredits === 0 ? (
        <EmptyState
          headline="No credits yet"
          description="Complete trainings and events to earn CPD credits"
        />
      ) : (
        <div>
          <div className="flex items-center gap-4 mb-4">
            {/* oli-ui: exempt-icon-size — hero illustration (CreditRing data viz) */}
            <CreditRing earned={totalCredits} required={requiredCredits || totalCredits} size={64} />
            <div>
              <p className="text-2xl font-bold font-display text-[var(--color-primary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <CountUp value={totalCredits} />
                {requiredCredits > 0 && (
                  <span className="text-sm font-medium text-[var(--color-muted)]">/<CountUp value={requiredCredits} /></span>
                )}
              </p>
              <p className="text-xs font-medium text-[var(--color-muted)]">
                {deficit > 0
                  ? `${deficit} more credit${deficit !== 1 ? 's' : ''} needed`
                  : requiredCredits > 0
                    ? 'Requirement met'
                    : 'total CPD credits'
                }
              </p>
            </div>
          </div>

          <Link
            to="/my/training"
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)] hover:underline"
          >
            <BookOpen size={12} aria-hidden="true" />
            Earn more credits
          </Link>
        </div>
      )}
    </GlassCard>
  )
}
