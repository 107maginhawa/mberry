import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Shield, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { RequireRole } from '@/lib/role-gate'
import { listAuditLogsOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

export const Route = createFileRoute('/audit/')({
  component: () => (
    <RequireRole allowed={['super', 'support']}>
      <AuditPage />
    </RequireRole>
  ),
})


const LIMIT = 25

function AuditPage() {
  const [action, setAction] = useState<string>('')
  const [resourceType, setResourceType] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [userFilter, setUserFilter] = useState<string>('')
  const [page, setPage] = useState(0)

  const { data, isLoading, isError, error, refetch } = useQuery(
    listAuditLogsOptions({
      query: {
        limit: LIMIT,
        offset: page * LIMIT,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(action ? { action: action as any } : {}),
        ...(resourceType ? { resourceType } : {}),
        ...(startDate ? { startDate: startDate as unknown as Date } : {}),
        ...(endDate ? { endDate: endDate as unknown as Date } : {}),
        ...(userFilter ? { user: userFilter } : {}),
      },
    })
  )

  const total = data?.pagination?.totalCount ?? 0
  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-8">
        <Shield className="w-6 h-6 text-muted-foreground" />
        <div>
          <h1 className="text-h1 text-foreground">Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View and filter audit events across all modules
          </p>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Action select */}
        <Select value={action || 'all'} onValueChange={(val) => { setAction(val === 'all' ? '' : val); setPage(0) }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="create">create</SelectItem>
            <SelectItem value="read">read</SelectItem>
            <SelectItem value="update">update</SelectItem>
            <SelectItem value="delete">delete</SelectItem>
            <SelectItem value="login">login</SelectItem>
            <SelectItem value="logout">logout</SelectItem>
            <SelectItem value="approve">approve</SelectItem>
            <SelectItem value="deny">deny</SelectItem>
            <SelectItem value="renew">renew</SelectItem>
            <SelectItem value="terminate">terminate</SelectItem>
            <SelectItem value="reinstate">reinstate</SelectItem>
            <SelectItem value="mark-paid">mark-paid</SelectItem>
            <SelectItem value="complete">complete</SelectItem>
            <SelectItem value="transfer">transfer</SelectItem>
            <SelectItem value="anonymize">anonymize</SelectItem>
            <SelectItem value="export">export</SelectItem>
          </SelectContent>
        </Select>

        {/* Resource Type text input */}
        <Input
          type="text"
          value={resourceType}
          onChange={(e) => { setResourceType(e.target.value); setPage(0) }}
          placeholder="Resource type (e.g., persons)"
          className="w-auto"
        />

        {/* Start Date */}
        <Input
          type="date"
          value={startDate}
          onChange={(e) => { setStartDate(e.target.value); setPage(0) }}
          className="w-auto"
        />

        {/* End Date */}
        <Input
          type="date"
          value={endDate}
          onChange={(e) => { setEndDate(e.target.value); setPage(0) }}
          className="w-auto"
        />

        {/* User ID */}
        <Input
          type="text"
          value={userFilter}
          onChange={(e) => { setUserFilter(e.target.value); setPage(0) }}
          placeholder="User ID"
          className="w-auto"
        />

        {/* Refresh button */}
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Error state */}
      {isError && (
        <p className="text-sm text-red-500 mb-4">Error: {error instanceof Error ? error.message : 'Failed to load audit logs'}</p>
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
        <Button
          variant="outline"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {page + 1} of {totalPages || 1}
        </span>
        <Button
          variant="outline"
          onClick={() => setPage((p) => p + 1)}
          disabled={(page + 1) * LIMIT >= total}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
