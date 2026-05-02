import { createFileRoute } from '@tanstack/react-router'
import { NotificationInbox } from '@/features/notifications/components/notification-inbox'

export const Route = createFileRoute('/_authenticated/my/notifications')({
  component: NotificationsPage,
})

function NotificationsPage() {
  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Notifications</h1>
      <NotificationInbox />
    </div>
  )
}
