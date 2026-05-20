import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  listRosterMembersOptions,
  listMembershipCategoriesOptions,
} from '@monobase/sdk-ts/generated/react-query'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Badge } from '@monobase/ui'
import { Skeleton } from '@monobase/ui'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@monobase/ui'
import { Checkbox } from '@monobase/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { Tabs, TabsList, TabsTrigger } from '@monobase/ui'
import { Search, Users } from 'lucide-react'
import { AvatarInitials } from '@/components/patterns/avatar-initials'

interface MemberTableProps {
  orgId: string
  initialStatus?: string
  expiringDays?: number
}

type MemberStatus = 'active' | 'gracePeriod' | 'lapsed' | 'suspended' | 'pendingPayment'

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'gracePeriod', label: 'Grace' },
  { value: 'lapsed', label: 'Lapsed' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'pendingPayment', label: 'Pending' },
]

const STATUS_BADGE: Record<MemberStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-[var(--color-success-bg)] text-[var(--color-success)] hover:bg-[var(--color-success-bg)]' },
  gracePeriod: { label: 'Grace', className: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] hover:bg-[var(--color-warning-bg)]' },
  lapsed: { label: 'Lapsed', className: 'bg-[var(--color-error-bg)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)]' },
  suspended: { label: 'Suspended', className: 'bg-gray-100 text-gray-800 hover:bg-gray-100' },
  pendingPayment: { label: 'Pending', className: 'bg-[var(--color-info-bg)] text-[var(--color-info)] hover:bg-[var(--color-info-bg)]' },
}

// Dues invoice status badge styling
const DUES_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  paid: { label: 'Paid', className: 'bg-[var(--color-success-bg)] text-[var(--color-success)] hover:bg-[var(--color-success-bg)]' },
  overdue: { label: 'Overdue', className: 'bg-[var(--color-error-bg)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)]' },
  generated: { label: 'Generated', className: 'bg-[var(--color-info-bg)] text-[var(--color-info)] hover:bg-[var(--color-info-bg)]' },
  sent: { label: 'Sent', className: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] hover:bg-[var(--color-warning-bg)]' },
}

const PAGE_SIZE = 50

export function MemberTable({ orgId, initialStatus, expiringDays }: MemberTableProps) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusTab, setStatusTab] = useState(initialStatus ?? 'all')
  const [categoryId, setCategoryId] = useState('all')
  const [duesStatusFilter, setDuesStatusFilter] = useState('all')
  const [trainingFilter, setTrainingFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Debounce search 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data: categoriesData } = useQuery(
    listMembershipCategoriesOptions({ query: { organizationId: orgId } })
  )

  const categories = categoriesData?.data ?? []

  // Build query params — duesStatus and trainingCompliant are supported by the API
  // but not yet in the generated SDK types, so we cast to any to pass them through
  const rosterQuery: any = {
    organizationId: orgId,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    ...(statusTab !== 'all' ? { status: statusTab } : {}),
    ...(categoryId !== 'all' ? { categoryId } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(duesStatusFilter !== 'all' ? { duesStatus: duesStatusFilter } : {}),
    ...(trainingFilter === 'compliant' ? { trainingCompliant: true } : {}),
    ...(trainingFilter === 'non-compliant' ? { trainingCompliant: false } : {}),
  }

  const { data, isLoading, error } = useQuery(
    listRosterMembersOptions({ query: rosterQuery })
  )

  const rawMembers: any[] = data?.data ?? []

  // Client-side filter for expiring dues within N days
  const members = expiringDays
    ? rawMembers.filter((m: any) => {
        if (!m.duesExpiryDate) return false
        const expiry = new Date(m.duesExpiryDate)
        const daysLeft = (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        return daysLeft >= 0 && daysLeft <= expiringDays
      })
    : rawMembers
  const total: number = expiringDays ? members.length : (data?.pagination?.totalCount ?? 0)

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selected.size === members.length && members.length > 0) {
      setSelected(new Set())
    } else {
      setSelected(new Set(members.map((m: any) => m.id)))
    }
  }, [selected.size, members])

  const allSelected = members.length > 0 && selected.size === members.length

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)]" />
          <Input
            className="pl-9"
            placeholder="Search by name, email or license..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setPage(0) }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Dues Status filter */}
        <Select value={duesStatusFilter} onValueChange={(v) => { setDuesStatusFilter(v); setPage(0) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Dues Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dues</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="generated">Generated</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
          </SelectContent>
        </Select>
        {/* Training compliance filter */}
        <Select value={trainingFilter} onValueChange={(v) => { setTrainingFilter(v); setPage(0) }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Training" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Training</SelectItem>
            <SelectItem value="compliant">Compliant</SelectItem>
            <SelectItem value="non-compliant">Non-Compliant</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status tabs */}
      <Tabs value={statusTab} onValueChange={(v) => { setStatusTab(v); setPage(0) }}>
        <TabsList className="flex-wrap h-auto bg-[var(--color-surface-warm)]">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="text-[var(--color-text-secondary)] data-[state=active]:text-[var(--color-text)] data-[state=active]:bg-white">{tab.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-[var(--color-surface-warm)] rounded-md text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-10 text-center text-[var(--color-error)]">Failed to load members. Please try again.</div>
        ) : members.length === 0 ? (
          <div className="p-14 flex flex-col items-center gap-3 text-[var(--color-muted)]">
            <Users className="h-10 w-10 opacity-30" />
            <p className="text-sm">No members found{debouncedSearch ? ` for "${debouncedSearch}"` : ''}.</p>
          </div>
        ) : (
          <Table className="text-sm">
            <TableHeader>
              <TableRow className="bg-[var(--color-surface-warm)]">
                <TableHead className="px-3 py-2.5 w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Name</TableHead>
                <TableHead className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">License #</TableHead>
                <TableHead className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Category</TableHead>
                <TableHead className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Status</TableHead>
                <TableHead className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Dues Status</TableHead>
                <TableHead className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Training</TableHead>
                <TableHead className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Dues Expiry</TableHead>
                <TableHead className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y">
              {members.map((m: any, idx: number) => {
                const status = m.status as MemberStatus
                const badge = STATUS_BADGE[status] ?? STATUS_BADGE.pendingPayment
                const duesInvoiceStatus: string | null = m.duesInvoiceStatus ?? null
                const creditsEarned: number = m.creditsEarned ?? 0
                const trainingCompliant: boolean = m.trainingCompliant ?? false
                const duesBadge = duesInvoiceStatus ? DUES_STATUS_BADGE[duesInvoiceStatus] : null
                return (
                  <TableRow key={m.id} className={`hover:bg-[var(--color-surface-warm)] transition-colors ${idx % 2 === 1 ? 'bg-[var(--color-surface-warm)]' : ''}`}>
                    <TableCell className="px-3 py-2">
                      <Checkbox
                        checked={selected.has(m.id)}
                        onCheckedChange={() => toggleSelect(m.id)}
                        aria-label={`Select ${m.name ?? m.id}`}
                      />
                    </TableCell>
                    <TableCell className="px-3 py-2 text-body-sm">
                      <div className="flex items-center gap-2">
                        <AvatarInitials
                          name={m.name ?? '?'}
                          size="sm"
                          photoUrl={m.avatar?.url || m.photoUrl}
                        />
                        <div>
                          <Link
                            to="/org/$orgId/officer/roster/$memberId"
                            params={{ orgId, memberId: m.id }}
                            className="font-medium text-[var(--color-primary)] hover:underline"
                          >
                            {m.name ?? m.personId ?? m.id}
                          </Link>
                          {m.email && (
                            <div className="text-xs text-[var(--color-muted)]">{m.email}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-mono tabular-nums">{m.memberNumber ?? '—'}</TableCell>
                    <TableCell className="px-3 py-2 text-body-sm text-[var(--color-muted)]">{m.categoryName ?? m.categoryId ?? '—'}</TableCell>
                    <TableCell className="px-3 py-2">
                      <Badge className={badge.className}>{badge.label}</Badge>
                    </TableCell>
                    {/* Dues Status column */}
                    <TableCell className="px-3 py-2">
                      {duesBadge ? (
                        <Badge className={duesBadge.className}>{duesBadge.label}</Badge>
                      ) : (
                        <span className="text-xs text-[var(--color-muted)]">No invoice</span>
                      )}
                    </TableCell>
                    {/* Training column */}
                    <TableCell className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs tabular-nums text-[var(--color-muted)]">{creditsEarned}</span>
                        {trainingCompliant ? (
                          <Badge className="bg-[var(--color-success-bg)] text-[var(--color-success)] hover:bg-[var(--color-success-bg)] text-xs">Compliant</Badge>
                        ) : (
                          <Badge className="bg-[var(--color-error-bg)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)] text-xs">{creditsEarned}/40</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-body-sm tabular-nums text-[var(--color-muted)]">
                      {m.duesExpiryDate ? new Date(m.duesExpiryDate).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-body-sm text-[var(--color-muted)]">
                      {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : '—'}
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
