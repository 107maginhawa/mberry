import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getCertificateOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import type { Certificate } from '@monobase/sdk-ts/generated/types.gen'
import { Button } from '@monobase/ui'
import { GlassCard } from '@/components/motion/glass-card'
import { CardSkeleton } from '@/components/patterns/skeleton-loader'

interface CertificatePreviewProps {
  certificateId: string
}

function formatDate(iso: string | Date | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function CertificatePreview({ certificateId }: CertificatePreviewProps) {
  const { data, isLoading, isError } = useQuery(
    getCertificateOptions({ path: { certificateId } }),
  )

  const cert = data as Certificate | undefined

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    )
  }

  if (isError) {
    return (
      <div role="alert" className="max-w-2xl p-4 rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">
        Unable to load certificate. Please try refreshing the page.
      </div>
    )
  }

  if (!cert?.id) {
    return (
      <GlassCard className="max-w-2xl p-8 text-center">
        <p className="text-sm text-[var(--color-muted)]">
          Certificate not found or you do not have permission to view it.
        </p>
      </GlassCard>
    )
  }

  const verificationUrl = `${window.location.origin}/verify/${cert.certificateNumber}`

  const handleDownloadPdf = () => {
    window.open(`/api/certificates/${certificateId}/pdf`, '_blank', 'noopener')
  }

  const handleShareVerification = () => {
    navigator.clipboard.writeText(verificationUrl).then(() => {
      toast.success('Verification link copied to clipboard')
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Certificate card — formal layout */}
      <GlassCard className="overflow-hidden">
        {/* Top accent bar */}
        <div className="h-2 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary)]/60" />

        <div className="p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
              Certificate of Completion
            </p>
            <h2 className="text-[22px] font-bold font-display">Training Certificate</h2>
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--color-border-light)]" />

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div>
              <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide mb-0.5">Certificate No.</p>
              <p className="font-mono font-semibold">{cert.certificateNumber}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide mb-0.5">Date Issued</p>
              <p className="font-medium">{formatDate(cert.issuedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide mb-0.5">Training ID</p>
              <p className="font-mono text-xs truncate">{cert.trainingId}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide mb-0.5">Organization</p>
              <p className="font-mono text-xs truncate">{cert.organizationId}</p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--color-border-light)]" />

          {/* Verification footer */}
          <div className="text-center">
            <p className="text-xs text-[var(--color-muted)]">
              Verify this certificate at:
            </p>
            <p className="text-xs font-mono text-[var(--color-primary)] mt-0.5 break-all">{verificationUrl}</p>
          </div>
        </div>
      </GlassCard>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="button"
          onClick={handleDownloadPdf}
        >
          Download PDF
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleShareVerification}
        >
          Copy Verification Link
        </Button>
      </div>
    </div>
  )
}
