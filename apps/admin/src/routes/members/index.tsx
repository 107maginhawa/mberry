import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Users, Search } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/members/')({
  component: MembersPage,
})

interface Organization {
  id: string
  name: string
  members?: Member[]
}

interface Member {
  id: string
  name: string
  email: string
  role?: string
  status?: string
  organizationName?: string
}

function MembersPage() {
  const [search, setSearch] = useState('')

  const { data: orgs, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'organizations'],
    queryFn: async () => {
      const res = await fetch('/api/admin/organizations', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch organizations')
      return res.json() as Promise<Organization[]>
    },
  })

  // Flatten members from all organizations
  const allMembers: Member[] = (orgs || []).flatMap((org) =>
    (org.members || []).map((m) => ({
      ...m,
      organizationName: org.name,
    }))
  )

  const filteredMembers = search.length >= 2
    ? allMembers.filter(
        (m) =>
          m.name?.toLowerCase().includes(search.toLowerCase()) ||
          m.email?.toLowerCase().includes(search.toLowerCase()) ||
          m.organizationName?.toLowerCase().includes(search.toLowerCase())
      )
    : allMembers

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <Users className="w-6 h-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Members</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Search and manage platform members across all organizations
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or organization..."
          className="w-full pl-10 pr-4 py-2 rounded-md border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {isError && (
        <p className="text-sm text-red-500 mb-4">Error: {(error as Error).message}</p>
      )}

      {/* Summary */}
      {!isLoading && (
        <p className="text-sm text-muted-foreground mb-4">
          {allMembers.length} member{allMembers.length !== 1 ? 's' : ''} across {(orgs || []).length} organization{(orgs || []).length !== 1 ? 's' : ''}
          {search.length >= 2 && ` | ${filteredMembers.length} matching "${search}"`}
        </p>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Name</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Email</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Organization</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Role</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  {allMembers.length === 0
                    ? 'No members found across organizations.'
                    : `No members matching "${search}".`}
                </td>
              </tr>
            ) : (
              filteredMembers.map((member) => (
                <tr key={member.id} className="border-b last:border-b-0">
                  <td className="p-4 text-sm">{member.name}</td>
                  <td className="p-4 text-sm text-muted-foreground">{member.email}</td>
                  <td className="p-4 text-sm text-muted-foreground">{member.organizationName || '--'}</td>
                  <td className="p-4">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-muted">
                      {member.role || 'member'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      member.status === 'active' ? 'bg-green-500/10 text-green-600' :
                      member.status === 'suspended' ? 'bg-red-500/10 text-red-600' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {member.status || 'active'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
