import { createFileRoute } from '@tanstack/react-router'
import { CreateAnnouncementForm } from '@/features/announcements/CreateAnnouncementForm'
import { AnnouncementsList } from '@/features/announcements/AnnouncementsList'

export const Route = createFileRoute('/announcements')({ component: AnnouncementsPage })

function AnnouncementsPage() {
  return (
    <main className="mx-auto max-w-xl p-4">
      <h1 className="mb-4 text-title font-semibold text-foreground">Announcements</h1>
      <CreateAnnouncementForm />
      <AnnouncementsList />
    </main>
  )
}
