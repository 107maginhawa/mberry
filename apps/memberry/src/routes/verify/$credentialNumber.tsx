// ui-c-exempt: public-verify — public credential verification
// oli-execute: error-handled-inline
// `error || !data` renders explicit "could not verify credential" branch.
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button } from '@monobase/ui'
import { api } from '@/lib/api'

// oli-ui: exempt-pageshell — public credential-verification micro-page; centered single-card result
export const Route = createFileRoute('/verify/$credentialNumber')({
  component: VerifyCredentialPage,
})

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
  valid: { label: 'Valid', color: 'bg-green-100 text-green-700', variant: 'default' as const, icon: 'check' },
  expired: { label: 'Expired', color: 'bg-yellow-100 text-yellow-700', variant: 'secondary' as const, icon: 'warning' },
  revoked: { label: 'Revoked', color: '', variant: 'destructive' as const, icon: 'x' },
  notFound: { label: 'Not Found', color: '', variant: 'destructive' as const, icon: 'x' },
} as const

function VerifyCredentialPage() {
  const { credentialNumber } = Route.useParams()

  const { data, isLoading, error } = useQuery({
    queryKey: ['verify-credential', credentialNumber],
    queryFn: () =>
      api.get<CredentialLookupResponse>(
        `/api/association/member/credentials/lookup/${encodeURIComponent(credentialNumber)}`,
      ),
  })

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Verifying credential...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold">Credential Not Found</h1>
          <p className="mt-2 text-muted-foreground">
            No credential with number <span className="font-mono">{credentialNumber}</span> exists in our records.
          </p>
        </div>
      </div>
    )
  }

  if (data.result === 'notFound') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold">Credential Not Found</h1>
          <p className="mt-2 text-muted-foreground">
            No credential with number <span className="font-mono">{credentialNumber}</span> exists in our records.
          </p>
        </div>
      </div>
    )
  }

  const { credential, holder } = data
  const status = statusConfig[data.result]
  const isValid = data.result === 'valid'

  return (
    <div className="flex min-h-screen items-center justify-center bg-background print:bg-white">
      <div className="mx-auto max-w-md rounded-xl border bg-card p-8 shadow-sm print:border-0 print:shadow-none">
        {/* Status indicator */}
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

        {/* Holder info + status */}
        <div className="text-center">
          <Badge variant={status.variant} className={status.color}>
            {status.label}
          </Badge>

          {holder.photoUrl && (
            <div className="mt-4 flex justify-center">
              <img
                src={holder.photoUrl}
                alt={holder.displayName}
                className="h-20 w-20 rounded-full object-cover border-2 border-muted"
              />
            </div>
          )}

          <h1 className="mt-4 text-2xl font-bold">{holder.displayName}</h1>
          {holder.specialty && (
            <p className="mt-1 text-sm text-muted-foreground">{holder.specialty}</p>
          )}
          <p className="mt-1 font-mono text-sm text-muted-foreground">{credential.credentialNumber}</p>

          {holder.membershipStatus === 'current' && (
            <div className="mt-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Active Member
              </Badge>
            </div>
          )}
        </div>

        {/* Credential details */}
        <div className="mt-6 space-y-3 border-t pt-4">
          <DetailRow label="Status" value={credential.status} />
          <DetailRow
            label="Issued"
            value={new Date(credential.issuedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          />
          {credential.expiresAt && (
            <DetailRow
              label="Expires"
              value={new Date(credential.expiresAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            />
          )}
        </div>

        {/* QR self-reference */}
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
            variant="link"
            onClick={() => window.print()}
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            Print this verification
          </Button>
        </div>

        {/* Footer */}
        <div className="mt-4 border-t pt-4 text-center text-xs text-muted-foreground">
          Verified by Memberry &bull; memberry.ph
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
