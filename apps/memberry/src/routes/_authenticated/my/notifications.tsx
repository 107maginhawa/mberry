import { createFileRoute } from '@tanstack/react-router'
import { NotificationInbox } from '@/features/notifications/components/notification-inbox'
import { PageHeader } from '@/components/patterns/page-header'

export const Route = createFileRoute('/_authenticated/my/notifications')({
  component: NotificationsPage,
})

function NotificationsPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Notifications"
        subtitle="Stay up to date with your organizations"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Notifications' },
        ]}
      />
      <NotificationInbox />
    </div>
  )
}
