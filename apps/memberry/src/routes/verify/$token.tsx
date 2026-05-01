import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'

export const Route = createFileRoute('/verify/$token')({
  component: PublicVerification,
})

/**
 * Public credential verification page — no auth required.
 * Third parties (employers, regulators) scan QR code to verify membership/credential.
 */
function PublicVerification() {
  const { token } = Route.useParams()
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/verify/${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setResult(data)
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Unable to verify. Please try again.')
        setLoading(false)
      })
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Verifying credential...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full border rounded-lg p-6 bg-white text-center space-y-4">
          <div className="text-4xl">❌</div>
          <h1 className="text-xl font-bold text-destructive">Verification Failed</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full border rounded-lg bg-white overflow-hidden">
        <div className="bg-green-600 p-6 text-white text-center">
          <div className="text-4xl mb-2">✓</div>
          <h1 className="text-xl font-bold">Credential Verified</h1>
          <p className="text-sm opacity-80">Verified as of {result?.verifiedAt || 'now'}</p>
        </div>
        <div className="p-6 space-y-3 text-sm">
          {result?.memberName && (
            <div className="flex justify-between"><span className="text-muted-foreground">Member</span><span className="font-medium">{result.memberName}</span></div>
          )}
          {result?.organizationName && (
            <div className="flex justify-between"><span className="text-muted-foreground">Organization</span><span className="font-medium">{result.organizationName}</span></div>
          )}
          {result?.credentialType && (
            <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium">{result.credentialType}</span></div>
          )}
          {result?.status && (
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-medium">{result.status}</span></div>
          )}
          {result?.issuedAt && (
            <div className="flex justify-between"><span className="text-muted-foreground">Issued</span><span className="font-medium">{result.issuedAt}</span></div>
          )}
        </div>
        <div className="border-t p-4 text-center text-xs text-muted-foreground">
          Verified by Memberry • memberry.ph
        </div>
      </div>
    </div>
  )
}
