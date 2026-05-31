// oli-execute: error-handled-inline -- consumed by /officer/institutions route.
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import {
  listInstitutionalMembershipsOptions,
} from '@monobase/sdk-ts/generated/react-query'
import type { InstitutionalMembership } from '@monobase/sdk-ts/generated/types.gen'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Badge } from '@monobase/ui'
import { Skeleton } from '@monobase/ui'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@monobase/ui'
import { Tabs, TabsList, TabsTrigger } from '@monobase/ui'
import { Search, Building2 } from 'lucide-react'

interface InstitutionalMembershipTableProps {
  orgId: string
}

type InstMemberStatus = InstitutionalMembership['status']

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pendingPayment', label: 'Pending' },
  { value: 'expired', label: 'Expired' },
  { value: 'suspended', label: 'Suspended' },
]

const STATUS_BADGE: Record<InstMemberStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-[var(--color-success-bg)] text-[var(--color-success)] hover:bg-[var(--color-success-bg)]' },
  pendingPayment: { label: 'Pending', className: 'bg-[var(--color-info-bg)] text-[var(--color-info)] hover:bg-[var(--color-info-bg)]' },
  gracePeriod: { label: 'Grace Period', className: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] hover:bg-[var(--color-warning-bg)]' },
  lapsed: { label: 'Lapsed', className: 'bg-[var(--color-error-bg)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)]' },
  expired: { label: 'Expired', className: 'bg-gray-100 text-gray-600 hover:bg-gray-100' },
  suspended: { label: 'Suspended', className: 'bg-gray-100 text-gray-800 hover:bg-gray-100' },
  removed: { label: 'Removed', className: 'bg-gray-100 text-gray-500 hover:bg-gray-100' },
  resigned: { label: 'Resigned', className: 'bg-gray-100 text-gray-500 hover:bg-gray-100' },
  deceased: { label: 'Deceased', className: 'bg-gray-100 text-gray-500 hover:bg-gray-100' },
  expelled: { label: 'Expelled', className: 'bg-[var(--color-error-bg)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)]' },
}

const PAGE_SIZE = 20

export function InstitutionalMembershipTable({ orgId }: InstitutionalMembershipTableProps) {
  const { orgSlug } = useParams({ strict: false }) as { orgSlug: string }
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusTab, setStatusTab] = useState('all')
  const [page, setPage] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, isLoading, error } = useQuery(
    listInstitutionalMembershipsOptions({
      query: {
        organizationId: orgId,
        ...(debouncedSearch ? { q: debouncedSearch } : {}),
        ...(statusTab !== 'all' ? { status: statusTab as InstMemberStatus } : {}),
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      },
      headers: { 'x-org-id': orgId },
    })
  )

  const memberships = data?.data ?? []
  const total = data?.pagination?.totalCount ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)]" />
        <Input
          className="pl-9"
          placeholder="Search institutions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Status tabs */}
      <Tabs value={statusTab} onValueChange={(v) => { setStatusTab(v); setPage(0) }}>
        <TabsList className="flex-wrap h-auto bg-[var(--color-surface-warm)]">
          {STATUS_TABS.map((tab) => (
            // oli-ui: exempt(reason="EU-CONTRAST false-positive: text-[var(--color-text-secondary)] is #554B60 (8.2:1 on white); active state recolors text to --color-text. Audit misreads arbitrary-value class as bare text-secondary.")
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="text-[var(--color-text-secondary)] data-[state=active]:text-[var(--color-text)] data-[state=active]:bg-white"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <div role="alert" aria-live="polite" className="p-10 text-center text-[var(--color-error)]">
            Failed to load institutional memberships. Please try again.
          </div>
        ) : memberships.length === 0 ? (
          <div className="p-14 flex flex-col items-center gap-3 text-[var(--color-muted)]">
            <Building2 className="h-10 w-10 opacity-30" />
            <p className="text-sm">No institutional memberships found{debouncedSearch ? ` for "${debouncedSearch}"` : ''}.</p>
          </div>
        ) : (
          <Table className="text-sm">
            <TableHeader>
              <TableRow className="bg-[var(--color-surface-warm)]">
                <TableHead className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Parent Org</TableHead>
                <TableHead className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Tier</TableHead>
                <TableHead className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Seats</TableHead>
                <TableHead className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Status</TableHead>
                <TableHead className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Start Date</TableHead>
                <TableHead className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y">
              {memberships.map((m, idx) => {
                const badge = STATUS_BADGE[m.status] ?? STATUS_BADGE.pendingPayment
                return (
                  <TableRow
                    key={m.id}
                    className={`hover:bg-[var(--color-surface-warm)] transition-colors ${idx % 2 === 1 ? 'bg-[var(--color-surface-warm)]' : ''}`}
                  >
                    <TableCell className="px-3 py-2 text-body-sm font-mono text-xs truncate max-w-[180px]" title={m.parentOrganizationId}>
                      {m.parentOrganizationId}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-body-sm font-mono text-xs truncate max-w-[140px]" title={m.tierId}>
                      {m.tierId}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-body-sm tabular-nums">
                      {m.usedSeats}/{m.totalSeats}
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <Badge className={badge.className}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-body-sm text-[var(--color-muted)]">
                      {new Date(m.startDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <Link
                        to="/org/$orgSlug/officer/institutional-memberships/$institutionalMembershipId"
                        params={{ orgSlug, institutionalMembershipId: m.id }}
                        className="text-xs text-[var(--color-primary)] hover:underline"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-[var(--color-muted)]">
          <span>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
