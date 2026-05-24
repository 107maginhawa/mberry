import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard,
  Building2,
  Building,
  Users,
  ShieldCheck,
  UserCog,
  ToggleLeft,
  RefreshCw,
  Calendar,
  Shield,
} from 'lucide-react'
import { Button } from '@monobase/ui'
import {
  listAssociationsOptions,
  listOrganizationsOptions,
  listAdminsOptions,
  listFeatureFlagsOptions,
  searchEventsOptions,
  listAuditLogsOptions,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function useDashboardStats() {
  const associations = useQuery(listAssociationsOptions({ query: { limit: 100 } }))
  const organizations = useQuery(listOrganizationsOptions({ query: { limit: 100 } }))
  const admins = useQuery(listAdminsOptions())
  const flags = useQuery(listFeatureFlagsOptions())
  const events = useQuery(searchEventsOptions({ query: { status: 'published', limit: 100 } }))
  const auditLogs = useQuery(listAuditLogsOptions({ query: { limit: 10 } }))

  return { associations, organizations, admins, flags, events, auditLogs }
}

function StatCard({ label, value, loading, error }: { label: string; value: number | string; loading: boolean; error: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      {loading ? (
        <p className="text-3xl font-bold mt-1 text-muted-foreground animate-pulse">...</p>
      ) : error ? (
        <p className="text-sm text-red-500 mt-1">Failed to load</p>
      ) : (
        <p className="text-3xl font-bold mt-1">{value}</p>
      )}
    </div>
  )
}

const outcomeColors: Record<string, string> = {
  success: 'text-green-600',
  failure: 'text-red-600',
  error: 'text-red-600',
}

const quickActions = [
  { to: '/operators', label: 'Manage Operators', icon: ShieldCheck, description: 'Invite or revoke admin access' },
  { to: '/feature-flags', label: 'Feature Flags', icon: ToggleLeft, description: 'Toggle modules per scope' },
  { to: '/impersonate', label: 'Impersonate User', icon: UserCog, description: 'Debug user issues' },
  { to: '/members', label: 'Member Lookup', icon: Users, description: 'Search across organizations' },
] as const

function DashboardPage() {
  const { associations, organizations, admins, flags, events, auditLogs } = useDashboardStats()

  const auditEntries = (auditLogs.data?.data ?? []) as unknown as Array<{
    id: string
    action: string
    resourceType: string
    description?: string
    outcome?: string
    createdAt: string | Date
  }>

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <LayoutDashboard className="w-6 h-6 text-muted-foreground" />
        <h1 className="text-h1 text-foreground">
          Platform Dashboard
        </h1>
      </div>

      <div className="mb-6">
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Platform Health KPIs */}
      <div className="mb-8">
        <h2 className="text-h2 text-foreground mb-4">Platform Health</h2>
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="Associations"
            value={associations.data?.data?.length ?? 0}
            loading={associations.isLoading}
            error={associations.isError}
          />
          <StatCard
            label="Organizations"
            value={organizations.data?.data?.length ?? 0}
            loading={organizations.isLoading}
            error={organizations.isError}
          />
          <StatCard
            label="Active Events"
            value={(events.data?.data as unknown[])?.length ?? 0}
            loading={events.isLoading}
            error={events.isError}
          />
          <StatCard
            label="Operators"
            value={Array.isArray(admins.data) ? admins.data.length : 0}
            loading={admins.isLoading}
            error={admins.isError}
          />
        </div>
      </div>

      {/* Two-column layout: Quick Actions + Recent Audit */}
      <div className="grid grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div>
          <h2 className="text-h2 text-foreground mb-4">Quick Actions</h2>
          <div className="space-y-3">
            {quickActions.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className="flex items-start gap-4 rounded-lg border bg-card p-4 hover:border-primary/50 hover:bg-accent/50 transition-colors"
              >
                <action.icon className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{action.label}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{action.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Audit Log */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-h2 text-foreground">Recent Activity</h2>
            <Link to="/audit" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              View all →
            </Link>
          </div>
          <div className="rounded-lg border bg-card divide-y">
            {auditLogs.isLoading ? (
              <div className="p-4 text-sm text-muted-foreground animate-pulse">Loading activity...</div>
            ) : auditEntries.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No recent activity.</div>
            ) : (
              auditEntries.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 px-4 py-3">
                  <Shield className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">
                      {entry.description ?? `${entry.action} ${entry.resourceType}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(entry.createdAt).toLocaleString()}
                      {entry.outcome && (
                        <span className={`ml-2 ${outcomeColors[entry.outcome] ?? 'text-muted-foreground'}`}>
                          {entry.outcome}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
