import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/my/notifications')({
  component: MyNotifications,
})

function MyNotifications() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Notifications</h1>
      <p className="text-sm text-muted-foreground">Messages and announcements from your organizations</p>

      <div className="space-y-2">
        <div className="border rounded-lg p-4 text-center text-muted-foreground">
          No notifications yet.
        </div>
      </div>
    </div>
  )
}
