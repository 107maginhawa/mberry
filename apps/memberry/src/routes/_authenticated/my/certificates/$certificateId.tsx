import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/my/certificates/$certificateId')({
  component: CertificateDetail,
})

function CertificateDetail() {
  const { certificateId } = Route.useParams()

  return (
    <div className="space-y-6 p-6">
      <a href="/my/certificates" className="text-sm text-muted-foreground hover:text-foreground">← Back to Certificates</a>
      <h1 className="text-2xl font-bold">Certificate Detail</h1>

      <div className="max-w-2xl border rounded-lg p-6 space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Certificate ID: {certificateId}</p>
          <h2 className="text-xl font-semibold">Training Certificate</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-muted-foreground">Issued To:</span> —</div>
          <div><span className="text-muted-foreground">Organization:</span> —</div>
          <div><span className="text-muted-foreground">Training:</span> —</div>
          <div><span className="text-muted-foreground">Credits:</span> —</div>
          <div><span className="text-muted-foreground">Issued Date:</span> —</div>
          <div><span className="text-muted-foreground">Status:</span> —</div>
        </div>

        <div className="border-t pt-4 flex gap-2">
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium" disabled>
            Download PDF
          </button>
          <button className="px-4 py-2 border rounded-md text-sm font-medium" disabled>
            Share Verification Link
          </button>
        </div>
      </div>
    </div>
  )
}
