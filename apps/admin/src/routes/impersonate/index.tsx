import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserCog, Search, AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button, Input, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@monobase/ui'
import { PageShell } from '@/components/patterns/page-shell'
import { RequireRole } from '@/lib/role-gate'
import { listPersonsOptions } from '@monobase/sdk-ts/generated/react-query'
import { startImpersonation as startImpersonationApi, endImpersonation as endImpersonationApi } from '@monobase/sdk-ts/generated/sdk.gen'

export const Route = createFileRoute('/impersonate/')({
  // FIX-007 (PA-6): align the UI gate to the backend allow-list
  // IMPERSONATION_ALLOWED_ROLES = ['super', 'support'] (startImpersonation.ts).
  // The support tier is entitled to impersonate for diagnosis; gating to
  // super-only locked it out of a tool it is permitted to use.
  component: () => (
    <RequireRole allowed={['super', 'support']}>
      <ImpersonatePage />
    </RequireRole>
  ),
})

// FIX-010 (G3): the picker searches real person records via listPersons
// (GET /persons, admin/support only). The previous source — org.members off
// listOrganizations — was never populated, so search was always empty.
interface Person {
  id: string
  firstName?: string
  lastName?: string
  contactInfo?: { email?: string } | null
}

interface SearchResult {
  id: string
  name: string
  email: string
}

interface ImpersonationSession {
  sessionId: string
  targetUserId: string
  targetUserName?: string
  startedAt: string
}

function ImpersonatePage() {
  const [search, setSearch] = useState('')
  const [activeSession, setActiveSession] = useState<ImpersonationSession | null>(null)
  const queryClient = useQueryClient()

  // Search persons server-side via listPersons (only fires at >= 2 chars).
  const { data: personsData, isLoading: searchLoading } = useQuery({
    ...listPersonsOptions({ query: { q: search, limit: 25 } }),
    enabled: search.length >= 2,
  })
  const persons = personsData?.data as Person[] | undefined

  const filteredMembers: SearchResult[] = (persons || []).map((p) => ({
    id: p.id,
    name: [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || p.id,
    email: p.contactInfo?.email ?? '',
  }))

  const startImpersonation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const { data } = await startImpersonationApi({ body: { targetUserId } })
      return data as unknown as ImpersonationSession
    },
    onSuccess: (session) => {
      toast.success('Impersonation session started')
      setActiveSession(session)
      queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const endImpersonationMut = useMutation({
    mutationFn: async (sessionId: string) => {
      const { data } = await endImpersonationApi({ path: { sessionId } })
      return data
    },
    onSuccess: () => {
      toast.success('Impersonation session ended')
      setActiveSession(null)
      queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  return (
    <PageShell
      title="Impersonate User"
      subtitle="Start an impersonation session to debug user issues"
      maxWidth="full"
    >
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

      {/* Active Session Banner */}
      {activeSession && (
        <div className="flex items-center justify-between p-4 rounded-lg border border-yellow-500 bg-yellow-500/10 mb-6">
          <div>
            <p className="text-sm font-medium text-yellow-700">
              Active impersonation session
            </p>
            <p className="text-sm text-yellow-600/80 mt-0.5">
              User: {activeSession.targetUserName || activeSession.targetUserId} | Started: {new Date(activeSession.startedAt).toLocaleTimeString()}
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => endImpersonationMut.mutate(activeSession.sessionId)}
            disabled={endImpersonationMut.isPending}
            className="bg-yellow-600 hover:bg-yellow-700"
          >
            <X className="w-4 h-4" />
            {endImpersonationMut.isPending ? 'Ending...' : 'End Session'}
          </Button>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search for a user by name or email..."
          className="w-full pl-10 pr-4 py-2 rounded-md border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {search.length >= 2 && searchLoading && (
        <p className="text-sm text-muted-foreground mb-4">Searching users...</p>
      )}

      {/* Results Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="p-4 text-sm">Name</TableHead>
              <TableHead className="p-4 text-sm">Email</TableHead>
              <TableHead className="text-right p-4 text-sm">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {search.length < 2 ? (
              <TableRow>
                <TableCell colSpan={3} className="p-8 text-center text-muted-foreground">
                  Type at least 2 characters to search for a user.
                </TableCell>
              </TableRow>
            ) : searchLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="p-8 text-center text-muted-foreground">
                  Searching...
                </TableCell>
              </TableRow>
            ) : filteredMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="p-8 text-center text-muted-foreground">
                  No users found matching "{search}".
                </TableCell>
              </TableRow>
            ) : (
              filteredMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="p-4 text-sm">{member.name}</TableCell>
                  <TableCell className="p-4 text-sm text-muted-foreground">{member.email || '--'}</TableCell>
                  <TableCell className="p-4 text-right">
                    <Button
                      size="sm"
                      onClick={() => startImpersonation.mutate(member.id)}
                      disabled={startImpersonation.isPending || !!activeSession}
                    >
                      {startImpersonation.isPending ? '...' : 'Impersonate'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </PageShell>
  )
}
