import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
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
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [invite, setInvite] = useState<InviteValidation | null>(null)
  const [error, setError] = useState<InviteError | null>(null)
  const [errorStatus, setErrorStatus] = useState(0)

  useEffect(() => {
    validateInviteToken(token).then((result) => {
      if (result.ok) {
        setInvite(result.data)
      } else {
        setError(result.error)
        setErrorStatus(result.status)
      }
      setLoading(false)
    })
  }, [token])

  const handleClaim = async () => {
    setClaiming(true)
    const result = await claimInviteToken(token)
    if (result.ok) {
      navigate({ to: '/my/organizations' })
    } else {
      setError({ error: result.error })
      setClaiming(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Validating invitation...</p>
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
          <h1 className="text-2xl font-bold text-destructive">
            {isExpired ? 'Invitation Expired' : isClaimed ? 'Already Activated' : 'Invalid Invitation'}
          </h1>
          <p className="text-muted-foreground">{error.error}</p>
          {isExpired && (
            <p className="text-sm text-muted-foreground">
              Contact your chapter secretary to request a new invitation.
            </p>
          )}
          {isClaimed && (
            <a
              href="/login"
              className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
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
          <h1 className="text-2xl font-bold">Welcome to Memberry</h1>
          <p className="text-muted-foreground">
            You've been invited to join an organization.
          </p>
        </div>

        {invite.metadata?.name && (
          <div className="space-y-2 bg-muted/50 rounded-md p-4">
            <div className="text-sm">
              <span className="text-muted-foreground">Name:</span>{' '}
              <span className="font-medium">{invite.metadata.name}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Email:</span>{' '}
              <span className="font-medium">{invite.email}</span>
            </div>
            {invite.metadata.licenseNumber && (
              <div className="text-sm">
                <span className="text-muted-foreground">License:</span>{' '}
                <span className="font-medium">{invite.metadata.licenseNumber}</span>
              </div>
            )}
          </div>
        )}

        <button
          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50"
          onClick={handleClaim}
          disabled={claiming}
        >
          {claiming ? 'Accepting...' : 'Accept Invitation'}
        </button>
      </div>
    </div>
  )
}
