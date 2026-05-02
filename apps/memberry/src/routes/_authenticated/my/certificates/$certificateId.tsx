import { createFileRoute, Link } from '@tanstack/react-router'
import { CertificatePreview } from '@/features/certificates/components/certificate-preview'

export const Route = createFileRoute('/_authenticated/my/certificates/$certificateId')({
  component: CertificateDetail,
})

function CertificateDetail() {
  const { certificateId } = Route.useParams()

  return (
    <div className="space-y-6 p-6">
      <Link to="/my/certificates" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to Certificates
      </Link>
      <h1 className="text-2xl font-bold">Certificate</h1>
      <CertificatePreview certificateId={certificateId} />
    </div>
  )
}
