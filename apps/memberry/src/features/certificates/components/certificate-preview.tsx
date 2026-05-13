import { useQuery } from '@tanstack/react-query'
import { getCertificateOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import { GlassCard } from '@/components/motion/glass-card'
import { CardSkeleton } from '@/components/patterns/skeleton-loader'

interface CertificatePreviewProps {
  certificateId: string
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function CertificatePreview({ certificateId }: CertificatePreviewProps) {
  const { data, isLoading, error } = useQuery(
    getCertificateOptions({ path: { certificateId } }),
  )

  const cert = data as any

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    )
  }

  if (error || !cert?.id) {
    return (
      <GlassCard className="max-w-2xl p-8 text-center">
        <p className="text-[14px] text-[var(--color-muted)]">
          Certificate not found or you do not have permission to view it.
        </p>
      </GlassCard>
    )
  }

  const verificationUrl = `${window.location.origin}/verify/certificate/${cert.certificateNumber}`

  const handleDownloadPdf = () => {
    alert('PDF download will be available in a future update.')
  }

  const handleShareVerification = () => {
    navigator.clipboard.writeText(verificationUrl).then(() => {
      alert('Verification link copied to clipboard!')
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
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
              Certificate of Completion
            </p>
            <h2 className="text-[22px] font-bold font-display">Training Certificate</h2>
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--color-border-light)]" />

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-[13px]">
            <div>
              <p className="text-[11px] text-[var(--color-muted)] uppercase tracking-wide mb-0.5">Certificate No.</p>
              <p className="font-mono font-semibold">{cert.certificateNumber}</p>
            </div>
            <div>
              <p className="text-[11px] text-[var(--color-muted)] uppercase tracking-wide mb-0.5">Date Issued</p>
              <p className="font-medium">{formatDate(cert.issuedAt)}</p>
            </div>
            <div>
              <p className="text-[11px] text-[var(--color-muted)] uppercase tracking-wide mb-0.5">Training ID</p>
              <p className="font-mono text-[12px] truncate">{cert.trainingId}</p>
            </div>
            <div>
              <p className="text-[11px] text-[var(--color-muted)] uppercase tracking-wide mb-0.5">Organization</p>
              <p className="font-mono text-[12px] truncate">{cert.organizationId}</p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--color-border-light)]" />

          {/* Verification footer */}
          <div className="text-center">
            <p className="text-[12px] text-[var(--color-muted)]">
              Verify this certificate at:
            </p>
            <p className="text-[12px] font-mono text-[var(--color-primary)] mt-0.5 break-all">{verificationUrl}</p>
          </div>
        </div>
      </GlassCard>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleDownloadPdf}
          className="px-[18px] py-[9px] bg-[var(--color-primary)] text-white rounded-[8px] text-[13px] font-semibold hover:bg-[var(--color-primary-mid)] transition-colors"
        >
          Download PDF
        </button>
        <button
          type="button"
          onClick={handleShareVerification}
          className="px-[18px] py-[9px] border border-[var(--color-border-light)] rounded-[8px] text-[13px] font-semibold hover:bg-[var(--color-surface-elevated-hover)] transition-colors"
        >
          Copy Verification Link
        </button>
      </div>
    </div>
  )
}
