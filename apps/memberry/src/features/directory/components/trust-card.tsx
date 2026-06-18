import { Link } from '@tanstack/react-router'
import { ShieldCheck, GraduationCap, BadgeCheck } from 'lucide-react'
import { GlassCard } from '@/components/motion/glass-card'

interface TrustSignals {
  duesStatus: 'current' | null
  credentialCount: number
  ceCreditsEarned: number
  hasVerifiedLicense: boolean
}

interface TrustCardProps {
  profile: {
    id: string
    personId: string
    displayName: string
    title?: string | null
    specialty?: string | null
    location?: string | null
    photoUrl?: string | null
    trustSignals?: TrustSignals
  }
  orgSlug: string
}

export function TrustCard({ profile, orgSlug }: TrustCardProps) {
  const ts = profile.trustSignals

  return (
    <Link
      to="/org/$orgSlug/directory/$personId"
      params={{ orgSlug, personId: profile.personId }}
      className="block"
    >
      <GlassCard className="p-4 space-y-3 hover:shadow-md transition-shadow cursor-pointer">
        {/* Header: avatar + name */}
        <div className="flex items-center gap-3">
          {profile.photoUrl ? (
            <img
              src={profile.photoUrl}
              alt={profile.displayName || 'Member'}
              className="w-11 h-11 rounded-full object-cover"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-[var(--color-surface-warm)] flex items-center justify-center text-sm font-semibold text-[var(--color-primary)]">
              {(profile.displayName || '?')[0]}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm truncate">{profile.displayName}</span>
              {ts?.hasVerifiedLicense && (
                <ShieldCheck className="w-4 h-4 text-[var(--color-success)] shrink-0" aria-label="Verified license" />
              )}
            </div>
            {profile.title && (
              <div className="text-xs text-[var(--color-muted)] truncate">{profile.title}</div>
            )}
          </div>
        </div>

        {/* Info: specialty + location (always shown) */}
        <div className="space-y-0.5">
          {profile.specialty && (
            <div className="text-xs text-[var(--color-muted)]">{profile.specialty}</div>
          )}
          {profile.location && (
            <div className="text-xs text-[var(--color-muted)]">{profile.location}</div>
          )}
        </div>

        {/* Trust badges (only shown if data exists) */}
        {ts && (ts.duesStatus || ts.ceCreditsEarned > 0 || ts.credentialCount > 0) && (
          <div className="flex items-center gap-2 pt-1 border-t border-[var(--color-border-light)]">
            {ts.duesStatus === 'current' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)]">
                <BadgeCheck className="w-3 h-3" />
                Current
              </span>
            )}
            {ts.ceCreditsEarned > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-info-bg)] text-[var(--color-info)]">
                <GraduationCap className="w-3 h-3" />
                {ts.ceCreditsEarned} CE
              </span>
            )}
            {ts.credentialCount > 0 && (
              <span className="text-[10px] font-medium text-[var(--color-muted)]">
                {ts.credentialCount} credential{ts.credentialCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </GlassCard>
    </Link>
  )
}
