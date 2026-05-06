import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { getCertificateOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

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
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (error || !cert?.id) {
    return (
      <div className="max-w-2xl border rounded-xl p-8 text-center text-muted-foreground">
        Certificate not found or you do not have permission to view it.
      </div>
    )
  }

  const verificationUrl = `${window.location.origin}/verify/certificate/${cert.certificateNumber}`

  const handleDownloadPdf = () => {
    // PDF generation is a future iteration (e.g., html2canvas + jsPDF or server-side)
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
      <div className="border-2 border-primary/30 rounded-xl overflow-hidden bg-card shadow-sm">
        {/* Top accent bar */}
        <div className="h-2 bg-gradient-to-r from-primary to-primary/60" />

        <div className="p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Certificate of Completion
            </p>
            <h2 className="text-2xl font-bold">Training Certificate</h2>
          </div>

          {/* Divider */}
          <div className="border-t" />

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Certificate No.</p>
              <p className="font-mono font-semibold">{cert.certificateNumber}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Date Issued</p>
              <p className="font-medium">{formatDate(cert.issuedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Training ID</p>
              <p className="font-mono text-xs truncate">{cert.trainingId}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Organization</p>
              <p className="font-mono text-xs truncate">{cert.organizationId}</p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t" />

          {/* Verification footer */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Verify this certificate at:
            </p>
            <p className="text-xs font-mono text-primary mt-0.5 break-all">{verificationUrl}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleDownloadPdf}
          className="px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
        >
          Download PDF
        </button>
        <button
          type="button"
          onClick={handleShareVerification}
          className="px-5 py-2 border rounded-md text-sm font-medium hover:bg-muted"
        >
          Copy Verification Link
        </button>
      </div>
    </div>
  )
}
