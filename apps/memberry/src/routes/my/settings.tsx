import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/my/settings')({
  component: MySettingsPage,
})

function MySettingsPage() {
  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="border rounded-lg p-6 space-y-4">
        <div>
          <h2 className="font-medium">Notification Preferences</h2>
          <p className="text-sm text-muted-foreground">Manage email and push notification settings.</p>
        </div>
        <div>
          <h2 className="font-medium">Privacy</h2>
          <p className="text-sm text-muted-foreground">Control your profile visibility across organizations.</p>
        </div>
        <div>
          <h2 className="font-medium">Account</h2>
          <p className="text-sm text-muted-foreground">
            <a href="/auth/settings" className="text-primary hover:underline">Manage account settings</a> in the account portal.
          </p>
        </div>
      </div>
    </div>
  )
}
