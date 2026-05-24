import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Users2, Search } from 'lucide-react'
import { useState } from 'react'
import {
  Button,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@monobase/ui'
import { RequireRole } from '@/lib/role-gate'

export const Route = createFileRoute('/committees/')({
  component: () => (
    <RequireRole allowed={['super', 'support']}>
      <CommitteesPage />
    </RequireRole>
  ),
})

interface CommitteeItem {
  id: string
  organizationId: string
  name: string
  description?: string
  status: 'active' | 'completed'
  memberCount: number
  createdAt: string
  dissolvedAt?: string
}

const PAGE_SIZE = 25

function CommitteesPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const { data, isLoading, error } = useQuery<{ data: CommitteeItem[] }>({
    queryKey: ['admin-committees'],
    queryFn: async () => {
      const res = await fetch('/api/admin/committees?limit=100')
      if (!res.ok) throw new Error(`Failed to load committees: ${res.statusText}`)
      return res.json()
    },
  })

  const allCommittees = data?.data ?? []
  const filtered = search.length >= 2
    ? allCommittees.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.description?.toLowerCase().includes(search.toLowerCase())
      )
    : allCommittees

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const committees = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const activeCount = allCommittees.filter((c) => c.status === 'active').length

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <Users2 className="w-6 h-6 text-muted-foreground" />
        <div>
          <h1 className="text-h1 text-foreground">Committees</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cross-org committee overview
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold mt-1">{isLoading ? '...' : allCommittees.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="text-2xl font-bold mt-1">{isLoading ? '...' : activeCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Dissolved</p>
          <p className="text-2xl font-bold mt-1">
            {isLoading ? '...' : allCommittees.length - activeCount}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search committees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 mb-4 text-red-700 text-sm">
          {error instanceof Error ? error.message : 'Failed to load committees'}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="p-4 text-sm">Committee</TableHead>
              <TableHead className="p-4 text-sm">Description</TableHead>
              <TableHead className="p-4 text-sm">Status</TableHead>
              <TableHead className="p-4 text-sm text-right">Members</TableHead>
              <TableHead className="p-4 text-sm">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="p-8 text-center text-muted-foreground animate-pulse">
                  Loading committees...
                </TableCell>
              </TableRow>
            ) : committees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="p-8 text-center text-muted-foreground">
                  <Users2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>No committees found{search ? ` matching "${search}"` : ''}</p>
                </TableCell>
              </TableRow>
            ) : (
              committees.map((committee) => (
                <TableRow key={committee.id}>
                  <TableCell className="p-4 text-sm font-medium">{committee.name}</TableCell>
                  <TableCell className="p-4 text-sm text-muted-foreground max-w-[300px] truncate">
                    {committee.description ?? '--'}
                  </TableCell>
                  <TableCell className="p-4 text-sm">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        committee.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {committee.status}
                    </span>
                  </TableCell>
                  <TableCell className="p-4 text-sm text-right">{committee.memberCount}</TableCell>
                  <TableCell className="p-4 text-sm text-muted-foreground">
                    {new Date(committee.createdAt).toLocaleDateString('en-PH', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            ← Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages - 1}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  )
}
