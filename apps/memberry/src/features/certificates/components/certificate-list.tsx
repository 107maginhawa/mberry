import { useQuery } from '@tanstack/react-query'
import { listMyCertificatesOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import type { Certificate } from '@monobase/sdk-ts/generated/types.gen'
import { useOrgContext } from '@/hooks/useOrgContext'
import { EmptyState } from '@/components/patterns/empty-state'
import { CardSkeleton } from '@/components/patterns/skeleton-loader'
import { GlassCard } from '@/components/motion/glass-card'
import { StaggerGrid, StaggerItem } from '@/components/motion/stagger-grid'
import { Link } from '@tanstack/react-router'
import { Award } from 'lucide-react'

function formatDate(iso: string | Date | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function CertificateList() {
  const { orgId } = useOrgContext()
  const { data, isLoading } = useQuery({
    ...listMyCertificatesOptions(orgId ? { headers: { 'x-org-id': orgId } } : undefined),
    enabled: !!orgId,
  })

  const certificates: Certificate[] = data?.data ?? []

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    )
  }

  if (certificates.length === 0) {
    return (
      <EmptyState
        icon={<Award size={32} />}
        headline="No certificates issued yet"
        description="Complete a training to earn your first certificate."
      />
    )
  }

  return (
    <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {certificates.map((cert) => (
        <StaggerItem key={cert.id}>
          <Link to="/my/certificates/$certificateId" params={{ certificateId: cert.id }} className="block">
            <GlassCard className="p-5 space-y-3 hover:bg-[var(--color-surface-elevated-hover)] transition-colors">
              {/* Header accent */}
              <div className="h-1.5 w-16 rounded-full bg-[var(--color-primary)]" />

              <div className="space-y-1">
                <p className="font-semibold text-[14px] line-clamp-2">Training Certificate</p>
                <p className="text-[12px] text-[var(--color-muted)]">Training ID: {cert.trainingId?.slice(0, 8) ?? 'N/A'}...</p>
              </div>

              <div className="flex items-center justify-between">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  {cert.certificateNumber}
                </span>
              </div>

              <div className="pt-1 border-t border-[var(--color-border-light)] text-[12px] text-[var(--color-muted)]">
                Issued {formatDate(cert.issuedAt)}
              </div>
            </GlassCard>
          </Link>
        </StaggerItem>
      ))}
    </StaggerGrid>
  )
}
