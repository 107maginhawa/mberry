import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Shield, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { RequireRole } from '@/lib/role-gate'

export const Route = createFileRoute('/audit/')({
  component: () => (
    <RequireRole allowed={['super', 'support']}>
      <AuditPage />
    </RequireRole>
  ),
})

interface AuditLogEntry {
  id: string
  eventType: string
  category: string
  action: string
  outcome: string
  user: string | null
  userType: string
  resourceType: string
  resource: string
  description: string
  ipAddress: string | null
  createdAt: string
}

interface AuditLogsResponse {
  data: AuditLogEntry[]
  pagination: {
    total: number
    limit: number
    offset: number
  }
}

const LIMIT = 25

function AuditPage() {
  const [action, setAction] = useState<string>('')
  const [resourceType, setResourceType] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [userFilter, setUserFilter] = useState<string>('')
  const [page, setPage] = useState(0)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'audit-logs', action, resourceType, startDate, endDate, userFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('limit', String(LIMIT))
      params.set('offset', String(page * LIMIT))
      if (action) params.set('action', action)
      if (resourceType) params.set('resourceType', resourceType)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (userFilter) params.set('user', userFilter)
      const res = await fetch(`/api/audit/logs?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch audit logs')
      return res.json() as Promise<AuditLogsResponse>
    },
  })

  const total = data?.pagination?.total ?? 0
  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-8">
        <Shield className="w-6 h-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View and filter audit events across all modules
          </p>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Action select */}
        <select
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(0) }}
          className="px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Actions</option>
          <option value="create">create</option>
          <option value="read">read</option>
          <option value="update">update</option>
          <option value="delete">delete</option>
          <option value="login">login</option>
          <option value="logout">logout</option>
          <option value="approve">approve</option>
          <option value="deny">deny</option>
          <option value="renew">renew</option>
          <option value="terminate">terminate</option>
          <option value="reinstate">reinstate</option>
          <option value="mark-paid">mark-paid</option>
          <option value="complete">complete</option>
          <option value="transfer">transfer</option>
          <option value="anonymize">anonymize</option>
          <option value="export">export</option>
        </select>

        {/* Resource Type text input */}
        <input
          type="text"
          value={resourceType}
          onChange={(e) => { setResourceType(e.target.value); setPage(0) }}
          placeholder="Resource type (e.g., persons)"
          className="px-3 py-2 rounded-md border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />

        {/* Start Date */}
        <input
          type="date"
          value={startDate}
          onChange={(e) => { setStartDate(e.target.value); setPage(0) }}
          className="px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />

        {/* End Date */}
        <input
          type="date"
          value={endDate}
          onChange={(e) => { setEndDate(e.target.value); setPage(0) }}
          className="px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />

        {/* User ID */}
        <input
          type="text"
          value={userFilter}
          onChange={(e) => { setUserFilter(e.target.value); setPage(0) }}
          placeholder="User ID"
          className="px-3 py-2 rounded-md border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />

        {/* Refresh button */}
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-2 rounded-md border bg-background text-sm hover:bg-muted transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Error state */}
      {isError && (
        <p className="text-sm text-red-500 mb-4">Error: {(error as Error).message}</p>
      )}

      {/* Summary line */}
      {!isLoading && (
        <p className="text-sm text-muted-foreground mb-4">
          {total} audit event{total !== 1 ? 's' : ''}
        </p>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Timestamp</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Action</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Resource Type</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Resource ID</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">User</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Outcome</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Description</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : (data?.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  No audit events found.
                </td>
              </tr>
            ) : (
              (data?.data ?? []).map((entry) => (
                <tr key={entry.id} className="border-b last:border-b-0">
                  <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(entry.createdAt).toLocaleString()}
                  </td>
                  <td className="p-4">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      entry.action === 'create' ? 'bg-green-500/10 text-green-600' :
                      entry.action === 'update' ? 'bg-blue-500/10 text-blue-600' :
                      entry.action === 'delete' ? 'bg-red-500/10 text-red-600' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {entry.action}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{entry.resourceType}</td>
                  <td className="p-4 text-sm text-muted-foreground font-mono text-xs">{entry.resource}</td>
                  <td className="p-4 text-sm text-muted-foreground font-mono text-xs">{entry.user ?? '--'}</td>
                  <td className="p-4">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      entry.outcome === 'success' ? 'bg-green-500/10 text-green-600' :
                      entry.outcome === 'failure' ? 'bg-red-500/10 text-red-600' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {entry.outcome}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground max-w-[200px] truncate">{entry.description}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="px-3 py-2 rounded-md border bg-background text-sm disabled:opacity-40 hover:bg-muted transition-colors disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span className="text-sm text-muted-foreground">
          Page {page + 1} of {totalPages || 1}
        </span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={(page + 1) * LIMIT >= total}
          className="px-3 py-2 rounded-md border bg-background text-sm disabled:opacity-40 hover:bg-muted transition-colors disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  )
}
