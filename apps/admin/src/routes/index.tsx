import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { LayoutDashboard, Building2, Building, Users, ShieldCheck, UserCog, ToggleLeft, RefreshCw } from 'lucide-react'
import { Button } from '@monobase/ui'
import {
  listAssociationsOptions,
  listOrganizationsOptions,
  listAdminsOptions,
  listFeatureFlagsOptions,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function useDashboardStats() {
  const associations = useQuery(listAssociationsOptions({ query: { limit: 100 } }))
  const organizations = useQuery(listOrganizationsOptions({ query: { limit: 100 } }))
  const admins = useQuery(listAdminsOptions())
  const flags = useQuery(listFeatureFlagsOptions())

  return { associations, organizations, admins, flags }
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

const quickActions = [
  { to: '/operators', label: 'Manage Operators', icon: ShieldCheck, description: 'Invite or revoke admin access' },
  { to: '/feature-flags', label: 'Feature Flags', icon: ToggleLeft, description: 'Toggle modules per scope' },
  { to: '/impersonate', label: 'Impersonate User', icon: UserCog, description: 'Debug user issues' },
  { to: '/members', label: 'Member Lookup', icon: Users, description: 'Search across organizations' },
] as const

function DashboardPage() {
  const { associations, organizations, admins, flags } = useDashboardStats()

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <LayoutDashboard className="w-6 h-6 text-muted-foreground" />
        <h1 className="text-h1 text-foreground">
          Platform Admin
        </h1>
      </div>

      <div className="mb-4">
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Stats
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-6">
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
          label="Operators"
          value={Array.isArray(admins.data) ? admins.data.length : 0}
          loading={admins.isLoading}
          error={admins.isError}
        />
        <StatCard
          label="Feature Flags"
          value={Array.isArray(flags.data) ? flags.data.length : 0}
          loading={flags.isLoading}
          error={flags.isError}
        />
      </div>

      <div className="mt-8">
        <h2 className="text-h2 text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="flex items-start gap-4 rounded-lg border bg-card p-5 hover:border-primary/50 hover:bg-accent/50 transition-colors"
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
    </div>
  )
}
