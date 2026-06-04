// ui-c-exempt: public-verify — public certificate verification
// oli-execute: error-handled-inline
// `error` renders explicit "Could not verify certificate" branch.
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button } from '@monobase/ui'
import { api } from '@/lib/api'

// oli-ui: exempt-pageshell — public certificate-verification micro-page; centered single-card result
export const Route = createFileRoute('/verify/$certificateNumber')({
  component: VerifyCertificatePage,
})

interface VerificationData {
  certificateNumber: string
  holderName: string
  issuedAt: string
  status: string
  creditHours: number | null
  cpdActivityType: string | null
  isValid: boolean
}

function VerifyCertificatePage() {
  const { certificateNumber } = Route.useParams()

  const { data, isLoading, error } = useQuery({
    queryKey: ['verify-certificate', certificateNumber],
    queryFn: () => api.get<{ data: VerificationData }>(`/api/certificates/verify/${certificateNumber}`),
  })

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Verifying certificate...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold">Certificate Not Found</h1>
          <p className="mt-2 text-muted-foreground">
            No certificate with number <span className="font-mono">{certificateNumber}</span> exists in our records.
          </p>
        </div>
      </div>
    )
  }

  const cert = data?.data
  if (!cert) return null

  return (
    <div className="flex min-h-screen items-center justify-center bg-background print:bg-white">
      <div className="mx-auto max-w-md rounded-xl border bg-card p-8 shadow-sm print:border-0 print:shadow-none">
        {/* Status indicator */}
        <div className="mb-6 flex justify-center">
          {cert.isValid ? (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
              <svg className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
        </div>

        {/* Certificate details */}
        <div className="text-center">
          <Badge
            variant={cert.isValid ? 'default' : 'destructive'}
            className={cert.isValid ? 'bg-green-100 text-green-700' : ''}
          >
            {cert.isValid ? 'Valid Certificate' : 'REVOKED'}
          </Badge>
          <h1 className="mt-4 text-2xl font-bold">{cert.holderName}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{cert.certificateNumber}</p>
        </div>

        <div className="mt-6 space-y-3 border-t pt-4">
          <DetailRow label="Issued" value={new Date(cert.issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} />
          <DetailRow label="Status" value={cert.status === 'revoked' ? 'Revoked' : 'Issued'} />
          {cert.creditHours && <DetailRow label="CPD Hours" value={String(cert.creditHours)} />}
          {cert.cpdActivityType && <DetailRow label="Activity Type" value={cert.cpdActivityType} />}
        </div>

        {/* QR code placeholder — links back to this verification page */}
        <div className="mt-6 flex justify-center border-t pt-4">
          <div className="rounded bg-muted p-3 text-center">
            <p className="text-xs text-muted-foreground">Scan to verify</p>
            <p className="mt-1 break-all font-mono text-xs">
              {typeof window !== 'undefined' ? window.location.href : ''}
            </p>
          </div>
        </div>

        {/* Print button */}
        <div className="mt-4 text-center print:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.print()}
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            Print this verification
          </Button>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
