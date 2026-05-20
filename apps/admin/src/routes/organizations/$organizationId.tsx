import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Building, ArrowLeft, Pencil, Play, Pause, Archive } from 'lucide-react'
import { getOrganizationOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

export const Route = createFileRoute('/organizations/$organizationId')({
  component: OrganizationDetailPage,
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
  members?: Array<{
    id: string
    name?: string
    email?: string
    role?: string
    status?: string
  }>
}

function OrganizationDetailPage() {
  const { organizationId } = Route.useParams()

  const { data: sdkOrg, isLoading, error } = useQuery(
    getOrganizationOptions({ path: { organizationId } })
  )
  // Cast to local interface — SDK type doesn't include extended fields (members, associationName)
  const org = sdkOrg as Organization | undefined

  const createdDate = org?.createdAt || org?.created_at
  const assocName = org?.associationName || org?.association?.name || '--'
  const members = org?.members ?? []

  return (
    <div className="p-8">
      <Link
        to="/organizations"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Organizations
      </Link>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 mb-4 text-red-700 text-sm">
          {error.message}
        </div>
      )}

      {isLoading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : !org ? (
        <div className="text-muted-foreground">Organization not found.</div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Building className="w-6 h-6 text-muted-foreground" />
              <div>
                <h1 className="text-h1 text-foreground">
                  {org.name}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  ID: {organizationId}
                </p>
              </div>
            </div>
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium hover:bg-accent transition-colors">
              <Pencil className="w-4 h-4" />
              Edit Organization
            </button>
          </div>

          {/* Detail Card */}
          <div className="rounded-lg border bg-card p-6 mb-8">
            <h2 className="text-h2 mb-4">Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="text-sm font-medium mt-1">{org.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Association</p>
                <p className="text-sm font-medium mt-1">{assocName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <p className="text-sm font-medium mt-1">{org.type ?? '--'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-sm font-medium mt-1">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    org.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : org.status === 'suspended'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                  }`}>
                    {org.status ?? 'unknown'}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="text-sm font-medium mt-1">
                  {createdDate ? new Date(createdDate).toLocaleDateString() : '--'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Member Count</p>
                <p className="text-sm font-medium mt-1">{org.memberCount ?? members.length}</p>
              </div>
            </div>
          </div>

          {/* Lifecycle Controls */}
          <div className="rounded-lg border bg-card p-6 mb-8">
            <h2 className="text-h2 mb-4">Lifecycle Controls</h2>
            <div className="flex items-center gap-3">
              <button className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors">
                <Play className="w-4 h-4" />
                Activate
              </button>
              <button className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-yellow-600 text-white text-sm font-medium hover:bg-yellow-700 transition-colors">
                <Pause className="w-4 h-4" />
                Suspend
              </button>
              <button className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">
                <Archive className="w-4 h-4" />
                Archive
              </button>
            </div>
          </div>

          {/* Members sub-table */}
          <h2 className="text-h2 mb-4">Members</h2>
          <div className="rounded-lg border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Name</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Email</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Role</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No members found for this organization.
                    </td>
                  </tr>
                ) : (
                  members.map((member) => (
                    <tr key={member.id} className="border-b last:border-b-0 hover:bg-muted/50">
                      <td className="p-4 text-sm font-medium">{member.name ?? '--'}</td>
                      <td className="p-4 text-sm text-muted-foreground">{member.email ?? '--'}</td>
                      <td className="p-4 text-sm text-muted-foreground">{member.role ?? '--'}</td>
                      <td className="p-4 text-sm">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          member.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {member.status ?? 'unknown'}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-right text-muted-foreground">--</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
