import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listDuesInvoicesOptions,
  listDuesInvoicesQueryKey,
  markDuesInvoicePaidMutation,
} from '@monobase/sdk-ts/generated/react-query'
import type { DuesInvoice } from '@monobase/sdk-ts/generated/types.gen'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { EmptyState } from '@/components/patterns/empty-state'
import { DuesStatusBadge } from '@/features/dues/components/dues-status-badge'
import { formatCents } from '@/features/dues/lib/money'
import { useOrg } from '@/hooks/useOrg'
import { Button, Skeleton } from '@monobase/ui'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Checkbox } from '@monobase/ui'
import { FileText, Search, Download, Bell, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { extractErrorMessage } from '@/utils/error'

const invoiceSearchSchema = z.object({
  tab: z.enum(['all', 'generated', 'sent', 'overdue', 'paid']).optional().default('all'),
  q: z.string().optional().default(''),
  page: z.number().optional().default(0),
})

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/finances/invoices')({
  component: InvoicesPage,
  validateSearch: (search) => invoiceSearchSchema.parse(search),
})

type TabKey = 'all' | 'generated' | 'sent' | 'overdue' | 'paid'

const TAB_LABELS: Record<TabKey, string> = {
  all: 'All',
  generated: 'Draft',
  sent: 'Open',
  overdue: 'Past Due',
  paid: 'Paid',
}

const TAB_ORDER: TabKey[] = ['all', 'generated', 'sent', 'overdue', 'paid']

const PAGE_SIZE = 25

function InvoicesPage() {
  const { orgId, orgSlug } = useOrg()
  const queryClient = useQueryClient()
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()
  const activeTab = search.tab ?? 'all'
  const searchQuery = search.q ?? ''
  const page = search.page ?? 0
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  function setActiveTab(tab: TabKey) {
    void navigate({ search: { ...search, tab, page: 0 }, replace: true })
  }
  function setSearchQuery(q: string) {
    void navigate({ search: { ...search, q, page: 0 }, replace: true })
  }
  function setPage(p: number | ((prev: number) => number)) {
    void navigate({ search: { ...search, page: typeof p === 'function' ? p(page) : p }, replace: true })
  }

  const { data, isLoading, error } = useQuery({
    ...listDuesInvoicesOptions({
      query: { organizationId: orgId },
      headers: { 'x-org-id': orgId },
    } as any),
  })

  const allInvoices: DuesInvoice[] = (data as any)?.data ?? []

  // Count by status
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allInvoices.length }
    for (const inv of allInvoices) {
      counts[inv.status] = (counts[inv.status] ?? 0) + 1
    }
    return counts
  }, [allInvoices])

  // Filter by tab + search
  const filtered = useMemo(() => {
    let result = allInvoices
    if (activeTab !== 'all') {
      result = result.filter((inv) => inv.status === activeTab)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.personId.toLowerCase().includes(q)
      )
    }
    return result
  }, [allInvoices, activeTab, searchQuery])

  // Paginate
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Bulk actions
  const invoiceQueryKey = listDuesInvoicesQueryKey()
  const markPaidMut = useMutation({
    ...markDuesInvoicePaidMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceQueryKey })
      setSelectedIds(new Set())
      toast.success('Invoices marked as paid')
    },
    onError: (err) => toast.error('Failed to mark invoices as paid', { description: extractErrorMessage(err, 'Please try again.') }),
  })

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === paginated.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paginated.map((inv) => inv.id)))
    }
  }

  function handleBulkMarkPaid() {
    const unpaid = allInvoices.filter(
      (inv) => selectedIds.has(inv.id) && ['generated', 'sent', 'overdue'].includes(inv.status)
    )
    for (const inv of unpaid) {
      markPaidMut.mutate({
        path: { invoiceId: inv.id },
        body: { paymentId: `manual-${Date.now()}`, paidAt: new Date() },
        headers: { 'x-org-id': orgId },
      } as any)
    }
  }

  function handleExportCsv() {
    const headers = ['Invoice #', 'Person ID', 'Period Start', 'Period End', 'Amount', 'Status', 'Due Date']
    const rows = filtered.map((inv) => [
      inv.invoiceNumber,
      inv.personId,
      new Date(inv.periodStart).toLocaleDateString(),
      new Date(inv.periodEnd).toLocaleDateString(),
      formatCents(Number(inv.totalAmount)),
      inv.status,
      new Date(inv.periodEnd).toLocaleDateString(),
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  if (error) {
    return (
      <PageShell title="Invoices" breadcrumbs={[{ label: 'Officer' }, { label: 'Finances', href: `/org/${orgSlug}/officer/finances` }, { label: 'Invoices' }]}>
        <div role="alert" className="p-6 text-center text-[var(--color-error)]">Failed to load invoices</div>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Invoices"
      subtitle="Track and manage dues invoices"
      breadcrumbs={[
        { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
        { label: 'Finances', href: `/org/${orgSlug}/officer/finances` },
        { label: 'Invoices' },
      ]}
    >
      <GlassCard className="p-5">
        {/* Tab filters */}
        <div className="flex flex-wrap items-center gap-1 mb-4">
          {TAB_ORDER.map((tab) => {
            const count = statusCounts[tab] ?? 0
            const isActive = activeTab === tab
            return (
              <Button
                key={tab}
                variant={isActive ? 'default' : 'ghost'}
                size="sm"
                onClick={() => { setActiveTab(tab); setSelectedIds(new Set()) }}
                className={isActive ? '' : 'text-[var(--color-muted)]'}
              >
                {TAB_LABELS[tab]} ({isLoading ? '…' : count})
              </Button>
            )
          })}

          <div className="flex-1" />

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)]" />
            <Input
              placeholder="Search invoices…"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(0) }}
              className="pl-9 w-48"
            />
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded" />
            ))}
          </div>
        ) : paginated.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-10 h-10" />}
            headline={searchQuery ? 'No matching invoices' : 'No invoices yet'}
            description={searchQuery ? 'Try a different search term.' : 'Invoices appear here once generated.'}
          />
        ) : (
          <>
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-3 py-3 w-10">
                    <Checkbox
                      checked={selectedIds.size === paginated.length && paginated.length > 0}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="px-3 py-3">Invoice #</TableHead>
                  <TableHead className="px-3 py-3">Member</TableHead>
                  <TableHead className="px-3 py-3">Period</TableHead>
                  <TableHead className="px-3 py-3">Amount</TableHead>
                  <TableHead className="px-3 py-3">Status</TableHead>
                  <TableHead className="px-3 py-3">Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((inv) => (
                  <TableRow key={inv.id} className="hover:bg-[var(--color-surface-warm)]">
                    <TableCell className="px-3 py-3">
                      <Checkbox
                        checked={selectedIds.has(inv.id)}
                        onCheckedChange={() => toggleSelect(inv.id)}
                        aria-label={`Select ${inv.invoiceNumber}`}
                      />
                    </TableCell>
                    <TableCell className="px-3 py-3 font-mono text-xs">{inv.invoiceNumber}</TableCell>
                    <TableCell className="px-3 py-3 text-xs text-[var(--color-muted)]">{inv.personId}</TableCell>
                    <TableCell className="px-3 py-3 text-xs">
                      {new Date(inv.periodStart).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })} — {new Date(inv.periodEnd).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell className="px-3 py-3 font-mono">{formatCents(Number(inv.totalAmount))}</TableCell>
                    <TableCell className="px-3 py-3">
                      <DuesStatusBadge status={inv.status} type="invoice" />
                    </TableCell>
                    <TableCell className="px-3 py-3 text-xs">
                      {new Date(inv.periodEnd).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 text-sm text-[var(--color-muted)]">
              <span>
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
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
            <Button variant="outline" size="sm" onClick={handleBulkMarkPaid} disabled={markPaidMut.isPending}>
              <CheckCircle className="h-4 w-4 mr-1.5" /> Mark Paid
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="h-4 w-4 mr-1.5" /> Export CSV
            </Button>
          </div>
        )}

        {/* Always-visible export */}
        {selectedIds.size === 0 && filtered.length > 0 && (
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
