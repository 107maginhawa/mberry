import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import type { ApiErrorBody } from '@/types/api'

export const Route = createFileRoute('/verify/$token')({
  component: PublicVerification,
})

/**
 * Public credential verification page — no auth required.
 * Third parties (employers, regulators) scan QR code to verify membership/credential.
 */
function PublicVerification() {
  const { token } = Route.useParams()

  const verifyQuery = useQuery<{ result: any; error: string | null }>({
    queryKey: ['verify-token', token],
    queryFn: async () => {
      try {
        const data = await api.get<any>(`/api/verify/${encodeURIComponent(token)}`)
        if (data.error) {
          return { result: null, error: data.error }
        }
        return { result: data, error: null }
      } catch (err) {
        if (err instanceof ApiError && err.body && typeof err.body === 'object' && 'error' in (err.body as ApiErrorBody)) {
          return { result: null, error: (err.body as ApiErrorBody).error }
        }
        return { result: null, error: 'Unable to verify. Please try again.' }
      }
    },
    retry: false,
  })

  const loading = verifyQuery.isLoading
  const result = verifyQuery.data?.result ?? null
  const error = verifyQuery.data?.error ?? null

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full mx-auto" />
          <p className="text-[var(--color-muted)]">Verifying credential...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full border rounded-lg p-6 bg-white text-center space-y-4">
          <div className="text-4xl">❌</div>
          <h1 className="text-h3 text-[var(--color-error)]">Verification Failed</h1>
          <p className="text-[var(--color-muted)]">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full border rounded-lg bg-white overflow-hidden">
        <div className="bg-green-600 p-6 text-white text-center">
          <div className="text-4xl mb-2">✓</div>
          <h1 className="text-h3">Credential Verified</h1>
          <p className="text-sm opacity-80">Verified as of {result?.verifiedAt || 'now'}</p>
        </div>
        <div className="p-6 space-y-3 text-sm">
          {result?.memberName && (
            <div className="flex justify-between"><span className="text-[var(--color-muted)]">Member</span><span className="font-medium">{result.memberName}</span></div>
          )}
          {result?.organizationName && (
            <div className="flex justify-between"><span className="text-[var(--color-muted)]">Organization</span><span className="font-medium">{result.organizationName}</span></div>
          )}
          {result?.credentialType && (
            <div className="flex justify-between"><span className="text-[var(--color-muted)]">Type</span><span className="font-medium">{result.credentialType}</span></div>
          )}
          {result?.status && (
            <div className="flex justify-between"><span className="text-[var(--color-muted)]">Status</span><span className="font-medium">{result.status}</span></div>
          )}
          {result?.issuedAt && (
            <div className="flex justify-between"><span className="text-[var(--color-muted)]">Issued</span><span className="font-medium">{result.issuedAt}</span></div>
          )}
        </div>
        <div className="border-t p-4 text-center text-xs text-[var(--color-muted)]">
          Verified by Memberry • memberry.ph
        </div>
      </div>
    </div>
  )
}
