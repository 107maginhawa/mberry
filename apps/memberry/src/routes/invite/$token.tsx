import { createFileRoute } from '@tanstack/react-router'
import { parseInviteToken, isTokenExpired } from '@/features/invite/lib/token-validation'

export const Route = createFileRoute('/invite/$token')({
  component: InvitePage,
})

function InvitePage() {
  const { token } = Route.useParams()
  const invite = parseInviteToken(token)

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">Invalid Invite</h1>
          <p className="text-muted-foreground">This invite link is not valid.</p>
        </div>
      </div>
    )
  }

  if (isTokenExpired(invite.expiresAt)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">Invite Expired</h1>
          <p className="text-muted-foreground">This invite link has expired. Please request a new one.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full border rounded-lg p-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Join {invite.orgName}</h1>
          <p className="text-muted-foreground">
            You've been invited to join as a {invite.role}.
          </p>
        </div>

        <button
          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
          onClick={() => {
            // TODO: Call accept invite API endpoint
            // This will create a membership application or direct membership
          }}
        >
          Accept Invite
        </button>
      </div>
    </div>
  )
}
