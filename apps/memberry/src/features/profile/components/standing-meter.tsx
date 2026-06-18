import { useState } from 'react'
import { X, Check, ChevronRight } from 'lucide-react'
import { Button } from '@monobase/ui'

export interface StandingMeterProps {
  person: {
    firstName?: string | null
    lastName?: string | null
    avatar?: { url?: string } | null
    licenseNumber?: string | null
    specialization?: string | null
    contactInfo?: { phone?: string } | null
    bio?: string | null
  }
  duesStatus?: 'current' | null
  onAction?: (action: string) => void
}

interface CriterionDef {
  key: string
  label: string
  pendingLabel: string
  check: (p: StandingMeterProps['person'], dues?: string | null) => boolean
}

const CRITERIA: CriterionDef[] = [
  {
    key: 'photo',
    label: 'Profile photo',
    pendingLabel: 'Upload profile photo',
    check: (p) => !!p.avatar?.url,
  },
  {
    key: 'name',
    label: 'Full name',
    pendingLabel: 'Complete your name',
    check: (p) => !!(p.firstName && p.lastName),
  },
  {
    key: 'license',
    label: 'License number',
    pendingLabel: 'Add license number',
    check: (p) => !!p.licenseNumber,
  },
  {
    key: 'specialization',
    label: 'Specialization',
    pendingLabel: 'Select specialization',
    check: (p) => !!p.specialization,
  },
  {
    key: 'contact',
    label: 'Contact info',
    pendingLabel: 'Add phone number',
    check: (p) => !!p.contactInfo?.phone,
  },
  {
    key: 'bio',
    label: 'Bio',
    pendingLabel: 'Write a bio',
    check: (p) => !!p.bio,
  },
  {
    key: 'dues',
    label: 'Dues current',
    pendingLabel: 'Pay dues to become current',
    check: (_p, dues) => dues === 'current',
  },
]

type Tier = 'Beginner' | 'Active' | 'Verified' | 'Exemplary'

function getTier(completed: number, total: number): Tier {
  const pct = completed / total
  if (pct >= 1) return 'Exemplary'
  if (pct >= 0.7) return 'Verified'
  if (pct >= 0.4) return 'Active'
  return 'Beginner'
}

const TIER_COLORS: Record<Tier, string> = {
  Beginner: 'bg-[var(--color-muted)]',
  Active: 'bg-[var(--color-info)]',
  Verified: 'bg-[var(--color-success)]',
  Exemplary: 'bg-[var(--color-warning)]',
}

const TIER_TEXT_COLORS: Record<Tier, string> = {
  Beginner: 'text-[var(--color-muted)]',
  Active: 'text-[var(--color-info)]',
  Verified: 'text-[var(--color-success)]',
  Exemplary: 'text-[var(--color-warning)]',
}

export function StandingMeter({ person, duesStatus, onAction }: StandingMeterProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const results = CRITERIA.map((c) => ({
    ...c,
    completed: c.check(person, duesStatus),
  }))

  const completed = results.filter((r) => r.completed).length
  const total = results.length
  const tier = getTier(completed, total)
  const pending = results.filter((r) => !r.completed)

  return (
    <div className="rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface-elevated)] p-5 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${TIER_TEXT_COLORS[tier]}`}>{tier}</span>
          <span className="text-xs text-[var(--color-muted)]">
            {completed}/{total} complete
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss standing meter"
          className="h-7 w-7"
        >
          <X className="w-4 h-4 text-[var(--color-muted)]" />
        </Button>
      </div>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemax={total}
        aria-label="Profile completeness"
        className="h-2 rounded-full bg-[var(--color-surface-warm)] overflow-hidden mb-4"
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${TIER_COLORS[tier]}`}
          style={{ width: `${(completed / total) * 100}%` }}
        />
      </div>

      {/* Pending items */}
      {pending.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {pending.map((item) => (
            <Button
              key={item.key}
              variant="ghost"
              onClick={() => onAction?.(item.key)}
              className="flex items-center justify-between w-full text-left text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] py-1 px-1 h-auto"
            >
              <span>{item.pendingLabel}</span>
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            </Button>
          ))}
        </div>
      )}

      {/* Benefit nudge */}
      {tier !== 'Exemplary' && tier !== 'Verified' && (
        <p className="text-xs text-[var(--color-muted)] italic">
          Verified members appear in the public directory
        </p>
      )}
    </div>
  )
}
