import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Building, Plus } from 'lucide-react'
import { Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@monobase/ui'
import { listOrganizationsOptions } from '@monobase/sdk-ts/generated/react-query'
import { ErrorState } from '@/components/skeletons'
import { PageShell } from '@/components/patterns/page-shell'

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
  const { data, isLoading, isError, refetch } = useQuery(listOrganizationsOptions({ query: { limit: 50 } }))

  if (isError) {
    return (
      <PageShell title="Organizations" maxWidth="full">
        <ErrorState message="Could not load organizations" onRetry={() => refetch()} />
      </PageShell>
    )
  }

  // Cast to local Organization interface which includes extended fields (associationName, type, memberCount)
  const organizations = (data?.data ?? []) as unknown as Organization[]
  const total = data?.pagination?.totalCount ?? organizations.length
  const activeCount = organizations.filter((o) => o.status === 'active').length
  const suspendedCount = organizations.filter((o) => o.status === 'suspended').length

  return (
    <PageShell
      title="Organizations"
      subtitle="View and manage all organizations across associations"
      maxWidth="full"
      actions={
        <Button>
          <Plus className="w-4 h-4" />
          Create Organization
        </Button>
      }
    >
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

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="p-4 text-sm">Name</TableHead>
              <TableHead className="p-4 text-sm">Association</TableHead>
              <TableHead className="p-4 text-sm">Type</TableHead>
              <TableHead className="p-4 text-sm">Status</TableHead>
              <TableHead className="p-4 text-sm">Members</TableHead>
              <TableHead className="text-right p-4 text-sm">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="p-8 text-center text-muted-foreground animate-pulse">
                  Loading organizations...
                </TableCell>
              </TableRow>
            ) : organizations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-8 text-center text-muted-foreground">
                  <Building className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>No organizations found.</p>
                </TableCell>
              </TableRow>
            ) : (
              organizations.map((org) => {
                const assocName = org.associationName || org.association?.name || '--'
                return (
                  <TableRow key={org.id}>
                    <TableCell className="p-4 text-sm font-medium">
                      <Link
                        to="/organizations/$organizationId"
                        params={{ organizationId: org.id }}
                        className="text-foreground hover:underline"
                      >
                        {org.name}
                      </Link>
                    </TableCell>
                    <TableCell className="p-4 text-sm text-muted-foreground">{assocName}</TableCell>
                    <TableCell className="p-4 text-sm text-muted-foreground">{org.type ?? '--'}</TableCell>
                    <TableCell className="p-4 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        org.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : org.status === 'suspended'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}>
                        {org.status ?? 'unknown'}
                      </span>
                    </TableCell>
                    <TableCell className="p-4 text-sm text-muted-foreground">{org.memberCount ?? '--'}</TableCell>
                    <TableCell className="p-4 text-sm text-right">
                      <Link
                        to="/organizations/$organizationId"
                        params={{ organizationId: org.id }}
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </PageShell>
  )
}
