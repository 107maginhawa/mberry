import { createFileRoute, Link } from '@tanstack/react-router'
import { ComposeForm } from '@/features/communications/components/compose-form'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/communications/new')({
  component: NewAnnouncementPage,
})

function NewAnnouncementPage() {
  const { orgId } = Route.useParams()

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link
          to="/org/$orgId/officer/communications"
          params={{ orgId }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to Communications
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">New Announcement</h1>
        <p className="text-sm text-muted-foreground mt-1">Compose and send a message to your members</p>
      </div>
      <ComposeForm orgId={orgId} />
    </div>
  )
}
