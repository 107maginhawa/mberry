import { createFileRoute } from '@tanstack/react-router'
import { PageContainer } from '@monobase/ui'
import { NotificationInbox } from '@/features/notifications/components/notification-inbox'
import { PageHeader } from '@/components/patterns/page-header'

export const Route = createFileRoute('/_authenticated/my/notifications')({
  component: NotificationsPage,
})

function NotificationsPage() {
  return (
    <PageContainer width="default">
      <PageHeader
        title="Notifications"
        subtitle="Stay up to date with your organizations"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Notifications' },
        ]}
      />
      <NotificationInbox />
    </PageContainer>
  )
}
