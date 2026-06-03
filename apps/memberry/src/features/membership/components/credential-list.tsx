// oli-execute: error-handled-inline -- consumed by /my/credentials route.
import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, AlertTriangle, XCircle, Clock } from 'lucide-react'
import { GlassCard } from '@/components/motion/glass-card'
import { Button } from '@monobase/ui'
import { api } from '@/lib/api'

interface CredentialListProps {
  personId: string
  orgId: string
}

interface License {
  id: string
  licenseType: string
  licenseNumber: string
  issuingAuthority: string
  jurisdiction: string
  status: 'active' | 'expired' | 'suspended' | 'revoked' | 'pending'
  expirationDate: string
  verifiedAt: string | null
}

export function CredentialList({ personId, orgId }: CredentialListProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['member-licenses', personId, orgId],
    queryFn: async () => {
      const res = await api.get<any>(
        `/api/association/member/licenses?personId=${personId}`,
        { headers: { 'x-org-id': orgId } } as any,
      )
      return (res?.data ?? res ?? []) as License[]
    },
    retry: false,
  })

  const licenses = data ?? []

  if (isLoading) {
    return (
      <GlassCard className="p-5">
        <h3 className="text-h4 mb-3">Credentials</h3>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-[var(--color-surface-warm)] rounded w-3/4" />
          <div className="h-4 bg-[var(--color-surface-warm)] rounded w-1/2" />
        </div>
      </GlassCard>
    )
  }

  if (licenses.length === 0) {
    return (
      <GlassCard className="p-5">
        <h3 className="text-h4 mb-2">Credentials</h3>
        <p className="text-sm text-[var(--color-muted)]">No professional licenses on file.</p>
      </GlassCard>
    )
  }

  return (
    <GlassCard className="p-5">
      <h3 className="text-h4 mb-3">Credentials</h3>
      <div className="space-y-3">
        {licenses.map((license) => (
          <LicenseCard key={license.id} license={license} />
        ))}
      </div>
    </GlassCard>
  )
}

function LicenseCard({ license }: { license: License }) {
  const isExpiringSoon = license.expirationDate && daysUntil(license.expirationDate) < 90 && daysUntil(license.expirationDate) > 0
  const isExpired = license.status === 'expired' || (license.expirationDate && daysUntil(license.expirationDate) <= 0)

  const STATUS_MAP: Record<string, { icon: any; color: string; bg: string; label: string }> = {
    active: { icon: ShieldCheck, color: 'text-[var(--color-success)]', bg: 'bg-[var(--color-success-bg)]', label: 'Active' },
    expired: { icon: Clock, color: 'text-[var(--color-warning)]', bg: 'bg-[var(--color-warning-bg)]', label: 'Expired' },
    suspended: { icon: AlertTriangle, color: 'text-[var(--color-warning)]', bg: 'bg-[var(--color-warning-bg)]', label: 'Suspended' },
    revoked: { icon: XCircle, color: 'text-[var(--color-error)]', bg: 'bg-[var(--color-error-bg)]', label: 'Revoked' },
    pending: { icon: Clock, color: 'text-[var(--color-muted)]', bg: 'bg-[var(--color-surface-warm)]', label: 'Pending' },
  }
  const statusConfig = STATUS_MAP[license.status] ?? STATUS_MAP['pending']!

  const StatusIcon = statusConfig!.icon

  return (
    <div className={`flex items-start justify-between p-3 rounded-lg border ${isExpiringSoon ? 'border-[var(--color-warning)]' : 'border-[var(--color-border-light)]'}`}>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{license.licenseType}</span>
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.color}`}>
            <StatusIcon className="w-3 h-3" />
            {statusConfig.label}
          </span>
          {license.verifiedAt && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)]">
              <ShieldCheck className="w-3 h-3" /> Verified
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--color-muted)]">
          {license.licenseNumber} • {license.issuingAuthority} • {license.jurisdiction}
        </p>
        {license.expirationDate && (
          <p className={`text-xs ${isExpired ? 'text-[var(--color-error)]' : isExpiringSoon ? 'text-[var(--color-warning)]' : 'text-[var(--color-muted)]'}`}>
            {isExpired ? 'Expired' : 'Expires'}: {new Date(license.expirationDate).toLocaleDateString()}
            {isExpiringSoon && ` (${daysUntil(license.expirationDate)} days)`}
          </p>
        )}
      </div>
    </div>
  )
}

function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}
