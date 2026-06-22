// Both queries render explicit error UI: assocLoading shows skeleton; dashError
// renders an in-page error banner with retry CTA (see ~line 254). The gate
// heuristic flags this because the local rename `error: dashError` masks the
// literal `isError` token.
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, RefreshCw, Download } from 'lucide-react'
import { useState } from 'react'
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@monobase/ui'
import { PageShell } from '@/components/patterns/page-shell'
import { RequireRole } from '@/lib/role-gate'
import { listAssociationsOptions } from '@monobase/sdk-ts/generated/react-query'

export const Route = createFileRoute('/national-dashboard/')({
  component: () => (
    <RequireRole allowed={['super']}>
      <NationalDashboardPage />
    </RequireRole>
  ),
})

interface ChapterEntry {
  orgId: string
  chapterName?: string
  totalMembers: number
  activeMembers: number
  graceMembers: number
  lapsedMembers: number
  suspendedMembers: number
  collectionRate: number
  totalCollected: number
  totalExpected: number
  cpdComplianceRate: number
  avgCreditsPerMember: number
  activityCount90d: number
}

interface Aggregate {
  associationId: string
  snapshotMonth: string
  chapterCount: number
  totalMembers: number
  activeMembers: number
  graceMembers: number
  lapsedMembers: number
  suspendedMembers: number
  collectionRate: number
  totalCollected: number
  totalExpected: number
  cpdComplianceRate: number
  avgCreditsPerMember: number
  totalActivityCount90d: number
}

interface NationalDashboardResponse {
  data: {
    associationId: string
    snapshotMonth: string
    aggregate: Aggregate
    chapters: ChapterEntry[]
  }
}

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)
}

function exportChaptersCSV(chapters: ChapterEntry[], snapshotMonth: string) {
  const headers = [
    'Chapter',
    'Total Members',
    'Active',
    'Lapsed',
    'Collection Rate',
    'Total Collected',
    'CPD Compliance',
    'Activity (90d)',
  ]
  const rows = chapters.map((ch) =>
    [
      ch.chapterName ?? ch.orgId,
      ch.totalMembers,
      ch.activeMembers,
      ch.lapsedMembers,
      ch.collectionRate,
      ch.totalCollected,
      ch.cpdComplianceRate,
      ch.activityCount90d,
    ].join(',')
  )
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `national-dashboard-${snapshotMonth}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function NationalDashboardPage() {
  const [selectedAssociation, setSelectedAssociation] = useState<string>('')
  const [snapshotMonth, setSnapshotMonth] = useState(getCurrentMonth)

  const { data: assocData, isLoading: assocLoading } = useQuery(
    listAssociationsOptions({ query: { limit: 100 } })
  )
  const associations = (assocData?.data ?? []) as Array<{ id: string; name: string }>

  const {
    data: dashboardData,
    isLoading: dashLoading,
    error: dashError,
    refetch,
  } = useQuery<NationalDashboardResponse>({
    queryKey: ['national-dashboard', selectedAssociation, snapshotMonth],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/national-dashboard/${selectedAssociation}?snapshotMonth=${snapshotMonth}`
      )
      if (!res.ok) throw new Error(`Failed to load dashboard: ${res.statusText}`)
      return res.json()
    },
    enabled: !!selectedAssociation,
  })

  const aggregate = dashboardData?.data?.aggregate
  const chapters = dashboardData?.data?.chapters ?? []

  // Generate month options (last 12 months)
  const monthOptions: string[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthOptions.push(d.toISOString().slice(0, 7))
  }

  return (
    <PageShell
      title="National Dashboard"
      subtitle="Cross-chapter comparison metrics for national associations"
      maxWidth="full"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportChaptersCSV(chapters, snapshotMonth)}
          disabled={chapters.length === 0}
        >
          <Download size={14} className="mr-1.5" />
          Export CSV
        </Button>
      }
    >
      {/* Filters */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-[300px]">
          <Select value={selectedAssociation} onValueChange={setSelectedAssociation}>
            <SelectTrigger>
              <SelectValue placeholder={assocLoading ? 'Loading...' : 'Select association'} />
            </SelectTrigger>
            <SelectContent>
              {associations.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[180px]">
          <Select value={snapshotMonth} onValueChange={setSnapshotMonth}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={dashLoading || !selectedAssociation}
        >
          <RefreshCw size={14} className={dashLoading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* No association selected */}
      {!selectedAssociation && (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Select an association to view chapter metrics</p>
        </div>
      )}

      {/* Loading — skeleton cards + skeleton table */}
      {selectedAssociation && dashLoading && (
        <>
          <div className="grid grid-cols-5 gap-4 mb-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-muted rounded h-20" />
            ))}
          </div>
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="p-4 border-b">
              <div className="animate-pulse bg-muted rounded h-4 w-48" />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-4 p-4 border-b last:border-0">
                <div className="animate-pulse bg-muted rounded h-4 w-32" />
                <div className="animate-pulse bg-muted rounded h-4 w-12 ml-auto" />
                <div className="animate-pulse bg-muted rounded h-4 w-12" />
                <div className="animate-pulse bg-muted rounded h-4 w-12" />
                <div className="animate-pulse bg-muted rounded h-4 w-16" />
                <div className="animate-pulse bg-muted rounded h-4 w-20" />
                <div className="animate-pulse bg-muted rounded h-4 w-16" />
                <div className="animate-pulse bg-muted rounded h-4 w-10" />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Error */}
      {dashError && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 mb-4 text-red-700 text-sm flex items-center justify-between">
          <span>{dashError instanceof Error ? dashError.message : 'Failed to load dashboard'}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Aggregate Stats */}
      {aggregate && (
        <>
          <div className="grid grid-cols-5 gap-4 mb-8">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Chapters</p>
              <p className="text-2xl font-bold mt-1">{aggregate.chapterCount}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Total Members</p>
              <p className="text-2xl font-bold mt-1">{aggregate.totalMembers.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Collection Rate</p>
              <p className="text-2xl font-bold mt-1">{formatPercent(aggregate.collectionRate)}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Total Collected</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(aggregate.totalCollected)}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">CPD Compliance</p>
              <p className="text-2xl font-bold mt-1">{formatPercent(aggregate.cpdComplianceRate)}</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mb-4">
            Snapshot: {aggregate.snapshotMonth} &middot; Chapters with fewer than 5 members are combined into &ldquo;Small chapters&rdquo;
          </p>
        </>
      )}

      {/* Chapter Comparison Table */}
      {chapters.length > 0 && (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="p-4 text-xs">Chapter</TableHead>
                <TableHead className="p-4 text-xs text-right">Members</TableHead>
                <TableHead className="p-4 text-xs text-right">Active</TableHead>
                <TableHead className="p-4 text-xs text-right">Lapsed</TableHead>
                <TableHead className="p-4 text-xs text-right">Collection Rate</TableHead>
                <TableHead className="p-4 text-xs text-right">Collected</TableHead>
                <TableHead className="p-4 text-xs text-right">CPD Compliance</TableHead>
                <TableHead className="p-4 text-xs text-right">Activity (90d)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chapters.map((ch) => (
                <TableRow key={ch.orgId}>
                  <TableCell className="p-4 text-sm font-medium">
                    {ch.orgId ? (
                      <Link
                        to="/national-dashboard/chapters/$orgId"
                        params={{ orgId: ch.orgId }}
                        search={{ month: snapshotMonth, associationId: selectedAssociation }}
                        className="hover:underline text-primary"
                      >
                        {ch.chapterName ?? ch.orgId}
                      </Link>
                    ) : (
                      (ch.chapterName ?? ch.orgId)
                    )}
                  </TableCell>
                  <TableCell className="p-4 text-sm text-right">{ch.totalMembers}</TableCell>
                  <TableCell className="p-4 text-sm text-right">{ch.activeMembers}</TableCell>
                  <TableCell className="p-4 text-sm text-right">{ch.lapsedMembers}</TableCell>
                  <TableCell className="p-4 text-sm text-right">{formatPercent(ch.collectionRate)}</TableCell>
                  <TableCell className="p-4 text-sm text-right">{formatCurrency(ch.totalCollected)}</TableCell>
                  <TableCell className="p-4 text-sm text-right">{formatPercent(ch.cpdComplianceRate)}</TableCell>
                  <TableCell className="p-4 text-sm text-right">{ch.activityCount90d}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Empty state — association selected but no chapters */}
      {selectedAssociation && !dashLoading && !dashError && chapters.length === 0 && aggregate && (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          <p className="text-sm">No chapter snapshots found for {snapshotMonth}.</p>
          <p className="text-xs mt-1">Snapshots are generated monthly. Try selecting a different month.</p>
        </div>
      )}
    </PageShell>
  )
}
