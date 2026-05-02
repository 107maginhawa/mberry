import { createFileRoute } from '@tanstack/react-router'
import { CertificateList } from '@/features/certificates/components/certificate-list'

export const Route = createFileRoute('/_authenticated/my/certificates/')({
  component: MyCertificates,
})

function MyCertificates() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">My Certificates</h1>
        <p className="text-sm text-muted-foreground">Training certificates and credentials issued to you</p>
      </div>
      <CertificateList />
    </div>
  )
}
