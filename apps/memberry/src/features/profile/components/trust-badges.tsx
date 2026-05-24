import { ShieldCheck, GraduationCap, BadgeCheck } from 'lucide-react'

export interface TrustSignals {
  duesStatus: 'current' | null
  credentialCount: number
  ceCreditsEarned: number
  hasVerifiedLicense: boolean
}

interface TrustBadgesProps {
  signals?: TrustSignals
}

export function TrustBadges({ signals }: TrustBadgesProps) {
  if (!signals) return null

  const { duesStatus, credentialCount, ceCreditsEarned, hasVerifiedLicense } = signals
  const hasAnything = duesStatus || ceCreditsEarned > 0 || credentialCount > 0 || hasVerifiedLicense
  if (!hasAnything) return null

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      {duesStatus === 'current' && (
        <span
          aria-label="Dues current"
          className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)]"
        >
          <BadgeCheck className="w-3.5 h-3.5" />
          Current
        </span>
      )}
      {ceCreditsEarned > 0 && (
        <span
          aria-label={`${ceCreditsEarned} continuing education credits`}
          className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[var(--color-info-bg)] text-[var(--color-info)]"
        >
          <GraduationCap className="w-3.5 h-3.5" />
          {ceCreditsEarned} CE
        </span>
      )}
      {credentialCount > 0 && (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[var(--color-surface-warm)] text-[var(--color-muted)]">
          {credentialCount} credential{credentialCount !== 1 ? 's' : ''}
        </span>
      )}
      {hasVerifiedLicense && (
        <ShieldCheck
          className="w-4 h-4 text-[var(--color-success)]"
          aria-label="Verified license"
        />
      )}
    </div>
  )
}
