import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, ChevronDown } from 'lucide-react'
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
import { RequireRole } from '@/lib/role-gate'
import { listAssociationsOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

export const Route = createFileRoute('/national-dashboard/')({
  component: () => (
    <RequireRole allowed={['super', 'support', 'analyst']}>
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
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <BarChart3 className="w-6 h-6 text-muted-foreground" />
        <div>
          <h1 className="text-h1 text-foreground">National Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cross-chapter comparison metrics for national associations
          </p>
        </div>
      </div>

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
      </div>

      {/* No association selected */}
      {!selectedAssociation && (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Select an association to view chapter metrics</p>
        </div>
      )}

      {/* Loading */}
      {selectedAssociation && dashLoading && (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          <p className="text-sm animate-pulse">Loading dashboard data...</p>
        </div>
      )}

      {/* Error */}
      {dashError && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 mb-4 text-red-700 text-sm">
          {dashError instanceof Error ? dashError.message : 'Failed to load dashboard'}
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
                    {ch.chapterName ?? ch.orgId}
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
    </div>
  )
}
