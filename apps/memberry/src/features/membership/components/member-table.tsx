import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Users } from 'lucide-react'
import { api } from '@/lib/api'

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

const PAGE_SIZE = 50

export function MemberTable({ orgId, initialStatus, expiringDays }: MemberTableProps) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusTab, setStatusTab] = useState(initialStatus ?? 'all')
  const [categoryId, setCategoryId] = useState('all')
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

  const { data: categoriesData } = useQuery({
    queryKey: ['membership-categories', orgId],
    queryFn: async () => {
      const result: any = await api.get(`/api/membership/categories/${orgId}`)
      return result.data ?? []
    },
  })

  const categories = categoriesData ?? []

  const queryParams = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(page * PAGE_SIZE),
    ...(statusTab !== 'all' && { status: statusTab }),
    ...(categoryId !== 'all' && { categoryId }),
    ...(debouncedSearch && { search: debouncedSearch }),
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['membership-members', orgId, statusTab, categoryId, debouncedSearch, page],
    queryFn: async () => {
      return api.get<any>(`/api/membership/members/${orgId}?${queryParams}`)
    },
  })

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
  const total: number = expiringDays ? members.length : (data?.total ?? 0)

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
      </div>

      {/* Status tabs */}
      <Tabs value={statusTab} onValueChange={(v) => { setStatusTab(v); setPage(0) }}>
        <TabsList className="flex-wrap h-auto">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-muted/60 rounded-md text-sm">
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
          <div className="p-10 text-center text-destructive">Failed to load members. Please try again.</div>
        ) : members.length === 0 ? (
          <div className="p-14 flex flex-col items-center gap-3 text-muted-foreground">
            <Users className="h-10 w-10 opacity-30" />
            <p className="text-sm">No members found{debouncedSearch ? ` for "${debouncedSearch}"` : ''}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-surface-warm)] border-b text-left">
                  <th className="px-3 py-2.5 w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Name</th>
                  <th className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">License #</th>
                  <th className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Category</th>
                  <th className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Status</th>
                  <th className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Dues Expiry</th>
                  <th className="px-3 py-2.5 text-caption text-[var(--color-text-secondary)]">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {members.map((m: any, idx: number) => {
                  const status = m.status as MemberStatus
                  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.pendingPayment
                  return (
                    <tr key={m.id} className={`hover:bg-muted/30 transition-colors ${idx % 2 === 1 ? 'bg-[var(--color-surface-warm)]' : ''}`}>
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={selected.has(m.id)}
                          onCheckedChange={() => toggleSelect(m.id)}
                          aria-label={`Select ${m.name ?? m.id}`}
                        />
                      </td>
                      <td className="px-3 py-2 text-body-sm">
                        <Link
                          to="/org/$orgId/officer/roster/$memberId"
                          params={{ orgId, memberId: m.id }}
                          className="font-medium text-primary hover:underline"
                        >
                          {m.name ?? m.personId ?? m.id}
                        </Link>
                        {m.email && (
                          <div className="text-xs text-muted-foreground">{m.email}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-mono tabular-nums">{m.memberNumber ?? '—'}</td>
                      <td className="px-3 py-2 text-body-sm text-muted-foreground">{m.categoryName ?? m.categoryId ?? '—'}</td>
                      <td className="px-3 py-2">
                        <Badge className={badge.className}>{badge.label}</Badge>
                      </td>
                      <td className="px-3 py-2 text-body-sm tabular-nums text-muted-foreground">
                        {m.duesExpiryDate ? new Date(m.duesExpiryDate).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-3 py-2 text-body-sm text-muted-foreground">
                        {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
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
