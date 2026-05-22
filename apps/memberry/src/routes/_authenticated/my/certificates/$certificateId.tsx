import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/patterns/page-header'
import { CertificatePreview } from '@/features/certificates/components/certificate-preview'

export const Route = createFileRoute('/_authenticated/my/certificates/$certificateId')({
  component: CertificateDetail,
})

function CertificateDetail() {
  const { certificateId } = Route.useParams()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificate"
        breadcrumbs={[
          { label: 'Certificates', href: '/my/certificates' },
          { label: 'Certificate' },
        ]}
      />
      <CertificatePreview certificateId={certificateId} />
    </div>
  )
}
