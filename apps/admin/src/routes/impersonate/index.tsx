import { createFileRoute } from '@tanstack/react-router'
import { UserCog, Search, AlertTriangle } from 'lucide-react'

export const Route = createFileRoute('/impersonate/')({
  component: ImpersonatePage,
})

function ImpersonatePage() {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <UserCog className="w-6 h-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Impersonate User
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Start an impersonation session to debug user issues
          </p>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="flex items-start gap-3 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5 mb-6">
        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-yellow-700">
            Impersonation sessions are audit-logged
          </p>
          <p className="text-sm text-yellow-600/80 mt-1">
            All actions taken while impersonating a user are recorded with your
            admin identity. Use this feature only for debugging and support.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search for a user by name or email..."
          className="w-full pl-10 pr-4 py-2 rounded-md border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          disabled
        />
      </div>

      {/* Results Table */}
      <div className="rounded-lg border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Name</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Email</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Organization</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Role</th>
              <th className="text-right p-4 text-sm font-medium text-muted-foreground">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="p-8 text-center text-muted-foreground">
                Search for a user to begin impersonation.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
