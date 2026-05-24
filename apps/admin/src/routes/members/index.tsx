import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueries } from '@tanstack/react-query'
import { Users, Search } from 'lucide-react'
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@monobase/ui'
import { useState, useMemo } from 'react'
import {
  listOrganizationsOptions,
  listRosterMembersOptions,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import type { RosterMember } from '@monobase/sdk-ts/generated/types.gen'

// API returns RosterMember enriched with person fields via server JOIN
// These fields are not in the base RosterMember type
interface EnrichedRosterMember extends RosterMember {
  firstName?: string
  lastName?: string
  email?: string
  categoryName?: string
}

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
  personId: string
  name: string
  email: string
  role?: string
  status?: string
  organizationName?: string
}

function MembersPage() {
  const [search, setSearch] = useState('')
  const [orgFilter, setOrgFilter] = useState<string>('all')

  const { data: orgsData } = useQuery(listOrganizationsOptions({ query: { limit: 100 } }))
  const orgs = orgsData?.data as Organization[] | undefined

  // Filter which orgs to query based on org filter
  const targetOrgs = useMemo(() => {
    if (!orgs) return []
    if (orgFilter === 'all') return orgs
    return orgs.filter((o) => o.id === orgFilter)
  }, [orgs, orgFilter])

  // Fetch members for each target org via SDK
  const rosterQueries = useQueries({
    queries: targetOrgs.map((org) => ({
      ...listRosterMembersOptions({ query: { limit: 9999, organizationId: org.id } }),
      enabled: targetOrgs.length > 0,
    })),
  })

  const isLoading = rosterQueries.some((q) => q.isLoading)
  const isError = rosterQueries.some((q) => q.isError)
  const error = rosterQueries.find((q) => q.error)?.error as Error | undefined

  const allMembers: Member[] = targetOrgs.flatMap((org, i) => {
    const rosterData = rosterQueries[i]?.data as { data?: EnrichedRosterMember[] } | undefined
    const members: EnrichedRosterMember[] = rosterData?.data ?? []
    return members.map((m) => ({
      id: m.id,
      personId: m.personId,
      name: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.memberNumber || m.id,
      email: m.email || '',
      role: m.categoryName || 'member',
      status: m.status,
      organizationName: org.name,
    }))
  })

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
          <h1 className="text-h1 text-foreground">Members</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Search and manage platform members across all organizations
          </p>
        </div>
      </div>

      {/* Search + Org Filter */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email..."
            className="pl-9"
          />
        </div>
        <div className="w-[220px]">
          <Select value={orgFilter} onValueChange={setOrgFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All organizations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All organizations</SelectItem>
              {(orgs ?? []).map((org) => (
                <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isError && (
        <p role="alert" aria-live="polite" className="text-sm text-red-500 mb-4">Error: {(error as Error).message}</p>
      )}

      {/* Summary */}
      {!isLoading && (
        <p className="text-sm text-muted-foreground mb-4">
          {allMembers.length} member{allMembers.length !== 1 ? 's' : ''}
          {orgFilter === 'all'
            ? ` across ${(orgs || []).length} organization${(orgs || []).length !== 1 ? 's' : ''}`
            : ''}
          {search.length >= 2 && ` · ${filteredMembers.length} matching "${search}"`}
        </p>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="p-4 text-sm">Name</TableHead>
              <TableHead className="p-4 text-sm">Email</TableHead>
              <TableHead className="p-4 text-sm">Organization</TableHead>
              <TableHead className="p-4 text-sm">Role</TableHead>
              <TableHead className="p-4 text-sm">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="p-8 text-center text-muted-foreground animate-pulse">
                  Loading members...
                </TableCell>
              </TableRow>
            ) : filteredMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="p-8 text-center text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>{allMembers.length === 0
                    ? 'No members found.'
                    : `No members matching "${search}".`}</p>
                  {search && <p className="text-xs mt-1">Try a different search term</p>}
                </TableCell>
              </TableRow>
            ) : (
              filteredMembers.map((member) => (
                <TableRow key={member.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <TableCell className="p-4 text-sm">
                    <Link to="/members/$personId" params={{ personId: member.personId }} className="text-foreground hover:underline">
                      {member.name}
                    </Link>
                  </TableCell>
                  <TableCell className="p-4 text-sm text-muted-foreground">{member.email}</TableCell>
                  <TableCell className="p-4 text-sm text-muted-foreground">{member.organizationName || '--'}</TableCell>
                  <TableCell className="p-4">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-muted">
                      {member.role || 'member'}
                    </span>
                  </TableCell>
                  <TableCell className="p-4">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      member.status === 'active' ? 'bg-green-500/10 text-green-600' :
                      member.status === 'suspended' ? 'bg-red-500/10 text-red-600' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {member.status || 'active'}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
