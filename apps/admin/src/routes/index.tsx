import { createFileRoute } from '@tanstack/react-router'
import { LayoutDashboard } from 'lucide-react'

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <LayoutDashboard className="w-6 h-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold text-foreground">
          Platform Admin
        </h1>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Total Users</p>
          <p className="text-3xl font-bold mt-1">--</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Active Sessions</p>
          <p className="text-3xl font-bold mt-1">--</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">System Health</p>
          <p className="text-3xl font-bold mt-1">--</p>
        </div>
      </div>

      <div className="mt-8 rounded-lg border bg-card p-6">
        <p className="text-muted-foreground">
          Admin dashboard is ready. Connect to the API to populate data.
        </p>
      </div>
    </div>
  )
}
