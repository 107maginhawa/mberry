import { createFileRoute } from '@tanstack/react-router'
import { NotificationInbox } from '@/features/notifications/components/notification-inbox'
import { PageShell } from '@/components/patterns/page-shell'

export const Route = createFileRoute('/_authenticated/my/notifications')({
  component: NotificationsPage,
})

function NotificationsPage() {
  return (
    <PageShell
      title="Notifications"
      subtitle="Stay up to date with your organizations"
      breadcrumbs={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Notifications' },
      ]}
    >
      <NotificationInbox />
    </PageShell>
  )
}
