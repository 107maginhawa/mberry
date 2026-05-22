import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/patterns/page-header'
import { CertificateList } from '@/features/certificates/components/certificate-list'

export const Route = createFileRoute('/_authenticated/my/certificates/')({
  component: MyCertificates,
})

function MyCertificates() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="My Certificates"
        subtitle="Training certificates and credentials issued to you"
      />
      <CertificateList />
    </div>
  )
}
