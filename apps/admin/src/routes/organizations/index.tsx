import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Building, Plus } from 'lucide-react'
import { listOrganizationsOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

export const Route = createFileRoute('/organizations/')({
  component: OrganizationsPage,
})

interface Organization {
  id: string
  name: string
  type?: string
  status?: string
  memberCount?: number
  associationId?: string
  associationName?: string
  association?: { id: string; name: string }
  createdAt?: string
  created_at?: string
}


function OrganizationsPage() {
  const { data, isLoading, error } = useQuery(listOrganizationsOptions({ query: { limit: 50 } }))

  // Cast to local Organization interface which includes extended fields (associationName, type, memberCount)
  const organizations = (data?.data ?? []) as unknown as Organization[]
  const total = data?.pagination?.totalCount ?? organizations.length
  const activeCount = organizations.filter((o) => o.status === 'active').length
  const suspendedCount = organizations.filter((o) => o.status === 'suspended').length

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Building className="w-6 h-6 text-muted-foreground" />
          <div>
            <h1 className="text-h1 text-foreground">
              Organizations
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              View and manage all organizations across associations
            </p>
          </div>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />
          Create Organization
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Total Organizations</p>
          <p className="text-3xl font-bold mt-1">{isLoading ? '...' : total}</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="text-3xl font-bold mt-1">{isLoading ? '...' : activeCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Suspended</p>
          <p className="text-3xl font-bold mt-1">{isLoading ? '...' : suspendedCount}</p>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 mb-4 text-red-700 text-sm">
          {error instanceof Error ? error.message : 'Failed to load organizations'}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Name</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Association</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Type</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Members</th>
              <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : organizations.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No organizations found.
                </td>
              </tr>
            ) : (
              organizations.map((org) => {
                const assocName = org.associationName || org.association?.name || '--'
                return (
                  <tr key={org.id} className="border-b last:border-b-0 hover:bg-muted/50">
                    <td className="p-4 text-sm font-medium">
                      <Link
                        to="/organizations/$organizationId"
                        params={{ organizationId: org.id }}
                        className="text-foreground hover:underline"
                      >
                        {org.name}
                      </Link>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{assocName}</td>
                    <td className="p-4 text-sm text-muted-foreground">{org.type ?? '--'}</td>
                    <td className="p-4 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        org.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : org.status === 'suspended'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}>
                        {org.status ?? 'unknown'}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{org.memberCount ?? '--'}</td>
                    <td className="p-4 text-sm text-right">
                      <Link
                        to="/organizations/$organizationId"
                        params={{ organizationId: org.id }}
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
