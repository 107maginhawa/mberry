import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, GraduationCap, BadgeCheck, Mail, Phone, Globe, ArrowLeft, Award } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { api } from '@/lib/api'
import { GlassCard } from '@/components/motion/glass-card'
import { ListSkeleton } from '@/components/patterns/skeleton-loader'
import { StatusBadge } from '@/components/patterns/status-badge'

interface MemberProfileProps {
  personId: string
  orgId: string
  orgSlug: string
}

interface ProfessionalLicense {
  id: string
  licenseType: string
  licenseNumber: string
  issuingAuthority: string
  jurisdiction: string
  status: string
  issuedDate: string
  expirationDate: string
  verifiedAt?: string | null
  verifiedBy?: string | null
}

export function MemberProfile({ personId, orgId, orgSlug }: MemberProfileProps) {
  // Fetch profile via public endpoint
  const profileQuery = useQuery({
    queryKey: ['directory-profile', orgId, personId],
    queryFn: async () => {
      const data = await api.get<any>(
        `/api/association/member/directory/search/${personId}/public`,
      )
      return data
    },
    retry: false,
  })

  // Fetch trust signals for this specific person via search
  const trustQuery = useQuery({
    queryKey: ['directory-trust', orgId, personId],
    queryFn: async () => {
      const data = await api.get<any>(
        `/api/association/member/directory/search?q=&limit=50`,
        { 'x-org-id': orgId },
      )
      const enriched = (data?.data ?? []).find((p: any) => p.personId === personId)
      return enriched?.trustSignals ?? null
    },
    retry: false,
  })

  // Fetch professional licenses (privacy-gated by backend)
  const licensesQuery = useQuery({
    queryKey: ['member-licenses', orgId, personId],
    queryFn: async () => {
      const data = await api.get<{ data: ProfessionalLicense[] }>(
        `/api/association/member/licenses?personId=${encodeURIComponent(personId)}`,
        { 'x-org-id': orgId },
      )
      return data?.data ?? []
    },
    retry: false,
  })

  // Fetch CE credits
  const creditsQuery = useQuery({
    queryKey: ['member-credits', orgId, personId],
    queryFn: async () => {
      const data = await api.get<{ data: Array<{ credits: number; courseTitle?: string; earnedAt?: string }> }>(
        `/api/association/member/credits?personId=${encodeURIComponent(personId)}`,
        { 'x-org-id': orgId },
      )
      return data?.data ?? []
    },
    retry: false,
  })

  const profile = profileQuery.data
  const ts = trustQuery.data
  const licenses = licensesQuery.data ?? []
  const credits = creditsQuery.data ?? []
  const totalCredits = credits.reduce((sum: number, c: any) => sum + (c.credits || 0), 0)

  if (profileQuery.isLoading) {
    return <GlassCard className="p-6"><ListSkeleton rows={6} /></GlassCard>
  }

  if (profileQuery.isError || !profile) {
    return (
      <div className="space-y-4">
        <Link to="/org/$orgSlug/directory" params={{ orgSlug }} className="inline-flex items-center gap-1.5 text-sm text-[var(--color-primary)] hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to directory
        </Link>
        <GlassCard className="p-6 text-center">
          <p className="text-[var(--color-muted)]">Profile not found or not visible.</p>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Link to="/org/$orgSlug/directory" params={{ orgSlug }} className="inline-flex items-center gap-1.5 text-sm text-[var(--color-primary)] hover:underline">
        <ArrowLeft className="w-4 h-4" /> Back to directory
      </Link>

      {/* Hero section */}
      <GlassCard className="p-6">
        <div className="flex items-start gap-4">
          {profile.photoUrl ? (
            <img src={profile.photoUrl} alt={profile.displayName || 'Member'} className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[var(--color-surface-warm)] flex items-center justify-center text-2xl font-semibold text-[var(--color-primary)]">
              {(profile.displayName || '?')[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{profile.displayName}</h2>
              {ts?.hasVerifiedLicense && (
                <ShieldCheck className="w-5 h-5 text-[var(--color-success)]" aria-label="Verified license" />
              )}
            </div>
            {profile.title && <p className="text-sm text-[var(--color-muted)] mt-0.5">{profile.title}</p>}
            {profile.specialty && <p className="text-sm text-[var(--color-muted)]">{profile.specialty}</p>}
            {profile.location && <p className="text-sm text-[var(--color-muted)]">{profile.location}</p>}

            {/* Trust badges */}
            {ts && (ts.duesStatus || ts.ceCreditsEarned > 0 || ts.credentialCount > 0) && (
              <div className="flex items-center gap-2 mt-3">
                {ts.duesStatus === 'current' && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)]">
                    <BadgeCheck className="w-3.5 h-3.5" /> Current Member
                  </span>
                )}
                {ts.ceCreditsEarned > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--color-info-bg)] text-[var(--color-info)]">
                    <GraduationCap className="w-3.5 h-3.5" /> {ts.ceCreditsEarned} CE Credits
                  </span>
                )}
                {ts.credentialCount > 0 && (
                  <span className="text-xs font-medium text-[var(--color-muted)]">
                    {ts.credentialCount} credential{ts.credentialCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Bio */}
      {profile.bio && (
        <GlassCard className="p-6">
          <h3 className="text-sm font-semibold mb-2">About</h3>
          <p className="text-sm text-[var(--color-muted)] whitespace-pre-line">{profile.bio}</p>
        </GlassCard>
      )}

      {/* Professional Licenses / Credentials */}
      {licenses.length > 0 && (
        <GlassCard className="p-6">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Award className="w-4 h-4" /> Professional Licenses
          </h3>
          <div className="space-y-3">
            {licenses.map((lic) => (
              <div key={lic.id} className="flex items-start justify-between p-3 rounded-lg bg-[var(--color-surface)]">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{lic.licenseType}</span>
                    {lic.verifiedAt ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)]">
                        <ShieldCheck className="w-3 h-3" /> Verified
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-warning-bg)] text-[var(--color-warning)]">
                        Unverified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-muted)]">
                    {lic.licenseNumber} • {lic.issuingAuthority}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {lic.jurisdiction} • <StatusBadge status={lic.status as any} />
                  </p>
                </div>
                <div className="text-right text-xs text-[var(--color-muted)]">
                  {lic.expirationDate && (
                    <p>Expires {new Date(lic.expirationDate).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* CE Credits */}
      {(totalCredits > 0 || credits.length > 0) && (
        <GlassCard className="p-6">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <GraduationCap className="w-4 h-4" /> Continuing Education
          </h3>
          <div className="flex items-center gap-4 mb-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--color-primary)]">{totalCredits}</div>
              <div className="text-xs text-[var(--color-muted)]">Credits Earned</div>
            </div>
          </div>
          {credits.length > 0 && (
            <div className="space-y-2">
              {credits.slice(0, 5).map((cr: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-xs py-1.5 border-b border-[var(--color-border-light)] last:border-0">
                  <span className="text-[var(--color-muted)]">{cr.courseTitle || 'CE Credit'}</span>
                  <span className="font-medium">{cr.credits} credits</span>
                </div>
              ))}
              {credits.length > 5 && (
                <p className="text-xs text-[var(--color-muted)]">+ {credits.length - 5} more</p>
              )}
            </div>
          )}
        </GlassCard>
      )}

      {/* Contact info (privacy-gated by backend) */}
      {(profile.contactEmail || profile.contactPhone || profile.website) && (
        <GlassCard className="p-6">
          <h3 className="text-sm font-semibold mb-3">Contact</h3>
          <div className="space-y-2">
            {profile.contactEmail && (
              <a href={`mailto:${profile.contactEmail}`} className="flex items-center gap-2 text-sm text-[var(--color-primary)] hover:underline">
                <Mail className="w-4 h-4" /> {profile.contactEmail}
              </a>
            )}
            {profile.contactPhone && (
              <a href={`tel:${profile.contactPhone}`} className="flex items-center gap-2 text-sm text-[var(--color-primary)] hover:underline">
                <Phone className="w-4 h-4" /> {profile.contactPhone}
              </a>
            )}
            {profile.website && (
              <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[var(--color-primary)] hover:underline">
                <Globe className="w-4 h-4" /> {profile.website}
              </a>
            )}
          </div>
        </GlassCard>
      )}

      {/* Social links */}
      {profile.socialLinks && Object.keys(profile.socialLinks).length > 0 && (
        <GlassCard className="p-6">
          <h3 className="text-sm font-semibold mb-3">Social</h3>
          <div className="flex gap-3">
            {Object.entries(profile.socialLinks as Record<string, string>).map(([platform, url]) => (
              <a key={platform} href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--color-primary)] hover:underline capitalize">
                {platform}
              </a>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  )
}
