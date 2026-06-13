// FIX-002 (G2): single dispatching public-verify route. Replaces the three
// sibling dynamic routes (/verify/$token, /verify/$certificateNumber,
// /verify/$credentialNumber) that shadowed each other so at most one was
// reachable. Dispatch is by id shape (see verify-dispatch.ts); every existing
// /verify/<...> URL keeps working.
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button } from '@monobase/ui'
import { api } from '@/lib/api'
import { resolveVerifyKind, verifyStalenessNote } from './verify-dispatch'

// oli-ui: exempt-pageshell — public verification micro-page; centered single-card result
export const Route = createFileRoute('/verify/$id')({
  component: VerifyDispatchPage,
})

function VerifyDispatchPage() {
  const { id } = Route.useParams()
  const kind = resolveVerifyKind(id)
  if (kind === 'certificate') return <CertificateResult certificateNumber={id} />
  if (kind === 'token') return <TokenResult token={id} />
  return <CredentialNumberResult credentialNumber={id} />
}

// ---------------------------------------------------------------------------
// Shared presentational bits
// ---------------------------------------------------------------------------

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function LoadingCard({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function NotFoundCard({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function StalenessHint({ issuedAt }: { issuedAt: string }) {
  const note = verifyStalenessNote(issuedAt, Date.now())
  if (!note) return null
  return (
    <div className="mt-4 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-center text-xs text-yellow-800">
      {note}
    </div>
  )
}

function QrSelfReference() {
  return (
    <div className="mt-6 flex justify-center border-t pt-4">
      <div className="rounded bg-muted p-3 text-center">
        <p className="text-xs text-muted-foreground">Scan to verify</p>
        <p className="mt-1 break-all font-mono text-xs">
          {typeof window !== 'undefined' ? window.location.href : ''}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Certificate verification
// ---------------------------------------------------------------------------

interface CertVerificationData {
  certificateNumber: string
  holderName: string
  issuedAt: string
  status: string
  creditHours: number | null
  cpdActivityType: string | null
  isValid: boolean
}

function CertificateResult({ certificateNumber }: { certificateNumber: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['verify-certificate', certificateNumber],
    queryFn: () => api.get<{ data: CertVerificationData }>(`/api/certificates/verify/${certificateNumber}`),
    retry: false,
  })

  if (isLoading) return <LoadingCard label="Verifying certificate..." />
  if (error)
    return (
      <NotFoundCard
        title="Certificate Not Found"
        body={<>No certificate with number <span className="font-mono">{certificateNumber}</span> exists in our records.</>}
      />
    )

  const cert = data?.data
  if (!cert) return null

  return (
    <div className="flex min-h-screen items-center justify-center bg-background print:bg-white">
      <div className="mx-auto max-w-md rounded-xl border bg-card p-8 shadow-sm print:border-0 print:shadow-none">
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

        <div className="text-center">
          <Badge variant={cert.isValid ? 'default' : 'destructive'} className={cert.isValid ? 'bg-green-100 text-green-700' : ''}>
            {cert.isValid ? 'Valid Certificate' : 'REVOKED'}
          </Badge>
          <h1 className="mt-4 text-2xl font-bold">{cert.holderName}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{cert.certificateNumber}</p>
        </div>

        <div className="mt-6 space-y-3 border-t pt-4">
          <DetailRow label="Issued" value={fmtDate(cert.issuedAt)} />
          <DetailRow label="Status" value={cert.status === 'revoked' ? 'Revoked' : 'Issued'} />
          {cert.creditHours && <DetailRow label="CPD Hours" value={String(cert.creditHours)} />}
          {cert.cpdActivityType && <DetailRow label="Activity Type" value={cert.cpdActivityType} />}
        </div>

        {cert.isValid && <StalenessHint issuedAt={cert.issuedAt} />}
        <QrSelfReference />

        <div className="mt-4 text-center print:hidden">
          <Button variant="ghost" size="sm" onClick={() => window.print()} className="text-sm text-muted-foreground underline hover:text-foreground">
            Print this verification
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Credential-number lookup
// ---------------------------------------------------------------------------

interface CredentialLookupResponse {
  result: 'valid' | 'expired' | 'revoked' | 'notFound'
  credential: {
    credentialNumber: string
    status: string
    issuedAt: string
    expiresAt: string | null
  }
  holder: {
    displayName: string
    photoUrl: string | null
    specialty: string | null
    membershipStatus: 'current' | null
  }
}

const statusConfig = {
  valid: { label: 'Valid', color: 'bg-green-100 text-green-700', variant: 'default' as const },
  expired: { label: 'Expired', color: 'bg-yellow-100 text-yellow-700', variant: 'secondary' as const },
  revoked: { label: 'Revoked', color: '', variant: 'destructive' as const },
  notFound: { label: 'Not Found', color: '', variant: 'destructive' as const },
} as const

function CredentialNumberResult({ credentialNumber }: { credentialNumber: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['verify-credential', credentialNumber],
    queryFn: () =>
      api.get<CredentialLookupResponse>(`/api/association/member/credentials/lookup/${encodeURIComponent(credentialNumber)}`),
    retry: false,
  })

  if (isLoading) return <LoadingCard label="Verifying credential..." />
  if (error || !data || data.result === 'notFound')
    return (
      <NotFoundCard
        title="Credential Not Found"
        body={<>No credential with number <span className="font-mono">{credentialNumber}</span> exists in our records.</>}
      />
    )

  const { credential, holder } = data
  const status = statusConfig[data.result]
  const isValid = data.result === 'valid'

  return (
    <div className="flex min-h-screen items-center justify-center bg-background print:bg-white">
      <div className="mx-auto max-w-md rounded-xl border bg-card p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="mb-6 flex justify-center">
          {isValid ? (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : data.result === 'expired' ? (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-yellow-100">
              <svg className="h-10 w-10 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
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

        <div className="text-center">
          <Badge variant={status.variant} className={status.color}>{status.label}</Badge>
          {holder.photoUrl && (
            <div className="mt-4 flex justify-center">
              <img src={holder.photoUrl} alt={holder.displayName} className="h-20 w-20 rounded-full object-cover border-2 border-muted" />
            </div>
          )}
          <h1 className="mt-4 text-2xl font-bold">{holder.displayName}</h1>
          {holder.specialty && <p className="mt-1 text-sm text-muted-foreground">{holder.specialty}</p>}
          <p className="mt-1 font-mono text-sm text-muted-foreground">{credential.credentialNumber}</p>
          {holder.membershipStatus === 'current' && (
            <div className="mt-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Active Member</Badge>
            </div>
          )}
        </div>

        <div className="mt-6 space-y-3 border-t pt-4">
          <DetailRow label="Status" value={credential.status} />
          <DetailRow label="Issued" value={fmtDate(credential.issuedAt)} />
          {credential.expiresAt && <DetailRow label="Expires" value={fmtDate(credential.expiresAt)} />}
        </div>

        {isValid && <StalenessHint issuedAt={credential.issuedAt} />}
        <QrSelfReference />

        <div className="mt-4 text-center print:hidden">
          <Button variant="link" onClick={() => window.print()} className="text-sm text-muted-foreground underline hover:text-foreground">
            Print this verification
          </Button>
        </div>

        <div className="mt-4 border-t pt-4 text-center text-xs text-muted-foreground">
          Verified by Memberry &bull; memberry.ph
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Signed credential token (POST public-verify) — FIX-001 / Q1 reuse
// ---------------------------------------------------------------------------

interface TokenVerifyResponse {
  result: 'valid' | 'expired' | 'revoked' | 'notFound'
  credential: {
    credentialNumber: string
    status: string
    issuedAt: string
    expiresAt: string | null
  } | null
}

function TokenResult({ token }: { token: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['verify-token', token],
    queryFn: () =>
      api.post<TokenVerifyResponse>('/api/association/member/credentials/public-verify', { token }),
    retry: false,
  })

  if (isLoading) return <LoadingCard label="Verifying credential..." />
  if (!data || data.result === 'notFound' || !data.credential)
    return (
      <NotFoundCard
        title="Verification Failed"
        body="This code could not be verified. It may be invalid or tampered with."
      />
    )

  const { credential } = data
  const status = statusConfig[data.result]
  const isValid = data.result === 'valid'

  return (
    <div className="flex min-h-screen items-center justify-center bg-background print:bg-white">
      <div className="mx-auto max-w-md rounded-xl border bg-card p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="mb-6 flex justify-center">
          {isValid ? (
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

        <div className="text-center">
          <Badge variant={status.variant} className={status.color}>{status.label}</Badge>
          <p className="mt-4 font-mono text-sm text-muted-foreground">{credential.credentialNumber}</p>
        </div>

        <div className="mt-6 space-y-3 border-t pt-4">
          <DetailRow label="Status" value={credential.status} />
          <DetailRow label="Issued" value={fmtDate(credential.issuedAt)} />
          {credential.expiresAt && <DetailRow label="Expires" value={fmtDate(credential.expiresAt)} />}
        </div>

        {isValid && <StalenessHint issuedAt={credential.issuedAt} />}
        <QrSelfReference />

        <div className="mt-4 border-t pt-4 text-center text-xs text-muted-foreground">
          Verified by Memberry &bull; memberry.ph
        </div>
      </div>
    </div>
  )
}
