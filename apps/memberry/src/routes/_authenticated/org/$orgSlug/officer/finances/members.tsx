import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  listRosterMembersOptions,
  listMembershipCategoriesOptions,
  listDuesInvoicesOptions,
} from '@monobase/sdk-ts/generated/react-query'
import type { MembershipStatus, DuesInvoice } from '@monobase/sdk-ts/generated/types.gen'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { EmptyState } from '@/components/patterns/empty-state'
import { ErrorState } from '@/components/patterns/error-state'
import { useOrg } from '@/hooks/useOrg'
import { Button, Skeleton, Badge } from '@monobase/ui'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Checkbox } from '@monobase/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { Search, Users, Bell, FileText, Download } from 'lucide-react'
import { AvatarInitials } from '@/components/patterns/avatar-initials'
import { formatCents } from '@/features/dues/lib/money'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/finances/members')({
  component: FinancialMembersPage,
})

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: 'Current', className: 'bg-[var(--color-success-bg)] text-[var(--color-success)]' },
  gracePeriod: { label: 'Due Soon', className: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' },
  lapsed: { label: 'Overdue', className: 'bg-[var(--color-error-bg)] text-[var(--color-error)]' },
  pendingPayment: { label: 'Pending', className: 'bg-[var(--color-info-bg)] text-[var(--color-info)]' },
  suspended: { label: 'Suspended', className: 'bg-muted text-muted-foreground' },
  expired: { label: 'Expired', className: 'bg-muted text-muted-foreground' },
}

const PAGE_SIZE = 25

function FinancialMembersPage() {
  const { orgId, orgSlug } = useOrg()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(0) }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data: categoriesData } = useQuery(
    listMembershipCategoriesOptions({ query: { organizationId: orgId }, headers: { 'x-org-id': orgId } })
  )
  const categories = categoriesData?.data ?? []

  const rosterQuery: any = {
    organizationId: orgId,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    ...(statusFilter !== 'all' ? { status: statusFilter as MembershipStatus } : {}),
    ...(categoryFilter !== 'all' ? { categoryId: categoryFilter } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  }

  const rosterDataQuery = useQuery(
    listRosterMembersOptions({ query: rosterQuery, headers: { 'x-org-id': orgId } })
  )
  const { data: rosterData, isLoading } = rosterDataQuery

  // Fetch invoices for outstanding balance calculation
  const { data: invoiceData } = useQuery({
    ...listDuesInvoicesOptions({
      query: { organizationId: orgId },
      headers: { 'x-org-id': orgId },
    } as any),
  })

  const members: any[] = rosterData?.data ?? []
  const total = (rosterData as any)?.pagination?.totalCount ?? members.length
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Compute outstanding per person from invoices
  const outstandingByPerson = new Map<string, number>()
  const allInvoices = ((invoiceData as any)?.data ?? []) as DuesInvoice[]
  for (const inv of allInvoices) {
    if (['generated', 'sent', 'overdue'].includes(inv.status)) {
      const current = outstandingByPerson.get(inv.personId) ?? 0
      outstandingByPerson.set(inv.personId, current + Number(inv.totalAmount))
    }
  }

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === members.length && members.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(members.map((m: any) => m.id)))
    }
  }, [selectedIds.size, members])

  if (rosterDataQuery.isError) {
    return (
      <PageShell
        title="Members"
        subtitle="Financial view of all members"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Finances', href: `/org/${orgSlug}/officer/finances` },
          { label: 'Members' },
        ]}
      >
        <div className="p-6 max-w-2xl">
          <ErrorState message="Could not load member finances" onRetry={() => rosterDataQuery.refetch()} />
        </div>
      </PageShell>
    )
  }

  function handleExportCsv() {
    const headers = ['Name', 'Category', 'Status', 'Outstanding', 'Member Since']
    const rows = members.map((m: any) => {
      const name = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.personId
      const outstanding = outstandingByPerson.get(m.personId) ?? 0
      return [
        name,
        m.categoryName ?? '—',
        m.status,
        formatCents(outstanding),
        m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : '—',
      ]
    })
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `members-financial-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  return (
    <PageShell
      title="Members"
      subtitle="Financial view of all members"
      breadcrumbs={[
        { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
        { label: 'Finances', href: `/org/${orgSlug}/officer/finances` },
        { label: 'Members' },
      ]}
    >
      <GlassCard className="p-5">
        {/* Filter bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)]" />
            <Input
              className="pl-9"
              placeholder="Search members…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0) }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="gracePeriod">Grace Period</SelectItem>
              <SelectItem value="lapsed">Lapsed</SelectItem>
              <SelectItem value="pendingPayment">Pending</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0) }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Category: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <EmptyState
            icon={<Users className="w-10 h-10" />}
            headline={debouncedSearch ? 'No matching members' : 'No members yet'}
            description={debouncedSearch ? 'Try a different search term.' : 'Members appear here once added to the roster.'}
          />
        ) : (
          <>
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-3 py-3 w-10">
                    <Checkbox
                      checked={selectedIds.size === members.length && members.length > 0}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="px-3 py-3">Member</TableHead>
                  <TableHead className="px-3 py-3">Category</TableHead>
                  <TableHead className="px-3 py-3">Status</TableHead>
                  <TableHead className="px-3 py-3">Balance</TableHead>
                  <TableHead className="px-3 py-3">Member Since</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m: any) => {
                  const name = [m.firstName, m.lastName].filter(Boolean).join(' ')
                  const outstanding = outstandingByPerson.get(m.personId) ?? 0
                  const badge = STATUS_BADGE[m.status] ?? { label: m.status, className: 'bg-muted text-muted-foreground' }

                  return (
                    <TableRow key={m.id} className="hover:bg-[var(--color-surface-warm)] cursor-pointer">
                      <TableCell className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(m.id)}
                          onCheckedChange={() => toggleSelect(m.id)}
                          aria-label={`Select ${name}`}
                        />
                      </TableCell>
                      <TableCell className="px-3 py-3">
                        <Link
                          to="/org/$orgSlug/officer/finances/members/$memberId"
                          params={{ orgSlug, memberId: m.id }}
                          className="flex items-center gap-2.5 hover:underline"
                        >
                          <AvatarInitials name={name || '?'} size="sm" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{name || 'Unknown'}</p>
                            <p className="text-xs text-[var(--color-muted)] truncate">{m.email ?? m.personId}</p>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="px-3 py-3 text-xs">{m.categoryName ?? '—'}</TableCell>
                      <TableCell className="px-3 py-3">
                        <Badge className={`text-xs ${badge.className}`}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="px-3 py-3 font-mono">
                        {outstanding > 0 ? (
                          <span className="text-[var(--color-error)]">{formatCents(outstanding)}</span>
                        ) : (
                          <span className="text-[var(--color-success)]">₱0.00</span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-xs text-[var(--color-muted)]">
                        {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' }) : '—'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 text-sm text-[var(--color-muted)]">
              <span>
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
                  ← Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1}>
                  Next →
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[var(--color-border)]">
            <span className="text-sm text-[var(--color-muted)]">{selectedIds.size} selected</span>
            <Button variant="outline" size="sm" onClick={() => toast.info('Send reminders coming soon')}>
              <Bell className="h-4 w-4 mr-1.5" /> Send Reminders
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast.info('Generate invoices coming soon')}>
              <FileText className="h-4 w-4 mr-1.5" /> Generate Invoices
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="h-4 w-4 mr-1.5" /> Export CSV
            </Button>
          </div>
        )}

        {selectedIds.size === 0 && members.length > 0 && (
          <div className="flex justify-end mt-4 pt-4 border-t border-[var(--color-border)]">
            <Button variant="ghost" size="sm" onClick={handleExportCsv}>
              <Download className="h-4 w-4 mr-1.5" /> Export CSV
            </Button>
          </div>
        )}
      </GlassCard>
    </PageShell>
  )
}
