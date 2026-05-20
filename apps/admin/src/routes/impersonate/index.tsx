import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserCog, Search, AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { RequireRole } from '@/lib/role-gate'
import { listOrganizationsOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import { startImpersonation as startImpersonationApi, endImpersonation as endImpersonationApi } from '@monobase/sdk-ts/generated/sdk.gen'

export const Route = createFileRoute('/impersonate/')({
  component: () => (
    <RequireRole allowed={['super']}>
      <ImpersonatePage />
    </RequireRole>
  ),
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
  organizationName?: string
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

  const { data: orgsData, isLoading: orgsLoading } = useQuery(listOrganizationsOptions({ query: { limit: 100 } }))
  const orgs = orgsData?.data as Organization[] | undefined

  // Derive a flat member list from organizations for search
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
          m.email?.toLowerCase().includes(search.toLowerCase())
      )
    : []

  const startImpersonation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const { data } = await startImpersonationApi({ body: { targetUserId } as any })
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
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <UserCog className="w-6 h-6 text-muted-foreground" />
        <div>
          <h1 className="text-h1 text-foreground">
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
          <button
            onClick={() => endImpersonationMut.mutate(activeSession.sessionId)}
            disabled={endImpersonationMut.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-yellow-600 text-white text-sm font-medium hover:bg-yellow-700 transition-colors"
          >
            <X className="w-4 h-4" />
            {endImpersonationMut.isPending ? 'Ending...' : 'End Session'}
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search for a user by name or email..."
          className="w-full pl-10 pr-4 py-2 rounded-md border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {orgsLoading && (
        <p className="text-sm text-muted-foreground mb-4">Loading organizations...</p>
      )}

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
            {search.length < 2 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  Type at least 2 characters to search for a user.
                </td>
              </tr>
            ) : filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  No users found matching "{search}".
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
                  <td className="p-4 text-right">
                    <button
                      onClick={() => startImpersonation.mutate(member.id)}
                      disabled={startImpersonation.isPending || !!activeSession}
                      className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {startImpersonation.isPending ? '...' : 'Impersonate'}
                    </button>
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
