import { createFileRoute } from '@tanstack/react-router'
import { PageShell } from '@/components/patterns/page-shell'
import { CertificatePreview } from '@/features/certificates/components/certificate-preview'

export const Route = createFileRoute('/_authenticated/my/certificates/$certificateId')({
  component: CertificateDetail,
})

function CertificateDetail() {
  const { certificateId } = Route.useParams()

  return (
    <PageShell
      title="Certificate"
      breadcrumbs={[
        { label: 'Certificates', href: '/my/certificates' },
        { label: 'Certificate' },
      ]}
    >
      <div className="space-y-6">
        <CertificatePreview certificateId={certificateId} />
      </div>
    </PageShell>
  )
}
