import { createFileRoute } from '@tanstack/react-router'
import { PageShell } from '@/components/patterns/page-shell'
import { CertificateList } from '@/features/certificates/components/certificate-list'

export const Route = createFileRoute('/_authenticated/my/certificates/')({
  component: MyCertificates,
})

function MyCertificates() {
  return (
    <PageShell
      title="My Certificates"
      subtitle="Training certificates and credentials issued to you"
    >
      <div className="space-y-6">
        <CertificateList />
      </div>
    </PageShell>
  )
}
