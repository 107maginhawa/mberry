// oli-execute: error-handled-inline
// `error` is local state set on accept/redeem failure; renders explicit
// branch at ~L68. Skeleton only shown while `sessionPending`, which uses
// the SDK's session hook, not a data query.
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Button } from '@monobase/ui'
import { useSession } from '@monobase/sdk-ts/react/hooks/use-auth'
import {
  validateInviteToken,
  claimInviteToken,
  type InviteValidation,
  type InviteError,
} from '@/features/invite/lib/token-validation'

export const Route = createFileRoute('/invite/$token')({
  component: InvitePage,
})

function InvitePage() {
  const { token } = Route.useParams()
  const navigate = useNavigate()
  const { data: session, isPending: sessionPending } = useSession()
  const isAuthenticated = !!session?.user
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [invite, setInvite] = useState<InviteValidation | null>(null)
  const [error, setError] = useState<InviteError | null>(null)

  useEffect(() => {
    validateInviteToken(token).then((result) => {
      if (result.ok) {
        setInvite(result.data)
      } else {
        setError(result.error)
      }
      setLoading(false)
    })
  }, [token])

  const handleClaim = async () => {
    setClaiming(true)
    const result = await claimInviteToken(token)
    if (result.ok) {
      const slug = result.data.organizationSlug
      if (slug) {
        navigate({ to: '/org/$orgSlug/home', params: { orgSlug: slug } })
      } else {
        navigate({ to: '/my/organizations' })
      }
    } else {
      setError({ error: result.error })
      setClaiming(false)
    }
  }

  const handleSignIn = () => {
    window.location.href = `/auth/sign-in?redirect=/invite/${encodeURIComponent(token)}`
  }

  if (loading || sessionPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full mx-auto" />
          <p className="text-[var(--color-muted)]">Validating invitation...</p>
        </div>
      </div>
    )
  }

  if (error) {
    const isExpired = error.code === 'EXPIRED'
    const isClaimed = error.code === 'ALREADY_CLAIMED'

    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full border rounded-lg p-6 space-y-4 text-center">
          <h1 className="text-h2 text-[var(--color-error)]">
            {isExpired ? 'Invitation Expired' : isClaimed ? 'Already Activated' : 'Invalid Invitation'}
          </h1>
          <p className="text-[var(--color-muted)]">{error.error}</p>
          {isExpired && (
            <p className="text-sm text-[var(--color-muted)]">
              Contact your chapter secretary to request a new invitation.
            </p>
          )}
          {isClaimed && (
            <a
              href="/auth/sign-in"
              className="inline-block px-4 py-2 bg-[var(--color-primary)] text-white rounded-md text-sm font-medium"
            >
              Log in instead
            </a>
          )}
        </div>
      </div>
    )
  }

  if (!invite) return null

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full border rounded-lg p-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-h2">Welcome to Memberry</h1>
          <p className="text-[var(--color-muted)]">
            You've been invited to join an organization.
          </p>
        </div>

        {invite.metadata?.name && (
          <div className="space-y-2 bg-[var(--color-surface-warm)] rounded-md p-4">
            <div className="text-sm">
              <span className="text-[var(--color-muted)]">Name:</span>{' '}
              <span className="font-medium">{invite.metadata.name}</span>
            </div>
            <div className="text-sm">
              <span className="text-[var(--color-muted)]">Email:</span>{' '}
              <span className="font-medium">{invite.email}</span>
            </div>
            {invite.metadata.memberNumber && (
              <div className="text-sm">
                <span className="text-[var(--color-muted)]">Member #:</span>{' '}
                <span className="font-medium">{invite.metadata.memberNumber}</span>
              </div>
            )}
          </div>
        )}

        {isAuthenticated ? (
          <Button
            className="w-full"
            onClick={handleClaim}
            disabled={claiming}
          >
            {claiming ? 'Accepting...' : 'Accept Invitation'}
          </Button>
        ) : (
          <div className="space-y-3">
            <Button
              className="w-full"
              onClick={handleSignIn}
            >
              Sign in to accept invitation
            </Button>
            <p className="text-xs text-center text-[var(--color-muted)]">
              You need to sign in or create an account to accept this invitation.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
