import { createFileRoute, Link } from '@tanstack/react-router'
import { CreateAnnouncementForm } from '@/features/announcements/CreateAnnouncementForm'

export const Route = createFileRoute('/announcements')({ component: AnnouncementsPage })

function AnnouncementsPage() {
  return (
    <main className="mx-auto max-w-xl p-4">
      <Link to="/" className="mb-4 inline-flex min-h-[48px] items-center text-body font-medium text-primary underline">Back to dashboard</Link>
      <h1 className="mb-4 text-title font-semibold text-foreground">Announcements</h1>
      <CreateAnnouncementForm />
    </main>
  )
}
